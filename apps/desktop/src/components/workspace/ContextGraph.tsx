import { useEffect, useMemo, useState } from 'react'
import { getNotesByType, getAllLinks } from '@zettelkasten/core'
import type { Database, Note, NoteLink } from '@zettelkasten/core'
import { buildNeighborhood } from '../../lib/graph'
import GraphCanvas from '../GraphCanvas'

interface Props {
  db: Database
  activeNote: Note
  onOpenNoteId: (noteId: string) => void
}

export default function ContextGraph({ db, activeNote, onOpenNoteId }: Props) {
  const [allNotes, setAllNotes] = useState<Note[]>([])
  const [allLinks, setAllLinks] = useState<NoteLink[]>([])

  useEffect(() => {
    Promise.all([getNotesByType(db, 'permanent'), getAllLinks(db)]).then(([n, l]) => {
      setAllNotes(n)
      setAllLinks(l)
    })
  }, [db])

  const neighborhood = useMemo(
    () => buildNeighborhood(activeNote.id, allNotes, allLinks, 2),
    [activeNote.id, allNotes, allLinks],
  )

  if (neighborhood.notes.length <= 1) return null

  return (
    <div style={{ height: 260 }}>
      <GraphCanvas
        notes={neighborhood.notes}
        links={neighborhood.links}
        onNodeClick={(note) => { onOpenNoteId(note.id) }}
        focusNoteId={activeNote.id}
        selectedNoteId={activeNote.id}
        mode="context"
      />
    </div>
  )
}
