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
import { listDir, storageEstimate, writeBlob, type DirEntry } from '../storage/opfs'

const SMOKE_DIR = 'smoke-test'

function fmtBytes(n: number | undefined): string {
  if (n == null) return '?'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = n
  let u = 0
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024
    u++
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[u]}`
}

function touchDistance(
  a: { clientX: number; clientY: number },
  b: { clientX: number; clientY: number },
): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

interface FocusRing {
  x: number
  y: number
  key: number
  ok: boolean
}

/**
 * Map a container-relative tap to normalized [0,1] coords in the video's sensor
 * frame, accounting for object-contain letterboxing. Returns null if the tap
 * landed in the letterbox (outside the rendered video).
 */
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

export function CameraPreview() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const streamStopRef = useRef<(() => void) | null>(null)
  const tapStartRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null)

  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [entries, setEntries] = useState<DirEntry[]>([])
  const [capturing, setCapturing] = useState(false)
  const [quota, setQuota] = useState<StorageEstimate | null>(null)
  const [caps, setCaps] = useState<CameraCaps | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [zoom, setZoomLevel] = useState(1)
  const [focusRing, setFocusRing] = useState<FocusRing | null>(null)

  async function refreshList() {
    try {
      setEntries(await listDir(SMOKE_DIR))
      setQuota(await storageEstimate())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    void refreshList()
    return () => {
      streamStopRef.current?.()
    }
  }, [])

  useEffect(() => {
    if (!focusRing) return
    const id = window.setTimeout(() => setFocusRing(null), 700)
    return () => window.clearTimeout(id)
  }, [focusRing])

  async function start() {
    setError(null)
    try {
      const cam = await startRearCamera()
      streamStopRef.current = cam.stop
      const track = cam.stream.getVideoTracks()[0] ?? null
      trackRef.current = track
      const el = videoRef.current
      if (el) {
        el.srcObject = cam.stream
        await el.play()
      }
      setActive(true)
      if (track) {
        const c = getCameraCaps(track)
        setCaps(c)
        if (c.zoom) setZoomLevel(c.zoom.min)
      }
    } catch (e) {
      setError(e instanceof Error ? `${e.name}: ${e.message}` : String(e))
    }
  }

  async function shoot() {
    if (!videoRef.current || capturing) return
    setCapturing(true)
    try {
      const blob = await captureFrame(videoRef.current)
      const existingJpgs = entries.filter((e) => e.name.endsWith('.jpg')).length
      const idx = String(existingJpgs + 1).padStart(3, '0')
      await writeBlob(`${SMOKE_DIR}/${idx}.jpg`, blob)
      await refreshList()
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

  const jpgCount = entries.filter((e) => e.name.endsWith('.jpg')).length

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

        {!active && (
          <button
            type="button"
            onClick={start}
            className="absolute inset-0 m-auto h-12 w-44 rounded-lg bg-slate-100 text-slate-900 font-medium"
          >
            Start camera
          </button>
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
          {capturing ? '…' : 'Capture'}
        </button>
        <div className="text-xs opacity-80 text-center flex-1">
          <div>
            /{SMOKE_DIR}: {jpgCount} jpg
          </div>
          {quota && (
            <div className="opacity-60">
              {fmtBytes(quota.usage)} / {fmtBytes(quota.quota)}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={shoot}
          disabled={!active || capturing}
          className={captureBtnClass}
        >
          {capturing ? '…' : 'Capture'}
        </button>
      </div>

      {entries.length > 0 && (
        <ul className="px-4 pb-4 text-xs font-mono opacity-70 max-h-20 overflow-auto shrink-0">
          {entries.map((e) => (
            <li key={e.name}>
              {e.kind === 'directory' ? '[dir] ' : ''}
              {e.name}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="p-3 bg-red-900/40 text-red-200 text-sm break-words shrink-0">
          {error}
        </div>
      )}
    </div>
  )
}
