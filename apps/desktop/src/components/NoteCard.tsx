import type { Note } from '@zettelkasten/core'
import { BG, TEXT, ACCENT, FONT, BORDER } from '../theme'

interface Props {
  note: Note
  onOpen: (note: Note) => void
  onProcess?: (note: Note) => void
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function NoteCard({ note, onOpen, onProcess }: Props) {
  return (
    <div
      className="note-card"
      style={{
        background: BG.raised,
        border: `1px solid ${BORDER.faint}`,
        borderRadius: 8,
        padding: '12px 16px',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        data-testid="note-open"
        onClick={() => onOpen(note)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpen(note)
          }
        }}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          textAlign: 'left',
          color: 'inherit',
          font: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontFamily: FONT.ui, fontSize: 13, fontWeight: 500, color: TEXT.primary, lineHeight: 1.4 }}>
            {note.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {onProcess && (
              <button
                onClick={(e) => { e.stopPropagation(); onProcess(note) }}
                className="process-btn"
                style={{
                  background: 'transparent',
                  color: TEXT.muted,
                  border: 'none',
                  padding: '2px 0',
                  fontSize: 10,
                  fontWeight: 500,
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  fontFamily: FONT.ui,
                }}
              >
                Process
              </button>
            )}
            <span style={{ fontSize: 10, color: TEXT.faint, fontFamily: FONT.ui }}>
              {timeAgo(note.created_at)}
            </span>
          </div>
        </div>
        {note.content && (
          <div
            style={{
              fontSize: 12,
              color: TEXT.muted,
              lineHeight: 1.5,
              marginTop: 6,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              fontFamily: FONT.ui,
            }}
          >
            {note.content}
          </div>
        )}
      </div>
    </div>
  )
}
