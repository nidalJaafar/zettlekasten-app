import { useEffect, useState } from 'react'
import { getDb } from './db'
import { runMigrations } from '@zettelkasten/core'
import Sidebar from './components/Sidebar'
import InboxScreen from './screens/InboxScreen'
import ReviewScreen from './screens/ReviewScreen'
import GraphScreen from './screens/GraphScreen'
import type { Database } from '@zettelkasten/core'

export type Screen = 'inbox' | 'review' | 'graph'

export default function App() {
  const [db, setDb] = useState<Database | null>(null)
  const [screen, setScreen] = useState<Screen>('inbox')
  const [inboxCount, setInboxCount] = useState(0)

  useEffect(() => {
    getDb().then(async (database) => {
      await runMigrations(database)
      setDb(database)
    })
  }, [])

  useEffect(() => {
    const handleNewLiterature = () => setScreen('review')
    const handleNewPermanent = () => setScreen('review')
    const handleOpenNote = () => setScreen('review')
    window.addEventListener('zettel:new-literature', handleNewLiterature)
    window.addEventListener('zettel:new-permanent', handleNewPermanent)
    window.addEventListener('zettel:open-note', handleOpenNote)
    return () => {
      window.removeEventListener('zettel:new-literature', handleNewLiterature)
      window.removeEventListener('zettel:new-permanent', handleNewPermanent)
      window.removeEventListener('zettel:open-note', handleOpenNote)
    }
  }, [])

  if (!db) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#7f8fa6' }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar current={screen} onNavigate={setScreen} inboxCount={inboxCount} />
      <main style={{ flex: 1, overflow: 'hidden' }}>
        {screen === 'inbox' && <InboxScreen db={db} onCountChange={setInboxCount} />}
        {screen === 'review' && <ReviewScreen db={db} />}
        {screen === 'graph' && <GraphScreen db={db} />}
      </main>
    </div>
  )
}
