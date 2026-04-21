import { useEffect, useRef, useState } from 'react'
import {
  captureFrame,
  getCameraCaps,
  setExposureCompensation,
  setFocusPoint,
  setTorch,
  setZoom,
  startRearCamera,
  type CameraCaps,
} from '../camera/capture'

interface Props {
  onCapture: (blob: Blob) => Promise<void>
  captureLabel?: string
}

interface FocusRing {
  x: number
  y: number
  key: number
  ok: boolean
}

function touchDistance(
  a: { clientX: number; clientY: number },
  b: { clientX: number; clientY: number },
): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function mapToSensor(
  localX: number,
  localY: number,
  containerW: number,
  containerH: number,
  videoW: number,
  videoH: number,
): { x: number; y: number } | null {
  if (!videoW || !videoH || !containerW || !containerH) return null
  const sourceRatio = videoW / videoH
  const containerRatio = containerW / containerH
  let renderedW: number
  let renderedH: number
  let offsetX: number
  let offsetY: number
  if (sourceRatio > containerRatio) {
    renderedW = containerW
    renderedH = containerW / sourceRatio
    offsetX = 0
    offsetY = (containerH - renderedH) / 2
  } else {
    renderedH = containerH
    renderedW = containerH * sourceRatio
    offsetX = (containerW - renderedW) / 2
    offsetY = 0
  }
  const relX = localX - offsetX
  const relY = localY - offsetY
  if (relX < 0 || relY < 0 || relX > renderedW || relY > renderedH) return null
  return { x: relX / renderedW, y: relY / renderedH }
}

