export interface CameraStream {
  stream: MediaStream
  stop: () => void
}

export interface CameraCaps {
  torch: boolean
  zoom: { min: number; max: number; step: number } | null
  focus: boolean
  focusMode: string | null
  exposureCompensation: { min: number; max: number; step: number } | null
  raw: MediaTrackCapabilities
}

export async function startRearCamera(): Promise<CameraStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('getUserMedia unavailable (requires secure context)')
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  })
  return {
    stream,
    stop: () => {
      for (const track of stream.getTracks()) track.stop()
    },
  }
}

export function getCameraCaps(track: MediaStreamTrack): CameraCaps {
  const c = track.getCapabilities?.() ?? {}
  const zoom =
    c.zoom && typeof c.zoom.min === 'number' && typeof c.zoom.max === 'number'
      ? { min: c.zoom.min, max: c.zoom.max, step: c.zoom.step ?? 0.1 }
      : null
  const focusModes: string[] = Array.isArray(c.focusMode) ? c.focusMode : []
  const focusMode =
    focusModes.find((m) => m === 'single-shot') ??
    focusModes.find((m) => m === 'continuous') ??
    focusModes[0] ??
    null
  const ec = c.exposureCompensation
  const exposureCompensation =
    ec && typeof ec.min === 'number' && typeof ec.max === 'number'
      ? { min: ec.min, max: ec.max, step: ec.step ?? 0.33 }
      : null
  return {
    torch: !!c.torch,
    zoom,
    focus: focusMode !== null || c.pointsOfInterest !== undefined,
    focusMode,
    exposureCompensation,
    raw: c,
  }
}

export async function setExposureCompensation(
  track: MediaStreamTrack,
  value: number,
): Promise<void> {
  await track.applyConstraints({ advanced: [{ exposureCompensation: value }] })
}

export async function setTorch(track: MediaStreamTrack, on: boolean): Promise<void> {
  await track.applyConstraints({ advanced: [{ torch: on }] })
}

export async function setZoom(track: MediaStreamTrack, value: number): Promise<void> {
  await track.applyConstraints({ advanced: [{ zoom: value }] })
}

export async function setFocusPoint(
  track: MediaStreamTrack,
  x: number,
  y: number,
  focusMode?: string | null,
): Promise<void> {
  const advanced: MediaTrackConstraintSet = { pointsOfInterest: [{ x, y }] }
  if (focusMode) advanced.focusMode = focusMode
  await track.applyConstraints({ advanced: [advanced] })
}

export async function captureFrame(
  video: HTMLVideoElement,
  quality = 0.85,
): Promise<Blob> {
  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) throw new Error('video has no dimensions yet')
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  ctx.drawImage(video, 0, 0, w, h)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
      'image/jpeg',
      quality,
    )
  })
}
