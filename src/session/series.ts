import { deleteFile, listDir, readBlob, readJson, writeBlob, writeJson } from '../storage/opfs'

export interface Series {
  id: string
  folder: string
  createdAt: string
  photoCount: number
}

export interface SeriesMeta {
  id: string
  createdAt: string
  endedAt?: string
  shotCount: number
  upc?: string
  name?: string
}

interface SessionRef {
  id: string
  folder: string
}

// Temporary: one session per app load. M4 replaces this with real session
// management across reloads.
let currentSession: SessionRef | null = null

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

async function ensureSession(): Promise<SessionRef> {
  if (currentSession) return currentSession
  const iso = new Date().toISOString().replace(/[:.]/g, '-')
  const id = `session-${iso}`
  const folder = `sessions/${id}`
  await writeJson(`${folder}/meta.json`, {
    id,
    createdAt: new Date().toISOString(),
    seriesCount: 0,
    totalPhotos: 0,
  })
  currentSession = { id, folder }
  return currentSession
}

export async function startSeries(): Promise<Series> {
  const session = await ensureSession()
  const now = new Date()
  const hhmmss = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`
  const id = `unlabeled-${hhmmss}`
  const folder = `${session.folder}/${id}`
  const meta: SeriesMeta = {
    id,
    createdAt: now.toISOString(),
    shotCount: 0,
  }
  await writeJson(`${folder}/meta.json`, meta)
  return { id, folder, createdAt: meta.createdAt, photoCount: 0 }
}

export async function endSeries(series: Series): Promise<void> {
  const metaPath = `${series.folder}/meta.json`
  const current = await readJson<SeriesMeta>(metaPath)
  await writeJson(metaPath, {
    ...current,
    endedAt: new Date().toISOString(),
    shotCount: series.photoCount,
  })
}

export async function writePhoto(
  series: Series,
  blob: Blob,
  overrideName?: string,
): Promise<{ index: number; name: string }> {
  if (overrideName) {
    await writeBlob(`${series.folder}/${overrideName}`, blob)
    const match = /^(\d+)\.jpg$/.exec(overrideName)
    const index = match ? parseInt(match[1], 10) : 0
    return { index, name: overrideName }
  }
  const index = series.photoCount + 1
  const name = `${String(index).padStart(3, '0')}.jpg`
  await writeBlob(`${series.folder}/${name}`, blob)
  return { index, name }
}

export async function deletePhoto(series: Series, name: string): Promise<void> {
  await deleteFile(`${series.folder}/${name}`)
}

export async function listSeriesPhotos(series: Series): Promise<string[]> {
  const entries = await listDir(series.folder)
  return entries.filter((e) => e.kind === 'file' && e.name.endsWith('.jpg')).map((e) => e.name)
}

export async function readPhotoBlob(series: Series, name: string): Promise<Blob> {
  return await readBlob(`${series.folder}/${name}`)
}
