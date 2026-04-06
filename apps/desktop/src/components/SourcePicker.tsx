import { useState, useEffect } from 'react'
import type { Database, Source, SourceType } from '@zettelkasten/core'

interface Props {
  db: Database
  selectedId: string | null
  onSelect: (sourceId: string) => void
}

const SOURCE_TYPES: SourceType[] = ['book', 'article', 'video', 'podcast', 'conversation', 'other']
const ICONS: Record<SourceType, string> = {
  book: '📚', article: '📄', video: '🎥', podcast: '🎙️', conversation: '💬', other: '📌',
}

export default function SourcePicker({ db, selectedId, onSelect }: Props) {
  const [sources, setSources] = useState<Source[]>([])
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [newType, setNewType] = useState<SourceType>('book')
  const [newLabel, setNewLabel] = useState('')
  const [newDesc, setNewDesc] = useState('')

  useEffect(() => {
    db.query<Source>(`SELECT id, type, label, description, created_at FROM sources WHERE deleted_at IS NULL ORDER BY created_at DESC`)
      .then(setSources)
  }, [db])

  const filtered = sources.filter((s) =>
    s.label.toLowerCase().includes(query.toLowerCase())
  )

  async function handleCreate() {
    if (!newLabel.trim()) return
    const source: Source = {
      id: globalThis.crypto.randomUUID(),
      type: newType,
      label: newLabel.trim(),
      description: newDesc.trim() || null,
      created_at: Date.now(),
    }
    try {
      await db.execute(
        `INSERT INTO sources (id, type, label, description, created_at) VALUES (?, ?, ?, ?, ?)`,
        [source.id, source.type, source.label, source.description, source.created_at]
      )
    } catch (err) {
      console.error('Failed to create source:', err)
      return
    }
    setSources((prev) => [source, ...prev])
    onSelect(source.id)
    setCreating(false)
    setNewLabel('')
    setNewDesc('')
  }

  return (
    <div>
      {!creating ? (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sources..."
            style={inputStyle}
          />
          <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
            {filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                style={{
                  ...sourceRowStyle,
                  background: s.id === selectedId ? '#6c63ff22' : '#22223a',
                  border: `1px solid ${s.id === selectedId ? '#6c63ff' : '#3d3d6b'}`,
                }}
              >
                <span>{ICONS[s.type]}</span>
                <span style={{ flex: 1, textAlign: 'left', fontSize: 12, color: '#e0e0ff' }}>{s.label}</span>
                {s.id === selectedId && <span style={{ color: '#6c63ff', fontSize: 12 }}>✓</span>}
              </button>
            ))}
          </div>
          <button onClick={() => setCreating(true)} style={{ ...sourceRowStyle, marginTop: 6, background: '#1a1a2e', border: '1px dashed #3d3d6b', color: '#555', fontSize: 12 }}>
            + Add new source
          </button>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as SourceType)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {SOURCE_TYPES.map((t) => (
              <option key={t} value={t}>{ICONS[t]} {t}</option>
            ))}
          </select>
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Label (e.g. Thinking, Fast and Slow)" style={inputStyle} />
          <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)" style={inputStyle} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreate} style={{ flex: 1, background: '#6c63ff', color: 'white', border: 'none', borderRadius: 6, padding: '7px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Create source
            </button>
            <button onClick={() => setCreating(false)} style={{ background: '#22223a', color: '#7f8fa6', border: '1px solid #3d3d6b', borderRadius: 6, padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#22223a',
  border: '1px solid #3d3d6b',
  borderRadius: 6,
  padding: '7px 10px',
  color: '#e0e0ff',
  fontSize: 12,
  outline: 'none',
}

const sourceRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 10px',
  borderRadius: 6,
  border: '1px solid #3d3d6b',
  cursor: 'pointer',
  width: '100%',
}
