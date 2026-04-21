import { zip } from 'fflate'
import { listDir, readBlob } from '../storage/opfs'

type ZipTree = Record<string, Uint8Array>

async function walk(fsPath: string, zipPath: string, tree: ZipTree): Promise<void> {
  const entries = await listDir(fsPath)
  for (const entry of entries) {
    const nextFs = `${fsPath}/${entry.name}`
    const nextZip = zipPath ? `${zipPath}/${entry.name}` : entry.name
    if (entry.kind === 'file') {
      const blob = await readBlob(nextFs)
      tree[nextZip] = new Uint8Array(await blob.arrayBuffer())
    } else if (entry.kind === 'directory') {
      await walk(nextFs, nextZip, tree)
    }
  }
}

/**
 * Build a Blob zip of the given session folder. Zip root contains the
 * session folder (so it unpacks as `{sessionId}/series-.../NNN.jpg`).
 * Photos are stored uncompressed-ish by fflate defaults since JPEGs don't
 * benefit from further compression.
 */
export async function buildSessionZip(sessionId: string): Promise<Blob> {
  const tree: ZipTree = {}
  await walk(`sessions/${sessionId}`, sessionId, tree)
  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    zip(tree, { level: 0 }, (err, data) => {
      if (err) reject(err)
      else resolve(data)
    })
  })
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportSessionAsZip(sessionId: string): Promise<void> {
  const blob = await buildSessionZip(sessionId)
  const filename = `cnsp-${sessionId}.zip`
  const file = new File([blob], filename, { type: 'application/zip' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return
    } catch (e) {
      // AbortError = user dismissed the share sheet; don't fall through.
      if (e instanceof Error && e.name === 'AbortError') return
      // Any other share failure: fall through to the download path.
    }
  }
  triggerDownload(blob, filename)
}
