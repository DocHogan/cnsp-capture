import { useState } from 'react'
import { HomeScreen } from './components/HomeScreen'
import { SeriesScreen } from './components/SeriesScreen'
import { SessionScreen } from './components/SessionScreen'
import { createSession, type Session } from './session/session'
import type { Series } from './session/series'

type Screen =
  | { kind: 'home' }
  | { kind: 'session'; session: Session }
  | { kind: 'series'; session: Session; series: Series }

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'home' })
  const [homeRefreshKey, setHomeRefreshKey] = useState(0)

  async function handleNewSession() {
    const session = await createSession()
    setScreen({ kind: 'session', session })
  }

  function handleOpenSession(session: Session) {
    setScreen({ kind: 'session', session })
  }

  function handleStartSeries(series: Series) {
    if (screen.kind !== 'session') return
    setScreen({ kind: 'series', session: screen.session, series })
  }

  function handleEndSeries() {
    if (screen.kind !== 'series') return
    setScreen({ kind: 'session', session: screen.session })
  }

  function handleEndSession() {
    setScreen({ kind: 'home' })
    setHomeRefreshKey((k) => k + 1)
  }

  return (
    <main className="h-dvh flex flex-col overflow-hidden">
      <header className="p-4 border-b border-slate-700 shrink-0 flex items-center gap-3">
        {screen.kind !== 'home' && (
          <button
            type="button"
            onClick={() => {
              if (screen.kind === 'series') handleEndSeries()
              else setScreen({ kind: 'home' })
            }}
            className="px-2 py-1 rounded bg-slate-700 text-sm shrink-0"
          >
            Back
          </button>
        )}
        <h1 className="text-lg font-semibold">CNSP Capture</h1>
      </header>

      {screen.kind === 'home' && (
        <HomeScreen
          onOpenSession={handleOpenSession}
          onNewSession={handleNewSession}
          refreshKey={homeRefreshKey}
        />
      )}
      {screen.kind === 'session' && (
        <SessionScreen
          session={screen.session}
          onStartSeries={handleStartSeries}
          onEndSession={handleEndSession}
        />
      )}
      {screen.kind === 'series' && (
        <SeriesScreen series={screen.series} onEnd={handleEndSeries} />
      )}
    </main>
  )
}