export function CameraPreview({ onCapture, captureLabel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const stopRef = useRef<(() => void) | null>(null)
  const tapStartRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null)

  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [caps, setCaps] = useState<CameraCaps | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [zoom, setZoomLevel] = useState(1)
  const [focusRing, setFocusRing] = useState<FocusRing | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cam = await startRearCamera()
        if (cancelled) {
          cam.stop()
          return
        }
        stopRef.current = cam.stop
        const track = cam.stream.getVideoTracks()[0] ?? null
        trackRef.current = track
        const el = videoRef.current
        if (el) {
          el.srcObject = cam.stream
          await el.play()
        }
        if (track) {
          const c = getCameraCaps(track)
          setCaps(c)
          if (c.zoom) setZoomLevel(c.zoom.min)
        }
        setActive(true)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? `${e.name}: ${e.message}` : String(e))
      }
    })()
    return () => {
      cancelled = true
      stopRef.current?.()
      stopRef.current = null
      trackRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!focusRing) return
    const id = window.setTimeout(() => setFocusRing(null), 700)
    return () => window.clearTimeout(id)
  }, [focusRing])

  async function shoot() {
    if (!videoRef.current || capturing || !active) return
    setCapturing(true)
    try {
      const blob = await captureFrame(videoRef.current)
      await onCapture(blob)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCapturing(false)
    }
  }

  async function toggleTorch() {
    const track = trackRef.current
    if (!track) return
    const next = !torchOn
    try {
      await setTorch(track, next)
      setTorchOn(next)
      if (caps?.exposureCompensation) {
        const target = next ? Math.max(caps.exposureCompensation.min, -1) : 0
        await setExposureCompensation(track, target).catch(() => undefined)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function isOverButton(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest('button')
  }

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (!active || isOverButton(e.target)) return
    if (e.touches.length === 2 && caps?.zoom) {
      pinchStartRef.current = {
        dist: touchDistance(e.touches[0], e.touches[1]),
        zoom,
      }
      tapStartRef.current = null
    } else if (e.touches.length === 1) {
      const t = e.touches[0]
      tapStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() }
    }
  }

  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (!active) return
    const track = trackRef.current
    const pinch = pinchStartRef.current
    if (e.touches.length === 2 && pinch && caps?.zoom && track) {
      const dist = touchDistance(e.touches[0], e.touches[1])
      const ratio = dist / pinch.dist
      let next = pinch.zoom * ratio
      next = Math.max(caps.zoom.min, Math.min(caps.zoom.max, next))
      setZoomLevel(next)
      void setZoom(track, next).catch(() => undefined)
    }
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    if (!active) return
    if (pinchStartRef.current && e.touches.length < 2) {
      pinchStartRef.current = null
      tapStartRef.current = null
      return
    }
    const track = trackRef.current
    const video = videoRef.current
    const tap = tapStartRef.current
    tapStartRef.current = null
    if (!tap || isOverButton(e.target)) return
    if (e.changedTouches.length !== 1 || !previewRef.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - tap.x
    const dy = t.clientY - tap.y
    const dt = Date.now() - tap.t
    if (Math.hypot(dx, dy) >= 15 || dt >= 400) return
    const rect = previewRef.current.getBoundingClientRect()
    const localX = t.clientX - rect.left
    const localY = t.clientY - rect.top
    const sensor = video
      ? mapToSensor(localX, localY, rect.width, rect.height, video.videoWidth, video.videoHeight)
      : null
    const ring: FocusRing = { x: localX, y: localY, key: Date.now(), ok: false }
    if (track && sensor) {
      setFocusPoint(track, sensor.x, sensor.y, caps?.focusMode ?? null)
        .then(() => setFocusRing({ ...ring, ok: true }))
        .catch((err: unknown) => {
          setError(err instanceof Error ? `focus: ${err.name}: ${err.message}` : String(err))
          setFocusRing({ ...ring, ok: false })
        })
    }
    setFocusRing(ring)
  }

  const captureBtnClass =
    'px-5 py-3 rounded-lg bg-red-600 disabled:bg-slate-700 font-medium min-w-24'

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div
        ref={previewRef}
        className="relative flex-1 bg-black min-h-0 touch-none select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain"
          playsInline
          muted
        />

        {!active && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400">
            Starting camera…
          </div>
        )}

        {active && caps?.torch && (
          <button
            type="button"
            onClick={toggleTorch}
            aria-pressed={torchOn}
            className={`absolute top-3 right-3 h-10 px-3 rounded-full text-sm font-semibold ${
              torchOn ? 'bg-yellow-300 text-slate-900' : 'bg-slate-800/80 text-slate-100'
            }`}
          >
            {torchOn ? 'FLASH ON' : 'FLASH'}
          </button>
        )}

        {active && caps?.zoom && (
          <div className="absolute top-3 left-3 px-2 py-1 text-xs rounded bg-slate-800/80 font-mono">
            {zoom.toFixed(1)}×
          </div>
        )}

        {focusRing && (
          <div
            key={focusRing.key}
            className={`absolute pointer-events-none w-16 h-16 rounded-full border-2 ${
              focusRing.ok ? 'border-yellow-300' : 'border-red-400'
            }`}
            style={{ top: focusRing.y - 32, left: focusRing.x - 32 }}
          />
        )}

        {active && caps && (
          <details className="absolute bottom-2 left-2 max-w-[90%] bg-slate-800/90 text-xs rounded p-1 font-mono">
            <summary className="cursor-pointer px-1">caps</summary>
            <pre className="mt-1 whitespace-pre-wrap break-words max-h-40 overflow-auto">
              {JSON.stringify(caps.raw, null, 2)}
            </pre>
          </details>
        )}
      </div>

      <div className="p-4 flex items-center justify-between gap-3 border-t border-slate-700 shrink-0">
        <button
          type="button"
          onClick={shoot}
          disabled={!active || capturing}
          className={captureBtnClass}
        >
          {capturing ? '…' : (captureLabel ?? 'Capture')}
        </button>
        <div className="text-xs opacity-60 text-center flex-1">tap preview to focus</div>
        <button
          type="button"
          onClick={shoot}
          disabled={!active || capturing}
          className={captureBtnClass}
        >
          {capturing ? '…' : (captureLabel ?? 'Capture')}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-900/40 text-red-200 text-sm break-words shrink-0">{error}</div>
      )}
    </div>
  )
}
