import { listDir, readJson, removeDir, writeJson } from '../storage/opfs'

export interface Session {
  id: string
  folder: string
  createdAt: string
  endedAt?: string
}

export interface SessionMeta {
  id: string
  createdAt: string
  endedAt?: string
}

export interface SessionSummary extends Session {
  seriesCount: number
  totalPhotos: number
}

const LAST_SESSION_KEY = 'cnsp:lastSessionId'
const ROOT = 'sessions'

function rememberLast(id: string): void {
  try {
    localStorage.setItem(LAST_SESSION_KEY, id)
  } catch {
    // localStorage unavailable (private mode, quota, etc.); not fatal.
  }
}

function forgetLast(id?: string): void {
  try {
    if (!id) {
      localStorage.removeItem(LAST_SESSION_KEY)
      return
    }
    if (localStorage.getItem(LAST_SESSION_KEY) === id) {
      localStorage.removeItem(LAST_SESSION_KEY)
    }
  } catch {
    // ignore
  }
}

export function getLastSessionId(): string | null {
  try {
    return localStorage.getItem(LAST_SESSION_KEY)
  } catch {
    return null
  }
}

export async function createSession(): Promise<Session> {
  const now = new Date()
  const iso = now.toISOString().replace(/[:.]/g, '-')
  const id = `session-${iso}`
  const folder = `${ROOT}/${id}`
  const meta: SessionMeta = {
    id,
    createdAt: now.toISOString(),
  }
  await writeJson(`${folder}/meta.json`, meta)
  rememberLast(id)
  return { id, folder, createdAt: meta.createdAt }
}

export async function loadSession(id: string): Promise<Session | null> {
  const folder = `${ROOT}/${id}`
  try {
    const meta = await readJson<SessionMeta>(`${folder}/meta.json`)
    rememberLast(id)
    return { id, folder, createdAt: meta.createdAt, endedAt: meta.endedAt }
  } catch {
    return null
  }
}

export async function endSession(session: Session): Promise<Session> {
  const metaPath = `${session.folder}/meta.json`
  const meta = await readJson<SessionMeta>(metaPath)
  const updated: SessionMeta = { ...meta, endedAt: new Date().toISOString() }
  await writeJson(metaPath, updated)
  forgetLast(session.id)
  return { ...session, endedAt: updated.endedAt }
}

export async function deleteSession(id: string): Promise<void> {
  await removeDir(`${ROOT}/${id}`)
  forgetLast(id)
}

export async function listSessions(): Promise<SessionSummary[]> {
  const entries = await listDir(ROOT)
  const out: SessionSummary[] = []
  for (const entry of entries) {
    if (entry.kind !== 'directory') continue
    if (!entry.name.startsWith('session-')) continue
    const folder = `${ROOT}/${entry.name}`
    let meta: SessionMeta
    try {
      meta = await readJson<SessionMeta>(`${folder}/meta.json`)
    } catch {
      continue
    }
    const inner = await listDir(folder)
    const seriesDirs = inner.filter((e) => e.kind === 'directory' && e.name.startsWith('series-'))
    let totalPhotos = 0
    for (const sd of seriesDirs) {
      const photos = await listDir(`${folder}/${sd.name}`)
      totalPhotos += photos.filter(
        (e) => e.kind === 'file' && e.name.endsWith('.jpg'),
      ).length
    }
    out.push({
      id: entry.name,
      folder,
      createdAt: meta.createdAt,
      endedAt: meta.endedAt,
      seriesCount: seriesDirs.length,
      totalPhotos,
    })
  }
  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return out
}
