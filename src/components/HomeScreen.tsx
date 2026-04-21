import { useEffect, useState } from 'react'
import {
  deleteSession,
  getLastSessionId,
  listSessions,
  loadSession,
  type Session,
  type SessionSummary,
} from '../session/session'
import { exportSessionAsZip } from '../export/zip'

interface Props {
  onOpenSession: (session: Session) => void
  onNewSession: () => Promise<void>
  refreshKey?: number
}

function fmtLocalDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function HomeScreen({ onOpenSession, onNewSession, refreshKey }: Props) {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [lastId, setLastId] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const list = await listSessions()
      setSessions(list)
      setLastId(getLastSessionId())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [refreshKey])

  useEffect(() => {
    if (!confirmDelete) return
    const id = window.setTimeout(() => setConfirmDelete(null), 3000)
    return () => window.clearTimeout(id)
  }, [confirmDelete])

  async function handleStartNew() {
    if (starting) return
    setStarting(true)
    setError(null)
    try {
      await onNewSession()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setStarting(false)
    }
  }

  async function handleResumeLast() {
    if (!lastId) return
    try {
      const s = await loadSession(lastId)
      if (s) onOpenSession(s)
      else {
        setError(`last session ${lastId} not found`)
        await refresh()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleOpen(summary: SessionSummary) {
    try {
      const s = await loadSession(summary.id)
      if (s) onOpenSession(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleExport(id: string) {
    if (exportingId) return
    setExportingId(id)
    try {
      await exportSessionAsZip(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setExportingId(null)
    }
  }

  async function handleDelete(id: string) {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      return
    }
    try {
      await deleteSession(id)
      setConfirmDelete(null)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const lastIsResumable =
    lastId !== null && sessions.some((s) => s.id === lastId && !s.endedAt)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="p-4 flex flex-col gap-3 shrink-0 border-b border-slate-700">
        <button
          type="button"
          onClick={handleStartNew}
          disabled={starting}
          className="w-full py-4 rounded-xl bg-red-600 disabled:bg-slate-700 font-semibold text-lg"
        >
          {starting ? 'Starting…' : 'Start new session'}
        </button>
        {lastIsResumable && (
          <button
            type="button"
            onClick={handleResumeLast}
            className="w-full py-3 rounded-lg bg-slate-700 text-sm"
          >
            Resume last ({lastId})
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {loading && <div className="p-4 text-sm opacity-60">Loading sessions…</div>}
        {!loading && sessions.length === 0 && (
          <div className="p-4 text-sm opacity-60">No sessions yet.</div>
        )}
        {!loading && sessions.length > 0 && (
          <ul className="divide-y divide-slate-800">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="p-3 flex items-center gap-3 hover:bg-slate-800/40 active:bg-slate-800/60"
              >
                <button
                  type="button"
                  onClick={() => handleOpen(s)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="font-mono text-xs opacity-60 truncate">{s.id}</div>
                  <div className="text-sm mt-0.5">{fmtLocalDate(s.createdAt)}</div>
                  <div className="text-xs opacity-70 mt-0.5">
                    {s.seriesCount} {s.seriesCount === 1 ? 'series' : 'series'} ·{' '}
                    {s.totalPhotos} {s.totalPhotos === 1 ? 'photo' : 'photos'}
                    {s.endedAt ? '' : ' · open'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleExport(s.id)}
                  disabled={exportingId !== null || s.totalPhotos === 0}
                  className="px-2 py-1 rounded text-xs shrink-0 bg-slate-700 disabled:bg-slate-800"
                >
                  {exportingId === s.id ? 'zipping…' : 'export'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(s.id)}
                  className={`px-2 py-1 rounded text-xs shrink-0 ${
                    confirmDelete === s.id ? 'bg-red-800' : 'bg-slate-700'
                  }`}
                >
                  {confirmDelete === s.id ? 'tap again' : 'delete'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-900/40 text-red-200 text-sm break-words shrink-0">{error}</div>
      )}
    </div>
  )
}
