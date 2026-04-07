import { useState, useEffect } from 'react'
import { getNotesByType } from '@zettelkasten/core'
import type { Database, Note } from '@zettelkasten/core'
import { BG, TEXT, ACCENT, FONT, BORDER } from '../theme'

interface Props {
  db: Database
  selectedIds: string[]
  onToggle: (noteId: string) => void
}

export default function LinkPicker({ db, selectedIds, onToggle }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [query, setQuery] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getNotesByType(db, 'permanent').then((result) => {
      setNotes(result)
      setLoaded(true)
    })
  }, [db])

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(query.toLowerCase())
  )

  if (!loaded) return null
  if (notes.length === 0) {
    return (
      <div style={{
        fontSize: 12,
        color: TEXT.faint,
        fontStyle: 'italic',
        padding: '10px 0',
        lineHeight: 1.7,
      }}>
        No permanent notes yet. The first permanent note can be saved without links.
      </div>
    )
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search permanent notes…"
        style={{
          width: '100%',
          background: BG.raised,
          border: `1px solid ${BORDER.faint}`,
          borderRadius: 10,
          padding: '10px 12px',
          color: TEXT.primary,
          fontSize: 12,
          outline: 'none',
          marginBottom: 8,
        }}
      />
      <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {filtered.map((note) => {
          const selected = selectedIds.includes(note.id)
          return (
            <button
              key={note.id}
              onClick={() => onToggle(note.id)}
              className="picker-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${selected ? ACCENT.permanent : BORDER.faint}`,
                background: selected ? 'rgba(141,135,159,0.12)' : BG.raised,
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <span style={{
                fontSize: 10,
                color: selected ? ACCENT.permanent : TEXT.faint,
                flexShrink: 0,
              }}>
                {selected ? '◆' : '◇'}
              </span>
              <span style={{
                fontFamily: FONT.display,
                fontSize: 16,
                color: selected ? TEXT.primary : TEXT.secondary,
                lineHeight: 1.4,
              }}>
                {note.title}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
