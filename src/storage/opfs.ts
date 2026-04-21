async function getRoot(): Promise<FileSystemDirectoryHandle> {
  if (!navigator.storage?.getDirectory) {
    throw new Error('OPFS unavailable (navigator.storage.getDirectory missing)')
  }
  return await navigator.storage.getDirectory()
}

function splitPath(path: string): string[] {
  return path.split('/').filter(Boolean)
}

async function resolveDir(
  segments: string[],
  opts: { create: boolean } = { create: true },
): Promise<FileSystemDirectoryHandle> {
  let dir = await getRoot()
  for (const seg of segments) {
    dir = await dir.getDirectoryHandle(seg, { create: opts.create })
  }
  return dir
}

export async function writeBlob(path: string, blob: Blob): Promise<void> {
  const parts = splitPath(path)
  const fileName = parts.pop()
  if (!fileName) throw new Error(`invalid path: ${path}`)
  const dir = await resolveDir(parts, { create: true })
  const fileHandle = await dir.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(blob)
  await writable.close()
}

export interface DirEntry {
  name: string
  kind: 'file' | 'directory'
}

export async function listDir(path: string): Promise<DirEntry[]> {
  const parts = splitPath(path)
  let dir: FileSystemDirectoryHandle
  try {
    dir = await resolveDir(parts, { create: false })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'NotFoundError') return []
    throw e
  }
  const entries: DirEntry[] = []
  for await (const entry of dir.values()) {
    entries.push({ name: entry.name, kind: entry.kind })
  }
  entries.sort((a, b) => a.name.localeCompare(b.name))
  return entries
}

export async function storageEstimate(): Promise<StorageEstimate> {
  return await navigator.storage.estimate()
}
