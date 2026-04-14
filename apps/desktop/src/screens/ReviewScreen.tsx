import { useEffect, useState, useCallback } from 'react'
import { getNotesByType } from '@zettelkasten/core'
import type { Database, Note } from '@zettelkasten/core'
import { BG, TEXT, FONT, BORDER, typeColor } from '../theme'

interface Props {
  db: Database
  onOpenNoteId: (noteId: string) => Promise<void>
}

export default function ReviewScreen({ db, onOpenNoteId }: Props) {
  const [queue, setQueue] = useState<Note[]>([])

  const loadQueue = useCallback(async () => {
    const fleeting = await getNotesByType(db, 'fleeting')
    const literature = await db.query<Note>(
      `SELECT * FROM notes WHERE type = 'literature' AND processed_at IS NULL AND deleted_at IS NULL ORDER BY created_at ASC`
    )
    setQueue([...fleeting, ...literature].sort((a, b) => a.created_at - b.created_at))
  }, [db])

  useEffect(() => { loadQueue() }, [loadQueue])

  function handleNewLiterature() {
    window.dispatchEvent(new CustomEvent('zettel:new-literature'))
  }

  function handleNewPermanent() {
    window.dispatchEvent(new CustomEvent('zettel:new-permanent'))
  }

  if (queue.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: TEXT.muted,
        fontSize: 13,
        background: BG.base,
        letterSpacing: '0.01em',
        flexDirection: 'column',
        gap: 16,
      }}>
        <span style={{ fontStyle: 'italic' }}>Queue is empty. Capture some fleeting notes first.</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleNewLiterature} style={newBtnStyle}>New Literature</button>
          <button onClick={handleNewPermanent} style={newBtnStyle}>New Permanent</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', background: BG.base, overflowY: 'auto' }}>
      <div style={{ padding: '24px 28px' }}>
        <div style={{
          fontSize: 10,
          fontWeight: 500,
          color: TEXT.faint,
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          marginBottom: 20,
          fontFamily: FONT.ui,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>Review Queue — {queue.length}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleNewLiterature} style={newBtnStyle}>New Literature</button>
            <button onClick={handleNewPermanent} style={newBtnStyle}>New Permanent</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {queue.map((note) => (
            <div
              key={note.id}
              data-testid="review-card"
              style={{
                background: BG.raised,
                border: `1px solid ${BORDER.faint}`,
                borderLeft: `3px solid ${typeColor(note.type)}`,
                borderRadius: 10,
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <span style={{
                  fontFamily: FONT.ui,
                  fontSize: 17,
                  fontWeight: 600,
                  color: TEXT.primary,
                  flex: 1,
                  lineHeight: 1.3,
                  letterSpacing: '0.005em',
                }} data-testid="review-card-title">
                  {note.title}
                </span>
                <span style={{
                  fontFamily: FONT.ui,
                  fontSize: 10,
                  fontWeight: 600,
                  color: typeColor(note.type),
                  background: BG.panel,
                  border: `1px solid ${BORDER.base}`,
                  borderRadius: 999,
                  padding: '4px 8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  flexShrink: 0,
                }} data-testid="review-card-chip">
                  {note.type}
                </span>
              </div>
              <div style={{
                background: BG.panel,
                border: `1px solid ${BORDER.faint}`,
                borderRadius: 8,
                padding: '12px 13px',
              }}>
                <span style={{
                  display: 'block',
                  fontFamily: FONT.ui,
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: previewText(note.content) ? TEXT.secondary : TEXT.muted,
                }}>
                  {previewText(note.content) ?? 'No content yet. Open this note to continue shaping it.'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => void onOpenNoteId(note.id)}
                  data-testid="review-card-open-action"
                  style={{
                    background: BG.panel,
                    border: `1px solid ${BORDER.strong}`,
                    borderRadius: 8,
                    color: TEXT.primary,
                    fontFamily: FONT.ui,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '8px 12px',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    flexShrink: 0,
                  }}
                >
                  Open in Workspace
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function previewText(content: string | null): string | null {
  const trimmed = content?.trim()
  if (!trimmed) return null
  const maxLength = 140
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`
}

const newBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${BORDER.base}`,
  borderRadius: 5,
  color: TEXT.faint,
  fontFamily: FONT.ui,
  fontSize: 9,
  fontWeight: 500,
  cursor: 'pointer',
  padding: '3px 8px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}
