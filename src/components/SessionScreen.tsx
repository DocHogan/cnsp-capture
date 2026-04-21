import { useEffect, useState } from 'react'
import {
  deleteSeriesFolder,
  listSeriesInSession,
  startSeries,
  type Series,
  type SeriesSummary,
} from '../session/series'
import { endSession, type Session } from '../session/session'

interface Props {
  session: Session
  onStartSeries: (series: Series) => void
  onEndSession: () => void
}

function fmtLocalTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return iso
  }
}

export function SessionScreen({ session, onStartSeries, onEndSession }: Props) {
  const [series, setSeries] = useState<SeriesSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmEndSession, setConfirmEndSession] = useState(false)
  const [confirmDeleteSeries, setConfirmDeleteSeries] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const list = await listSeriesInSession(session)
      setSeries(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [session.folder])

  useEffect(() => {
    if (!confirmEndSession) return
    const id = window.setTimeout(() => setConfirmEndSession(false), 3000)
    return () => window.clearTimeout(id)
  }, [confirmEndSession])

  useEffect(() => {
    if (!confirmDeleteSeries) return
    const id = window.setTimeout(() => setConfirmDeleteSeries(null), 3000)
    return () => window.clearTimeout(id)
  }, [confirmDeleteSeries])

  async function handleStartSeries() {
    if (starting) return
    setStarting(true)
    setError(null)
    try {
      const s = await startSeries(session)
      onStartSeries(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setStarting(false)
    }
  }

  async function handleEndSession() {
    if (!confirmEndSession) {
      setConfirmEndSession(true)
      return
    }
    if (ending) return
    setEnding(true)
    try {
      await endSession(session)
      onEndSession()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setEnding(false)
    }
  }

  async function handleDeleteSeries(seriesId: string) {
    if (confirmDeleteSeries !== seriesId) {
      setConfirmDeleteSeries(seriesId)
      return
    }
    try {
      await deleteSeriesFolder(session, seriesId)
      setConfirmDeleteSeries(null)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="p-3 flex flex-col gap-1 shrink-0 border-b border-slate-700">
        <div className="text-xs opacity-60">session</div>
        <div className="font-mono text-xs break-all">{session.id}</div>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {loading && <div className="p-4 text-sm opacity-60">Loading series…</div>}
        {!loading && series.length === 0 && (
          <div className="p-4 text-sm opacity-60">No series yet. Tap Start series below.</div>
        )}
        {!loading && series.length > 0 && (
          <ul className="divide-y divide-slate-800">
            {series.map((s) => (
              <li key={s.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm truncate">{s.id}</div>
                  <div className="text-xs opacity-70 mt-0.5">
                    {fmtLocalTime(s.createdAt)} · {s.photoCount}{' '}
                    {s.photoCount === 1 ? 'photo' : 'photos'}
                    {s.endedAt ? '' : ' · open'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteSeries(s.id)}
                  className={`px-2 py-1 rounded text-xs shrink-0 ${
                    confirmDeleteSeries === s.id ? 'bg-red-800' : 'bg-slate-700'
                  }`}
                >
                  {confirmDeleteSeries === s.id ? 'tap again' : 'delete'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="p-3 flex gap-3 shrink-0 border-t border-slate-700">
        <button
          type="button"
          onClick={handleEndSession}
          disabled={ending}
          className={`px-3 py-2 rounded text-sm shrink-0 ${
            confirmEndSession ? 'bg-red-800' : 'bg-slate-700'
          }`}
        >
          {ending ? 'Ending…' : confirmEndSession ? 'Tap again to end' : 'End session'}
        </button>
        <button
          type="button"
          onClick={handleStartSeries}
          disabled={starting || !!session.endedAt}
          className="flex-1 py-2 rounded-lg bg-red-600 disabled:bg-slate-700 font-semibold"
        >
          {starting ? 'Starting…' : session.endedAt ? 'Session ended' : 'Start series'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-900/40 text-red-200 text-sm break-words shrink-0">{error}</div>
      )}
    </div>
  )
}
