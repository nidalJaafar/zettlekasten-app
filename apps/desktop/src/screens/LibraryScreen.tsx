import { useEffect, useState } from 'react'
import type { Database, Note } from '@zettelkasten/core'

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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1a1a2e' }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #2a2a4a' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#e0e0ff' }}>Library</div>
        <div style={{ fontSize: 12, color: '#7f8fa6' }}>{notes.length} processed notes</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notes.length === 0 ? (
          <div style={{ color: '#555', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
            No processed notes yet. Complete a review cycle to see notes here.
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              style={{ background: '#22223a', border: '1px solid #3d3d6b', borderRadius: 8, overflow: 'hidden' }}
            >
              <button
                onClick={() => setExpandedId(expandedId === note.id ? null : note.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 14px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e0ff' }}>{note.title}</div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                    {note.source_label ?? 'No source'} · {formatDate(note.processed_at!)}
                  </div>
                </div>
                <span style={{ color: '#555', fontSize: 11 }}>{expandedId === note.id ? '▲' : '▼'}</span>
              </button>
              {expandedId === note.id && (
                <div style={{
                  padding: '10px 14px 12px',
                  fontSize: 12,
                  color: '#7f8fa6',
                  lineHeight: 1.6,
                  borderTop: '1px solid #2a2a4a',
                  whiteSpace: 'pre-wrap',
                }}>
                  {note.content || <span style={{ fontStyle: 'italic' }}>No content.</span>}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
