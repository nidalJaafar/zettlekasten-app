import type { Note } from '@zettelkasten/core'
import { BG, TEXT, ACCENT, FONT, BORDER } from '../theme'

interface Props {
  note: Note
  onProcess: (note: Note) => void
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

export default function NoteCard({ note, onProcess }: Props) {
  return (
    <div
      className="note-card"
      style={{
        background: BG.raised,
        border: `1px solid ${BORDER.faint}`,
        borderRadius: 10,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
      }}
    >
      {/* Type dot */}
      <div style={{ width: 6, paddingTop: 8, flexShrink: 0 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT.fleeting, opacity: 0.8 }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: FONT.display,
            fontSize: 18,
            fontWeight: 500,
            color: TEXT.primary,
            marginBottom: 4,
            lineHeight: 1.3,
            letterSpacing: '0.002em',
          }}
        >
          {note.title}
        </div>
        {note.content && (
          <div
            style={{
              fontSize: 12,
              color: TEXT.secondary,
              lineHeight: 1.7,
              marginBottom: 8,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {note.content}
          </div>
        )}
        <div style={{ fontSize: 10, color: TEXT.faint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {timeAgo(note.created_at)}
        </div>
      </div>

      <button
        onClick={() => onProcess(note)}
        className="process-btn"
        style={{
          background: 'transparent',
          color: TEXT.secondary,
          border: 'none',
          padding: '5px 0',
          fontSize: 11,
          fontWeight: 500,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        Process
      </button>
    </div>
  )
}
