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
        color: TEXT.muted,
        fontStyle: 'italic',
        padding: '8px 0',
        letterSpacing: '0.01em',
        fontFamily: FONT.ui,
      }}>
        No permanent notes yet — link requirement waived for first note.
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
          border: `1px solid ${BORDER.base}`,
          borderRadius: 5,
          padding: '8px 10px',
          color: TEXT.primary,
          fontSize: 12,
          outline: 'none',
          marginBottom: 6,
          fontFamily: FONT.ui,
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
                gap: 8,
                padding: '7px 10px',
                borderRadius: 5,
                border: `1px solid ${selected ? ACCENT.permanent : BORDER.base}`,
                background: selected ? ACCENT.permanentSoft : BG.raised,
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <span style={{
                fontSize: 10,
                color: selected ? ACCENT.permanent : TEXT.muted,
                flexShrink: 0,
              }}>
                {selected ? '◆' : '◇'}
              </span>
              <span style={{
                fontFamily: FONT.display,
                fontSize: 14,
                color: selected ? TEXT.primary : TEXT.secondary,
                lineHeight: 1.3,
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
