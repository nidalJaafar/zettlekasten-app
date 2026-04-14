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

  function handleReviewCardKeyDown(event: React.KeyboardEvent<HTMLDivElement>, noteId: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    void onOpenNoteId(noteId)
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
              role="button"
              tabIndex={0}
              onClick={() => void onOpenNoteId(note.id)}
              onKeyDown={(event) => handleReviewCardKeyDown(event, note.id)}
              data-testid="review-card"
              style={{
                background: BG.raised,
                border: `1px solid ${BORDER.faint}`,
                borderRadius: 12,
                overflow: 'hidden',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'stretch',
                gap: 16,
                textAlign: 'left',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <div
                data-testid="review-card-accent"
                style={{
                  width: 6,
                  borderRadius: 999,
                  background: typeColor(note.type),
                  opacity: 0.8,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
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
                  <div
                    data-testid="review-card-meta"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 10,
                      flexWrap: 'wrap',
                      flexShrink: 0,
                    }}
                  >
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
                    }} data-testid="review-card-chip">
                      {note.type}
                    </span>
                  </div>
                </div>
                <div
                  data-testid="review-card-preview"
                  style={{
                    marginTop: 6,
                    fontFamily: FONT.ui,
                    fontSize: 13,
                    lineHeight: 1.55,
                    color: previewText(note.content) ? TEXT.secondary : TEXT.muted,
                    paddingRight: 12,
                  }}
                >
                  {previewText(note.content) ?? 'No content yet. Open this note to continue shaping it.'}
                </div>
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
