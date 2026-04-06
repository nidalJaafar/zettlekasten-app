import type { Note } from '@zettelkasten/core'

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
    <div style={{
      background: '#22223a',
      border: '1px solid #3d3d6b',
      borderRadius: 8,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e0ff', marginBottom: 4 }}>
          {note.title}
        </div>
        {note.content && (
          <div style={{
            fontSize: 12,
            color: '#7f8fa6',
            lineHeight: 1.5,
            marginBottom: 6,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {note.content}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#555' }}>{timeAgo(note.created_at)}</div>
      </div>
      <button
        onClick={() => onProcess(note)}
        style={{
          background: '#6c63ff',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          padding: '6px 10px',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Process →
      </button>
    </div>
  )
}
