import { useEffect, useState } from 'react'
import { getDb } from './db'
import { runMigrations } from '@zettelkasten/core'
import type { Database, Note } from '@zettelkasten/core'
import Sidebar from './components/Sidebar'
import InboxScreen from './screens/InboxScreen'
import ReviewScreen from './screens/ReviewScreen'
import GraphScreen from './screens/GraphScreen'

export type Screen = 'inbox' | 'review' | 'library' | 'graph'

export default function App() {
  const [db, setDb] = useState<Database | null>(null)
  const [dbError, setDbError] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>('inbox')
  const [inboxCount, setInboxCount] = useState(0)
  const [pendingReviewNote, setPendingReviewNote] = useState<Note | null>(null)

  useEffect(() => {
    getDb().then(async (database) => {
      await runMigrations(database)
      setDb(database)
    }).catch((err) => {
      setDbError(String(err))
    })
  }, [])

  useEffect(() => {
    const handleReview = (e: Event) => {
      const note = (e as CustomEvent<Note>).detail
      setPendingReviewNote(note)
      setScreen('review')
    }
    const handleNewLiterature = () => setScreen('review')
    const handleNewPermanent = () => setScreen('review')
    window.addEventListener('zettel:review', handleReview)
    window.addEventListener('zettel:new-literature', handleNewLiterature)
    window.addEventListener('zettel:new-permanent', handleNewPermanent)
    return () => {
      window.removeEventListener('zettel:review', handleReview)
      window.removeEventListener('zettel:new-literature', handleNewLiterature)
      window.removeEventListener('zettel:new-permanent', handleNewPermanent)
    }
  }, [])

  if (dbError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#ff6b81', fontSize: 13, padding: 24, textAlign: 'center' }}>
        Database error: {dbError}
      </div>
    )
  }

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
        {screen === 'review' && (
          <ReviewScreen
            db={db}
            pendingNote={pendingReviewNote}
            onNoteConsumed={() => setPendingReviewNote(null)}
          />
        )}
        {screen === 'graph' && <GraphScreen db={db} />}
      </main>
    </div>
  )
}
