import { CameraPreview } from './components/CameraPreview'

export function App() {
  return (
    <main className="min-h-dvh flex flex-col">
      <header className="p-4 border-b border-slate-700">
        <h1 className="text-lg font-semibold">CNSP Capture — M1 smoke test</h1>
      </header>
      <CameraPreview />
    </main>
  )
}
