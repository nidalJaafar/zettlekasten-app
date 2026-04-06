import { useEffect, useState } from 'react'
import { getAllLinks, getNotesByType } from '@zettelkasten/core'
import type { Database, Note, NoteLink } from '@zettelkasten/core'

interface Props {
  db: Database
  note: Note
  onClose: () => void
}

export default function NoteModal({ db, note, onClose }: Props) {
  const [noteLinks, setNoteLinks] = useState<NoteLink[]>([])
  const [linkedNotes, setLinkedNotes] = useState<Note[]>([])

  useEffect(() => {
    Promise.all([getAllLinks(db), getNotesByType(db, 'permanent')]).then(([allLinks, permanents]) => {
      const connected = allLinks.filter(
        (l) => l.from_note_id === note.id || l.to_note_id === note.id
      )
      const connectedIds = new Set(connected.flatMap((l) => [l.from_note_id, l.to_note_id]))
      connectedIds.delete(note.id)
      setNoteLinks(connected)
      setLinkedNotes(permanents.filter((p) => connectedIds.has(p.id)))
    })
  }, [db, note.id])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1a1a2e',
          border: '1px solid #3d3d6b',
          borderRadius: 12,
          padding: 28,
          width: 520,
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'transparent',
            border: 'none',
            color: '#555',
            fontSize: 18,
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          ✕
        </button>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#6c63ff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          Permanent note
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#e0e0ff', marginBottom: 16, paddingRight: 24 }}>
          {note.title}
        </div>

        {note.content ? (
          <div style={{ fontSize: 13, color: '#b0b0cc', lineHeight: 1.75, marginBottom: 24, whiteSpace: 'pre-wrap' }}>
            {note.content}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#555', fontStyle: 'italic', marginBottom: 24 }}>
            No content.
          </div>
        )}

        <div style={{ borderTop: '1px solid #2a2a4a', paddingTop: 16 }}>
          <div style={{ fontSize: 11, color: '#7f8fa6', marginBottom: 8 }}>
            {noteLinks.length} connection{noteLinks.length !== 1 ? 's' : ''}
          </div>
          {linkedNotes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {linkedNotes.map((n) => (
                <div
                  key={n.id}
                  style={{
                    fontSize: 12,
                    color: '#7f8fa6',
                    padding: '5px 10px',
                    background: '#22223a',
                    borderRadius: 5,
                    border: '1px solid #3d3d6b',
                  }}
                >
                  {n.title}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
