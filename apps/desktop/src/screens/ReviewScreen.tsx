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
    setQueue([...fleeting, ...literature])
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {queue.map((note) => (
            <div
              key={note.id}
              style={{
                background: BG.raised,
                border: `1px solid ${BORDER.faint}`,
                borderLeft: `3px solid ${typeColor(note.type)}`,
                borderRadius: 5,
                padding: '11px 14px 11px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{
                fontFamily: FONT.display,
                fontSize: 15,
                color: TEXT.primary,
                flex: 1,
                lineHeight: 1.35,
                letterSpacing: '0.005em',
              }}>
                {note.title}
              </span>
              <span style={{
                fontSize: 9,
                fontWeight: 500,
                color: typeColor(note.type),
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                flexShrink: 0,
              }}>
                {note.type}
              </span>
              <button
                onClick={() => void onOpenNoteId(note.id)}
                style={{
                  background: 'transparent',
                  border: `1px solid ${BORDER.base}`,
                  borderRadius: 5,
                  color: TEXT.secondary,
                  fontSize: 10,
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '4px 10px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}
              >
                Open in Workspace
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const newBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${BORDER.base}`,
  borderRadius: 5,
  color: TEXT.faint,
  fontSize: 9,
  fontWeight: 500,
  cursor: 'pointer',
  padding: '3px 8px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}
