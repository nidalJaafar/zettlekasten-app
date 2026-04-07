import { useEffect, useState } from 'react'
import { getAllLinks, getNotesByType } from '@zettelkasten/core'
import type { Database, Note, NoteLink } from '@zettelkasten/core'
import { BG, TEXT, ACCENT, FONT, BORDER } from '../theme'

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
        background: 'rgba(0, 0, 0, 0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: BG.raised,
          border: `1px solid ${BORDER.strong}`,
          borderRadius: 10,
          padding: '28px 32px',
          width: 540,
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflowY: 'auto',
          position: 'relative',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'transparent',
            border: 'none',
            color: TEXT.muted,
            fontSize: 16,
            cursor: 'pointer',
            lineHeight: 1,
            padding: 4,
          }}
        >
          ✕
        </button>

        {/* Type label */}
        <div style={{
          fontSize: 10,
          fontWeight: 600,
          color: ACCENT.ink,
          fontFamily: FONT.ui,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginBottom: 10,
        }}>
          Permanent note
        </div>

        {/* Title */}
        <div style={{
          fontFamily: FONT.display,
          fontSize: 22,
          fontWeight: 600,
          color: TEXT.primary,
          marginBottom: 18,
          paddingRight: 24,
          lineHeight: 1.3,
          letterSpacing: '0.005em',
        }}>
          {note.title}
        </div>

        {/* Content */}
        {note.content ? (
          <div style={{
            fontFamily: FONT.mono,
            fontSize: 13,
            color: TEXT.secondary,
            lineHeight: 1.75,
            marginBottom: 24,
            whiteSpace: 'pre-wrap',
          }}>
            {note.content}
          </div>
        ) : (
          <div style={{
            fontSize: 13,
            color: TEXT.muted,
            fontStyle: 'italic',
            marginBottom: 24,
          }}>
            No content.
          </div>
        )}

        {/* Connections */}
        <div style={{ borderTop: `1px solid ${BORDER.faint}`, paddingTop: 16 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: TEXT.muted,
            fontFamily: FONT.ui,
            textTransform: 'uppercase',
            letterSpacing: '0.10em',
            marginBottom: 10,
          }}>
            {noteLinks.length} connection{noteLinks.length !== 1 ? 's' : ''}
          </div>
          {linkedNotes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {linkedNotes.map((n) => (
                <div
                  key={n.id}
                  style={{
                    fontFamily: FONT.display,
                    fontSize: 14,
                    color: TEXT.secondary,
                    padding: '6px 10px',
                    background: BG.hover,
                    borderRadius: 4,
                    border: `1px solid ${BORDER.base}`,
                    lineHeight: 1.3,
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
