import { useCallback, useEffect, useRef, useState } from 'react'
import { CameraPreview } from './CameraPreview'
import { PhotoModal } from './PhotoModal'
import { ThumbnailStrip } from './ThumbnailStrip'
import { deletePhoto, endSeries, writePhoto, type Series } from '../session/series'

interface Photo {
  name: string
  url: string
}

interface Props {
  series: Series
  onEnd: () => void
}

export function SeriesScreen({ series: initial, onEnd }: Props) {
  const [series, setSeries] = useState(initial)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [ending, setEnding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalPhoto, setModalPhoto] = useState<Photo | null>(null)
  const [retakeName, setRetakeName] = useState<string | null>(null)
  const urlsRef = useRef<string[]>([])

  useEffect(() => {
    return () => {
      for (const url of urlsRef.current) URL.revokeObjectURL(url)
      urlsRef.current = []
    }
  }, [])

  const handleCapture = useCallback(
    async (blob: Blob) => {
      const override = retakeName ?? undefined
      const { index, name } = await writePhoto(series, blob, override)
      const url = URL.createObjectURL(blob)
      urlsRef.current.push(url)
      if (override) {
        setPhotos((prev) =>
          prev.map((p) => {
            if (p.name !== name) return p
            URL.revokeObjectURL(p.url)
            urlsRef.current = urlsRef.current.filter((u) => u !== p.url)
            return { name, url }
          }),
        )
        setRetakeName(null)
      } else {
        setSeries((s) => ({ ...s, photoCount: Math.max(s.photoCount, index) }))
        setPhotos((prev) => [...prev, { name, url }])
      }
    },
    [series, retakeName],
  )

  async function handleDelete(photo: Photo) {
    try {
      await deletePhoto(series, photo.name)
      URL.revokeObjectURL(photo.url)
      urlsRef.current = urlsRef.current.filter((u) => u !== photo.url)
      setPhotos((prev) => prev.filter((p) => p.name !== photo.name))
      if (retakeName === photo.name) setRetakeName(null)
      setModalPhoto(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function handleRetakeFromModal(photo: Photo) {
    setRetakeName(photo.name)
    setModalPhoto(null)
  }

  async function handleEnd() {
    if (ending) return
    setEnding(true)
    try {
      await endSeries({ ...series, photoCount: photos.length })
      onEnd()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setEnding(false)
    }
  }

  const retakeLabel = retakeName ? `Retake ${retakeName.replace('.jpg', '')}` : undefined

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="p-3 flex justify-between items-center border-b border-slate-700 shrink-0 gap-3">
        <div className="min-w-0">
          <div className="text-xs opacity-60">series</div>
          <div className="font-mono text-sm truncate">{series.id}</div>
        </div>
        <div className="text-sm opacity-80 shrink-0">
          {photos.length} {photos.length === 1 ? 'shot' : 'shots'}
        </div>
        <button
          type="button"
          onClick={handleEnd}
          disabled={ending}
          className="px-3 py-1.5 rounded bg-slate-700 disabled:bg-slate-800 text-sm shrink-0"
        >
          {ending ? 'Ending…' : 'End series'}
        </button>
      </div>

      {retakeName && (
        <div className="px-3 py-2 flex items-center justify-between gap-3 bg-yellow-500/20 border-b border-yellow-500/40 text-sm shrink-0">
          <div>
            Retaking <span className="font-mono">{retakeName}</span> — next capture replaces it.
          </div>
          <button
            type="button"
            onClick={() => setRetakeName(null)}
            className="px-2 py-1 rounded bg-slate-700 text-xs shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      <CameraPreview onCapture={handleCapture} captureLabel={retakeLabel} />

      {photos.length > 0 && (
        <ThumbnailStrip
          photos={photos}
          onSelect={setModalPhoto}
          highlighted={retakeName}
        />
      )}

      {error && (
        <div className="p-3 bg-red-900/40 text-red-200 text-sm break-words shrink-0">{error}</div>
      )}

      {modalPhoto && (
        <PhotoModal
          photo={modalPhoto}
          onClose={() => setModalPhoto(null)}
          onDelete={() => handleDelete(modalPhoto)}
          onRetake={() => handleRetakeFromModal(modalPhoto)}
        />
      )}
    </div>
  )
}
