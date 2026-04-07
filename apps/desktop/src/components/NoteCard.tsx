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
        border: `1px solid ${BORDER.base}`,
        borderLeft: `3px solid ${ACCENT.fleeting}`,
        borderRadius: 5,
        padding: '11px 14px 11px 12px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: FONT.display,
          fontSize: 15,
          fontWeight: 500,
          color: TEXT.primary,
          marginBottom: 5,
          lineHeight: 1.35,
          letterSpacing: '0.005em',
        }}>
          {note.title}
        </div>
        {note.content && (
          <div style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            color: TEXT.faint,
            lineHeight: 1.5,
            marginBottom: 5,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {note.content}
          </div>
        )}
        <div style={{ fontSize: 11, color: TEXT.faint, letterSpacing: '0.02em', fontFamily: FONT.ui }}>
          {timeAgo(note.created_at)}
        </div>
      </div>
      <button
        onClick={() => onProcess(note)}
        className="process-btn"
        style={{
          background: 'transparent',
          color: TEXT.muted,
          border: 'none',
          padding: '4px 0',
          fontSize: 11,
          fontFamily: FONT.ui,
          fontWeight: 400,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          letterSpacing: '0.02em',
        }}
      >
        Process →
      </button>
    </div>
  )
}
