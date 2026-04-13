import { useEffect, useState } from 'react'
import type { Database, NoteType } from '@zettelkasten/core'
import { ACCENT, BG, BORDER, FONT, TEXT, typeColor } from '../../theme'

interface RecentNoteRow {
  id: string
  type: NoteType
  title: string
  updated_at: number
}

interface Props {
  db: Database
  activeNoteId: string | null
  onOpenNoteId: (noteId: string) => Promise<void>
}

export default function WorkspaceRail({ db, activeNoteId, onOpenNoteId }: Props) {
  const [notes, setNotes] = useState<RecentNoteRow[]>([])

  useEffect(() => {
    let cancelled = false

    void db.query<RecentNoteRow>(
      `SELECT id, type, title, updated_at
       FROM notes
       WHERE deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 40`
    ).then((rows) => {
      if (!cancelled) {
        setNotes(rows)
      }
    }).catch(() => {
      if (!cancelled) {
        setNotes([])
      }
    })

    return () => {
      cancelled = true
    }
  }, [db])

  return (
    <aside
      style={{
        borderRight: `1px solid ${BORDER.faint}`,
        background: BG.canvas,
        padding: 20,
        overflow: 'auto',
      }}
    >
      <div
        style={{
          color: TEXT.muted,
          fontFamily: FONT.ui,
          fontSize: 12,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginBottom: 16,
        }}
      >
        Recent notes
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notes.map((note) => {
          const isActive = note.id === activeNoteId
          return (
            <button
              key={note.id}
              type="button"
              onClick={() => {
                void onOpenNoteId(note.id)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 12px',
                borderRadius: 12,
                border: `1px solid ${isActive ? BORDER.strong : BORDER.faint}`,
                background: isActive ? ACCENT.inkSoft : BG.panel,
                color: TEXT.primary,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: typeColor(note.type),
                  flex: '0 0 auto',
                }}
              />
              <span
                style={{
                  minWidth: 0,
                  fontFamily: FONT.ui,
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {note.title || 'Untitled'}
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
