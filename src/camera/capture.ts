export interface CameraStream {
  stream: MediaStream
  stop: () => void
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
