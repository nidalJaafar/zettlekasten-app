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
        fontFamily: FONT.ui,
      }}>
        No permanent notes yet. Process some notes through Review first.
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <GraphCanvas notes={filtered} links={visibleLinks} onNodeClick={setSelected} />

      {/* Search overlay */}
      <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes…"
          style={{
            background: 'rgba(23,26,32,0.92)',
            border: `1px solid ${BORDER.base}`,
            borderRadius: 6,
            padding: '7px 12px',
            color: TEXT.primary,
            fontSize: 12,
            fontFamily: FONT.ui,
            outline: 'none',
            width: 200,
            backdropFilter: 'blur(4px)',
          }}
        />
        <div style={{
          background: 'rgba(23,26,32,0.92)',
          border: `1px solid ${BORDER.faint}`,
          borderRadius: 6,
          padding: '7px 12px',
          fontSize: 11,
          color: TEXT.muted,
          fontFamily: FONT.ui,
          backdropFilter: 'blur(4px)',
          letterSpacing: '0.02em',
        }}>
          {notes.length} · {links.length}
        </div>
      </div>

      {/* Inspector panel */}
      {selected && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          width: 260,
          background: 'rgba(23,26,32,0.95)',
          border: `1px solid ${BORDER.strong}`,
          borderRadius: 8,
          padding: 16,
          backdropFilter: 'blur(6px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{
            fontFamily: FONT.display,
            fontSize: 15,
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
              lineHeight: 1.5,
              marginBottom: 10,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              fontFamily: FONT.mono,
            }}>
              {selected.content}
            </div>
          )}
          <div style={{ fontSize: 10, color: TEXT.muted, marginBottom: 12, letterSpacing: '0.04em', fontFamily: FONT.ui }}>
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
                borderRadius: 5,
                padding: '7px 0',
                fontSize: 11,
                fontFamily: FONT.ui,
                fontWeight: 500,
                cursor: 'pointer',
                letterSpacing: '0.03em',
              }}
            >
              Open note
            </button>
            <button
              onClick={() => setSelected(null)}
              className="btn-dismiss"
              style={{
                background: 'transparent',
                color: TEXT.muted,
                border: `1px solid ${BORDER.faint}`,
                borderRadius: 5,
                padding: '7px 10px',
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
        bottom: 16,
        left: 16,
        fontSize: 10,
        color: TEXT.faint,
        fontFamily: FONT.ui,
        background: 'rgba(13,15,19,0.85)',
        padding: '5px 10px',
        borderRadius: 5,
        border: `1px solid ${BORDER.faint}`,
        letterSpacing: '0.04em',
        backdropFilter: 'blur(4px)',
      }}>
        scroll to zoom · drag to pan · click node to inspect
      </div>
    </div>
  )
}
