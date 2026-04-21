declare global {
  interface FileSystemDirectoryHandle {
    values(): AsyncIterableIterator<FileSystemHandle>
    keys(): AsyncIterableIterator<string>
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>
    [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>
  }

  interface MediaTrackCapabilities {
    torch?: boolean
    zoom?: { min: number; max: number; step: number }
    focusMode?: string[]
    pointsOfInterest?: { x: number; y: number }[]
    exposureCompensation?: { min: number; max: number; step: number }
  }

  interface MediaTrackConstraintSet {
    torch?: ConstrainBoolean
    zoom?: ConstrainDouble
    focusMode?: ConstrainDOMString
    pointsOfInterest?: { x: number; y: number }[]
    exposureCompensation?: ConstrainDouble
  }
}

export {}
