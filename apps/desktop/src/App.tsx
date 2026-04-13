import { useCallback, useEffect, useState } from 'react'
import { getDb } from './db'
import { getNoteById, getNotesByType, runMigrations } from '@zettelkasten/core'
import type { Database, Note } from '@zettelkasten/core'
import Sidebar from './components/Sidebar'
import InboxScreen from './screens/InboxScreen'
import ReviewScreen from './screens/ReviewScreen'
import GraphScreen from './screens/GraphScreen'
import LibraryScreen from './screens/LibraryScreen'
import NoteWorkspace from './components/workspace/NoteWorkspace'

export type Screen = 'inbox' | 'workspace' | 'review' | 'library' | 'graph'

export type WorkspaceTarget =
  | { mode: 'note'; noteId: string }
  | { mode: 'draft'; noteType: 'literature' | 'permanent' }

export default function App() {
  const [db, setDb] = useState<Database | null>(null)
  const [dbError, setDbError] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>('inbox')
  const [inboxCount, setInboxCount] = useState(0)
  const [workspaceTarget, setWorkspaceTarget] = useState<WorkspaceTarget | null>(null)

  const refreshInboxCount = useCallback(async () => {
    if (!db) return
    const fleeting = await getNotesByType(db, 'fleeting')
    setInboxCount(fleeting.length)
  }, [db])

  const openWorkspaceNote = useCallback((note: Note) => {
    setWorkspaceTarget({ mode: 'note', noteId: note.id })
    setScreen('workspace')
  }, [])

  const openWorkspaceById = useCallback(async (noteId: string) => {
    if (!db) return
    const note = await getNoteById(db, noteId)
    if (!note) return
    openWorkspaceNote(note)
  }, [db, openWorkspaceNote])

  useEffect(() => {
    getDb().then(async (database) => {
      await runMigrations(database)
      setDb(database)
    }).catch((err) => {
      setDbError(String(err))
    })
  }, [])

  useEffect(() => {
    if (db) {
      void refreshInboxCount()
    }
  }, [db, refreshInboxCount])

  useEffect(() => {
    const handleReview = (e: Event) => {
      const note = (e as CustomEvent<Note>).detail
      openWorkspaceNote(note)
    }
    const handleNewLiterature = () => {
      setWorkspaceTarget({ mode: 'draft', noteType: 'literature' })
      setScreen('workspace')
    }
    const handleNewPermanent = () => {
      setWorkspaceTarget({ mode: 'draft', noteType: 'permanent' })
      setScreen('workspace')
    }
    const handleOpenNote = (e: Event) => {
      const note = (e as CustomEvent<Note>).detail
      openWorkspaceNote(note)
    }
    window.addEventListener('zettel:review', handleReview)
    window.addEventListener('zettel:new-literature', handleNewLiterature)
    window.addEventListener('zettel:new-permanent', handleNewPermanent)
    window.addEventListener('zettel:open-note', handleOpenNote)
    return () => {
      window.removeEventListener('zettel:review', handleReview)
      window.removeEventListener('zettel:new-literature', handleNewLiterature)
      window.removeEventListener('zettel:new-permanent', handleNewPermanent)
      window.removeEventListener('zettel:open-note', handleOpenNote)
    }
  }, [openWorkspaceNote])

  if (dbError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#b85555', fontSize: 12, padding: 24, textAlign: 'center', background: '#0b0b10', letterSpacing: '0.01em' }}>
        Database error: {dbError}
      </div>
    )
  }

  if (!db) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#45423e', background: '#0b0b10', fontSize: 12, letterSpacing: '0.05em' }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar current={screen} onNavigate={setScreen} inboxCount={inboxCount} />
      <main style={{ flex: 1, overflow: 'hidden' }}>
        {screen === 'inbox' && <InboxScreen db={db} onCountChange={setInboxCount} />}
        {screen === 'workspace' && (
          <NoteWorkspace
            db={db}
            target={workspaceTarget}
            onOpenNoteId={openWorkspaceById}
            onOpenTarget={setWorkspaceTarget}
            onInboxCountChange={refreshInboxCount}
          />
        )}
        {screen === 'review' && (
          <ReviewScreen
            db={db}
            onOpenNoteId={openWorkspaceById}
          />
        )}
        {screen === 'library' && <LibraryScreen db={db} />}
        {screen === 'graph' && <GraphScreen db={db} workspaceTarget={workspaceTarget} onOpenNoteId={openWorkspaceById} />}
      </main>
    </div>
  )
}
