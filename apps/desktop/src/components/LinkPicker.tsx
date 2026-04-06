import { useState, useEffect } from 'react'
import { getNotesByType } from '@zettelkasten/core'
import type { Database, Note } from '@zettelkasten/core'

interface Props {
  db: Database
  selectedIds: string[]
  onToggle: (noteId: string) => void
}

export default function LinkPicker({ db, selectedIds, onToggle }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    getNotesByType(db, 'permanent').then(setNotes)
  }, [db])

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(query.toLowerCase())
  )

  if (notes.length === 0) {
    return (
      <div style={{ fontSize: 12, color: '#555', fontStyle: 'italic', padding: '8px 0' }}>
        No permanent notes yet — link requirement waived (bootstrap mode).
      </div>
    )
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search permanent notes..."
        style={{
          width: '100%',
          background: '#22223a',
          border: '1px solid #3d3d6b',
          borderRadius: 6,
          padding: '7px 10px',
          color: '#e0e0ff',
          fontSize: 12,
          outline: 'none',
          marginBottom: 6,
        }}
      />
      <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {filtered.map((note) => {
          const selected = selectedIds.includes(note.id)
          return (
            <button
              key={note.id}
              onClick={() => onToggle(note.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 10px',
                borderRadius: 6,
                border: `1px solid ${selected ? '#6c63ff' : '#3d3d6b'}`,
                background: selected ? '#6c63ff22' : '#22223a',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 11, color: selected ? '#6c63ff' : '#555' }}>
                {selected ? '✓' : '○'}
              </span>
              <span style={{ fontSize: 12, color: '#e0e0ff' }}>{note.title}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
