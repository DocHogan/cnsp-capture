import {
  deleteFile,
  listDir,
  readBlob,
  readJson,
  removeDir,
  writeBlob,
  writeJson,
} from '../storage/opfs'
import type { Session } from './session'

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
}

export interface SeriesSummary extends Series {
  endedAt?: string
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function hhmmss(d: Date): string {
  return `${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
}

export async function startSeries(session: Session): Promise<Series> {
  const now = new Date()
  const id = `series-${hhmmss(now)}`
  const folder = `${session.folder}/${id}`
  const meta: SeriesMeta = {
    id,
    createdAt: now.toISOString(),
    shotCount: 0,
  }
  await writeJson(`${folder}/meta.json`, meta)
  return { id, folder, createdAt: meta.createdAt, photoCount: 0 }
}

/**
 * Close out a series. Updates `meta.json` with `endedAt` and the final
 * `shotCount`. Identification and canonical rename happen off-device after
 * zip export.
 */
export async function finalizeSeries(series: Series): Promise<Series> {
  const metaPath = `${series.folder}/meta.json`
  const current = await readJson<SeriesMeta>(metaPath)
  await writeJson(metaPath, {
    ...current,
    endedAt: new Date().toISOString(),
    shotCount: series.photoCount,
  })
  return series
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
  return entries
    .filter((e) => e.kind === 'file' && e.name.endsWith('.jpg'))
    .map((e) => e.name)
}

export async function readPhotoBlob(series: Series, name: string): Promise<Blob> {
  return await readBlob(`${series.folder}/${name}`)
}

export async function listSeriesInSession(session: Session): Promise<SeriesSummary[]> {
  const entries = await listDir(session.folder)
  const out: SeriesSummary[] = []
  for (const entry of entries) {
    if (entry.kind !== 'directory') continue
    if (!entry.name.startsWith('series-')) continue
    const folder = `${session.folder}/${entry.name}`
    let meta: SeriesMeta
    try {
      meta = await readJson<SeriesMeta>(`${folder}/meta.json`)
    } catch {
      continue
    }
    const photos = await listDir(folder)
    const shotCount = photos.filter(
      (e) => e.kind === 'file' && e.name.endsWith('.jpg'),
    ).length
    out.push({
      id: entry.name,
      folder,
      createdAt: meta.createdAt,
      endedAt: meta.endedAt,
      photoCount: shotCount,
    })
  }
  out.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return out
}

export async function deleteSeriesFolder(session: Session, seriesId: string): Promise<void> {
  await removeDir(`${session.folder}/${seriesId}`)
}
