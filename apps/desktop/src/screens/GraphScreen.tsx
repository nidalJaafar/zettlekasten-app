import { useEffect, useState } from 'react'
import { getNotesByType, getAllLinks } from '@zettelkasten/core'
import type { Database, Note, NoteLink } from '@zettelkasten/core'
import GraphCanvas from '../components/GraphCanvas'

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

  if (!loaded) return null
  if (notes.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#555', fontSize: 14, background: '#0a0a18' }}>
        No permanent notes yet. Process some notes through Review first.
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <GraphCanvas notes={filtered} links={links} onNodeClick={setSelected} />

      {/* Search overlay */}
      <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes..."
          style={{
            background: '#1a1a2eee',
            border: '1px solid #3d3d6b',
            borderRadius: 8,
            padding: '7px 12px',
            color: '#e0e0ff',
            fontSize: 12,
            outline: 'none',
            width: 220,
          }}
        />
        <div style={{ background: '#1a1a2eee', border: '1px solid #3d3d6b', borderRadius: 8, padding: '7px 12px', fontSize: 12, color: '#7f8fa6' }}>
          {notes.length} notes · {links.length} links
        </div>
      </div>

      {/* Inspector panel */}
      {selected && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          width: 260,
          background: '#13132aee',
          border: '1px solid #6c63ff55',
          borderRadius: 10,
          padding: 16,
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e0e0ff', marginBottom: 6, lineHeight: 1.4 }}>
            {selected.title}
          </div>
          {selected.content && (
            <div style={{ fontSize: 12, color: '#7f8fa6', lineHeight: 1.5, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {selected.content}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#555', marginBottom: 10 }}>
            {links.filter((l) => l.from_note_id === selected.id || l.to_note_id === selected.id).length} connections
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => {
                const event = new CustomEvent('zettel:open-note', { detail: selected })
                window.dispatchEvent(event)
              }}
              style={{ flex: 1, background: '#6c63ff', color: 'white', border: 'none', borderRadius: 5, padding: '7px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >
              Open note
            </button>
            <button
              onClick={() => setSelected(null)}
              style={{ background: '#22223a', color: '#7f8fa6', border: '1px solid #3d3d6b', borderRadius: 5, padding: '7px 10px', fontSize: 11, cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Hint */}
      <div style={{ position: 'absolute', bottom: 16, left: 16, fontSize: 11, color: '#333', background: '#0a0a18', padding: '5px 10px', borderRadius: 6, border: '1px solid #1a1a2e' }}>
        scroll to zoom · drag to pan · click node to inspect
      </div>
    </div>
  )
}
