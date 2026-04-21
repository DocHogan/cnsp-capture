interface Props {
  onStart: () => void
  busy: boolean
}

export function SeriesStart({ onStart, busy }: Props) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <button
        type="button"
        onClick={onStart}
        disabled={busy}
        className="px-8 py-6 rounded-xl bg-red-600 disabled:bg-slate-700 font-semibold text-xl"
      >
        {busy ? 'Starting…' : 'Start series'}
      </button>
    </div>
  )
}
