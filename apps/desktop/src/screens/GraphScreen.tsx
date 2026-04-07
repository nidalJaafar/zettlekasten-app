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
            background: 'rgba(16,16,26,0.92)',
            border: `1px solid ${BORDER.base}`,
            borderRadius: 6,
            padding: '7px 12px',
            color: TEXT.primary,
            fontSize: 12,
            outline: 'none',
            width: 200,
            backdropFilter: 'blur(4px)',
          }}
        />
        <div style={{
          background: 'rgba(16,16,26,0.92)',
          border: `1px solid ${BORDER.dim}`,
          borderRadius: 6,
          padding: '7px 12px',
          fontSize: 11,
          color: TEXT.muted,
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
          background: 'rgba(16,16,26,0.95)',
          border: `1px solid ${BORDER.hi}`,
          borderRadius: 8,
          padding: 16,
          backdropFilter: 'blur(6px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{
            fontFamily: FONT.serif,
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
              color: TEXT.dim,
              lineHeight: 1.5,
              marginBottom: 10,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {selected.content}
            </div>
          )}
          <div style={{ fontSize: 10, color: TEXT.muted, marginBottom: 12, letterSpacing: '0.04em' }}>
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
                color: TEXT.dim,
                border: `1px solid ${BORDER.base}`,
                borderRadius: 5,
                padding: '7px 0',
                fontSize: 11,
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
                border: `1px solid ${BORDER.dim}`,
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
        color: TEXT.muted,
        background: 'rgba(11,11,16,0.85)',
        padding: '5px 10px',
        borderRadius: 5,
        border: `1px solid ${BORDER.dim}`,
        letterSpacing: '0.04em',
        backdropFilter: 'blur(4px)',
      }}>
        scroll to zoom · drag to pan · click node to inspect
      </div>
    </div>
  )
}
