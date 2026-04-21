import { useEffect, useRef, useState } from 'react'
import { captureFrame, startRearCamera } from '../camera/capture'
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

export function CameraPreview() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamStopRef = useRef<(() => void) | null>(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [entries, setEntries] = useState<DirEntry[]>([])
  const [capturing, setCapturing] = useState(false)
  const [quota, setQuota] = useState<StorageEstimate | null>(null)

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

  async function start() {
    setError(null)
    try {
      const cam = await startRearCamera()
      streamStopRef.current = cam.stop
      const el = videoRef.current
      if (el) {
        el.srcObject = cam.stream
        await el.play()
      }
      setActive(true)
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

  return (
    <div className="flex flex-col flex-1">
      <div className="relative flex-1 bg-black min-h-[50vh]">
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
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
      </div>

      <div className="p-4 flex items-center gap-4 border-t border-slate-700">
        <button
          type="button"
          onClick={shoot}
          disabled={!active || capturing}
          className="px-5 py-3 rounded-lg bg-red-600 disabled:bg-slate-700 font-medium"
        >
          {capturing ? 'Saving…' : 'Capture'}
        </button>
        <div className="text-sm opacity-80">
          /{SMOKE_DIR}: {entries.filter((e) => e.name.endsWith('.jpg')).length} jpg
          {quota && (
            <>
              {' · '}
              {fmtBytes(quota.usage)} / {fmtBytes(quota.quota)}
            </>
          )}
        </div>
      </div>

      {entries.length > 0 && (
        <ul className="px-4 pb-4 text-xs font-mono opacity-70 max-h-32 overflow-auto">
          {entries.map((e) => (
            <li key={e.name}>
              {e.kind === 'directory' ? '📁 ' : ''}
              {e.name}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="p-3 bg-red-900/40 text-red-200 text-sm break-words">{error}</div>
      )}
    </div>
  )
}
