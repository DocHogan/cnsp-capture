interface Photo {
  name: string
  url: string
}

interface Props {
  photos: Photo[]
  onSelect?: (photo: Photo) => void
  highlighted?: string | null
}

export function ThumbnailStrip({ photos, onSelect, highlighted }: Props) {
  return (
    <div className="flex gap-2 p-2 overflow-x-auto border-t border-slate-700 shrink-0 bg-slate-950">
      {photos.map((p) => {
        const isHi = highlighted === p.name
        return (
          <button
            key={p.name}
            type="button"
            onClick={() => onSelect?.(p)}
            className={`shrink-0 relative rounded overflow-hidden ${
              isHi ? 'ring-2 ring-yellow-300' : ''
            }`}
          >
            <img
              src={p.url}
              alt={p.name}
              className="h-16 w-16 object-cover block"
              loading="lazy"
            />
            <span className="absolute bottom-0 right-0 text-[10px] font-mono bg-slate-900/80 px-1 rounded-tl">
              {p.name.replace('.jpg', '')}
            </span>
          </button>
        )
      })}
    </div>
  )
}
