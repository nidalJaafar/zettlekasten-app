import { useEffect, useState } from 'react'
import { getNotesByType, getAllLinks } from '@zettelkasten/core'
import type { Database, Note, NoteLink } from '@zettelkasten/core'
import GraphCanvas from '../components/GraphCanvas'
import { BG, TEXT, ACCENT, FONT, BORDER } from '../theme'

interface Props {
  db: Database
}

export default function GraphScreen({ db }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [links, setLinks] = useState<NoteLink[]>([])
  const [selected, setSelected] = useState<Note | null>(null)
  const [query, setQuery] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([getNotesByType(db, 'permanent'), getAllLinks(db)]).then(([n, l]) => {
      setNotes(n)
      setLinks(l)
      setLoaded(true)
    })
  }, [db])

  const filtered = query
    ? notes.filter((n) => n.title.toLowerCase().includes(query.toLowerCase()))
    : notes

  const visibleNoteIds = new Set(filtered.map((note) => note.id))
  const visibleLinks = links.filter(
    (link) => visibleNoteIds.has(link.from_note_id) && visibleNoteIds.has(link.to_note_id)
  )

  useEffect(() => {
    if (selected && !visibleNoteIds.has(selected.id)) {
      setSelected(null)
    }
  }, [selected, visibleNoteIds])

  if (!loaded) return null
  if (notes.length === 0) {
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
        fontStyle: 'italic',
      }}>
        No permanent notes yet. Process some notes through Review first.
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <GraphCanvas notes={filtered} links={visibleLinks} onNodeClick={setSelected} />

      {/* Search overlay */}
      <div style={{ position: 'absolute', top: 22, left: 22, display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes…"
          style={{
            background: 'rgba(23,26,32,0.9)',
            border: `1px solid ${BORDER.faint}`,
            borderRadius: 12,
            padding: '9px 13px',
            color: TEXT.primary,
            fontSize: 12,
            outline: 'none',
            width: 220,
            backdropFilter: 'blur(10px)',
          }}
        />
        <div style={{
          background: 'rgba(23,26,32,0.9)',
          border: `1px solid ${BORDER.faint}`,
          borderRadius: 10,
          padding: '9px 13px',
          fontSize: 11,
          color: TEXT.faint,
          backdropFilter: 'blur(10px)',
          letterSpacing: '0.04em',
        }}>
          {notes.length} · {links.length}
        </div>
      </div>

      {/* Inspector panel */}
      {selected && (
        <div style={{
          position: 'absolute',
          bottom: 22,
          right: 22,
          width: 280,
          background: 'rgba(23,26,32,0.92)',
          border: `1px solid ${BORDER.faint}`,
          borderRadius: 16,
          padding: 18,
          backdropFilter: 'blur(12px)',
          boxShadow: '0 18px 50px rgba(0,0,0,0.32)',
        }}>
          <div style={{
            fontFamily: FONT.display,
            fontSize: 19,
            fontWeight: 500,
            color: TEXT.primary,
            marginBottom: 6,
            lineHeight: 1.35,
            letterSpacing: '0.005em',
          }}>
            {selected.title}
          </div>
          {selected.content && (
            <div style={{
              fontSize: 11,
              color: TEXT.secondary,
              lineHeight: 1.6,
              marginBottom: 10,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {selected.content}
            </div>
          )}
          <div style={{
            fontSize: 10,
            color: TEXT.faint,
            marginBottom: 14,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            {visibleLinks.filter((l) => l.from_note_id === selected.id || l.to_note_id === selected.id).length} connections
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => {
                const event = new CustomEvent('zettel:open-note', { detail: selected })
                window.dispatchEvent(event)
              }}
              className="btn-inspect"
              style={{
                flex: 1,
                background: 'transparent',
                color: TEXT.secondary,
                border: `1px solid ${BORDER.base}`,
                borderRadius: 8,
                padding: '8px 0',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Open
            </button>
            <button
              onClick={() => setSelected(null)}
              className="btn-dismiss"
              style={{
                background: 'transparent',
                color: TEXT.muted,
                border: `1px solid ${BORDER.faint}`,
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Hint */}
      <div style={{
        position: 'absolute',
        bottom: 22,
        left: 22,
        fontSize: 10,
        color: TEXT.faint,
        background: 'rgba(13,15,19,0.85)',
        padding: '6px 12px',
        borderRadius: 8,
        border: `1px solid ${BORDER.faint}`,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        backdropFilter: 'blur(6px)',
      }}>
        scroll to zoom · drag · click to inspect
      </div>
    </div>
  )
}
