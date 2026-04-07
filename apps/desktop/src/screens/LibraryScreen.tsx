import { useEffect, useState } from 'react'
import type { Database, Note } from '@zettelkasten/core'
import { BG, TEXT, ACCENT, FONT, BORDER } from '../theme'

interface LibraryNote extends Note {
  source_label: string | null
}

interface Props {
  db: Database
}

export default function LibraryScreen({ db }: Props) {
  const [notes, setNotes] = useState<LibraryNote[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    db.query<LibraryNote>(`
      SELECT n.*, s.label as source_label
      FROM notes n
      LEFT JOIN sources s ON n.source_id = s.id
      WHERE n.processed_at IS NOT NULL AND n.deleted_at IS NULL
      ORDER BY n.processed_at DESC
    `).then(setNotes)
  }, [db])

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG.base }}>
      {/* Header */}
      <div style={{ padding: '28px 32px 18px' }}>
        <div style={{
          fontFamily: FONT.display,
          fontSize: 29,
          fontWeight: 500,
          color: TEXT.primary,
          letterSpacing: '-0.015em',
        }}>
          Library
        </div>
        <div style={{ fontSize: 12, color: TEXT.secondary, marginTop: 6, lineHeight: 1.6 }}>
          Processed literature notes, arranged like a working shelf.{' '}
          {notes.length} item{notes.length !== 1 ? 's' : ''}.
        </div>
      </div>

      {/* List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 32px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        {notes.length === 0 ? (
          <div style={{
            color: TEXT.muted,
            fontSize: 13,
            textAlign: 'center',
            marginTop: 48,
            letterSpacing: '0.01em',
            fontStyle: 'italic',
          }}>
            No processed notes yet. Complete a review cycle to see notes here.
          </div>
        ) : (
          notes.map((note) => {
            const expanded = expandedId === note.id
            return (
              <div
                key={note.id}
                className="library-card"
                style={{
                  background: BG.raised,
                  border: `1px solid ${BORDER.faint}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => setExpandedId(expanded ? null : note.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '16px 18px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                  }}
                >
                  {/* Vertical accent bar */}
                  <div style={{
                    width: 6,
                    alignSelf: 'stretch',
                    borderRadius: 999,
                    background: ACCENT.literature,
                    opacity: 0.7,
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: FONT.display,
                      fontSize: 19,
                      fontWeight: 500,
                      color: TEXT.primary,
                      lineHeight: 1.3,
                    }}>
                      {note.title}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: TEXT.secondary,
                      marginTop: 5,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}>
                      {note.source_label ?? 'No source'} · {formatDate(note.processed_at!)}
                    </div>
                  </div>
                  <span style={{ color: TEXT.faint, fontSize: 10, flexShrink: 0 }}>
                    {expanded ? '▲' : '▼'}
                  </span>
                </button>
                {expanded && (
                  <div style={{
                    padding: '0 18px 18px 40px',
                    fontFamily: FONT.display,
                    fontSize: 15,
                    color: TEXT.secondary,
                    lineHeight: 1.85,
                    borderTop: `1px solid ${BORDER.faint}`,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {note.content || <span style={{ fontStyle: 'italic', color: TEXT.faint }}>No content.</span>}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
