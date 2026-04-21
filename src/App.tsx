import { useState } from 'react'
import { SeriesScreen } from './components/SeriesScreen'
import { SeriesStart } from './components/SeriesStart'
import { startSeries, type Series } from './session/series'

export function App() {
  const [series, setSeries] = useState<Series | null>(null)
  const [lastSeries, setLastSeries] = useState<Series | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleStart() {
    if (starting) return
    setStarting(true)
    setError(null)
    try {
      const s = await startSeries()
      setSeries(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setStarting(false)
    }
  }

  function handleEnd(finalSeries: Series) {
    setLastSeries(finalSeries)
    setSeries(null)
  }

  return (
    <main className="h-dvh flex flex-col overflow-hidden">
      <header className="p-4 border-b border-slate-700 shrink-0">
        <h1 className="text-lg font-semibold">CNSP Capture</h1>
      </header>
      {series ? (
        <SeriesScreen series={series} onEnd={handleEnd} />
      ) : (
        <SeriesStart onStart={handleStart} busy={starting} lastSeries={lastSeries} />
      )}
      {error && !series && (
        <div className="p-3 bg-red-900/40 text-red-200 text-sm break-words shrink-0">{error}</div>
      )}
    </main>
  )
}
