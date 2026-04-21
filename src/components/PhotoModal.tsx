import { useEffect, useState } from 'react'

interface Photo {
  name: string
  url: string
}

interface Props {
  photo: Photo
  onClose: () => void
  onDelete: () => Promise<void>
  onRetake: () => void
}

export function PhotoModal({ photo, onClose, onDelete, onRetake }: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!confirmingDelete) return
    const t = window.setTimeout(() => setConfirmingDelete(false), 3000)
    return () => window.clearTimeout(t)
  }, [confirmingDelete])

  async function handleDeleteClick() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setDeleting(true)
    try {
      await onDelete()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/95 z-20 flex flex-col">
      <div className="p-3 flex justify-between items-center shrink-0 border-b border-slate-700">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded bg-slate-700 text-sm"
        >
          Close
        </button>
        <div className="font-mono text-sm">{photo.name}</div>
        <div className="w-[72px]" />
      </div>

      <div className="flex-1 flex items-center justify-center p-2 min-h-0">
        <img
          src={photo.url}
          alt={photo.name}
          className="max-w-full max-h-full object-contain"
        />
      </div>

      <div className="p-3 grid grid-cols-2 gap-3 shrink-0 border-t border-slate-700">
        <button
          type="button"
          onClick={handleDeleteClick}
          disabled={deleting}
          className={`py-3 rounded-lg font-medium ${
            confirmingDelete ? 'bg-red-800' : 'bg-slate-700'
          } disabled:opacity-50`}
        >
          {deleting ? 'Deleting…' : confirmingDelete ? 'Tap again to delete' : 'Delete'}
        </button>
        <button
          type="button"
          onClick={onRetake}
          className="py-3 rounded-lg bg-red-600 font-medium"
        >
          Retake
        </button>
      </div>
    </div>
  )
}
