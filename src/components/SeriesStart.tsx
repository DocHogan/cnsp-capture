import type { Series } from '../session/series'

interface Props {
  onStart: () => void
  busy: boolean
  lastSeries?: Series | null
}

export function SeriesStart({ onStart, busy, lastSeries }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 gap-6">
      <button
        type="button"
        onClick={onStart}
        disabled={busy}
        className="px-8 py-6 rounded-xl bg-red-600 disabled:bg-slate-700 font-semibold text-xl"
      >
        {busy ? 'Starting…' : 'Start series'}
      </button>
      {lastSeries && (
        <div className="text-sm opacity-70 text-center">
          <div className="opacity-70">last saved as</div>
          <div className="font-mono mt-1 break-all">{lastSeries.id}</div>
          <div className="text-xs opacity-60 mt-1">
            {lastSeries.photoCount} {lastSeries.photoCount === 1 ? 'photo' : 'photos'}
          </div>
        </div>
      )}
    </div>
  )
}
