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
      <div style={{ padding: '18px 24px 14px', borderBottom: `1px solid ${BORDER.dim}` }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: TEXT.primary, letterSpacing: '0.01em' }}>
          Library
        </div>
        <div style={{ fontSize: 11, color: TEXT.muted, marginTop: 2, letterSpacing: '0.01em' }}>
          {notes.length} processed note{notes.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '14px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        {notes.length === 0 ? (
          <div style={{
            color: TEXT.muted,
            fontSize: 13,
            textAlign: 'center',
            marginTop: 48,
            letterSpacing: '0.01em',
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
                  background: BG.card,
                  border: `1px solid ${BORDER.base}`,
                  borderLeft: `3px solid ${ACCENT.blue}`,
                  borderRadius: 5,
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => setExpandedId(expanded ? null : note.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '11px 14px 11px 12px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: FONT.serif,
                      fontSize: 15,
                      fontWeight: 500,
                      color: TEXT.primary,
                      lineHeight: 1.35,
                      letterSpacing: '0.005em',
                    }}>
                      {note.title}
                    </div>
                    <div style={{ fontSize: 11, color: TEXT.muted, marginTop: 3, letterSpacing: '0.01em' }}>
                      {note.source_label ?? 'No source'} · {formatDate(note.processed_at!)}
                    </div>
                  </div>
                  <span style={{ color: TEXT.muted, fontSize: 10, flexShrink: 0 }}>
                    {expanded ? '▲' : '▼'}
                  </span>
                </button>
                {expanded && (
                  <div style={{
                    padding: '10px 14px 14px 12px',
                    fontFamily: FONT.mono,
                    fontSize: 12,
                    color: TEXT.dim,
                    lineHeight: 1.7,
                    borderTop: `1px solid ${BORDER.dim}`,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {note.content || <span style={{ fontStyle: 'italic', color: TEXT.muted }}>No content.</span>}
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
