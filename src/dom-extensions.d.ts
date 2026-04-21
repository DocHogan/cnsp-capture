declare global {
  interface FileSystemDirectoryHandle {
    values(): AsyncIterableIterator<FileSystemHandle>
    keys(): AsyncIterableIterator<string>
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>
    [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>
  }
}

export {}
