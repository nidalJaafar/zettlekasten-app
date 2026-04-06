import { useState, useEffect } from 'react'
import type { Database, Source, SourceType } from '@zettelkasten/core'
import { BG, TEXT, ACCENT, BORDER } from '../theme'

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
    db.query<Source>(`SELECT id, type, label, description, created_at FROM sources ORDER BY created_at DESC`)
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
            placeholder="Search sources…"
            style={inputStyle}
          />
          <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
            {filtered.map((s) => {
              const selected = s.id === selectedId
              return (
                <button
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  className="source-row"
                  style={{
                    ...rowStyle,
                    background: selected ? ACCENT.goldDim : BG.card,
                    borderColor: selected ? ACCENT.gold : BORDER.base,
                  }}
                >
                  <span style={{ fontSize: 12 }}>{ICONS[s.type]}</span>
                  <span style={{ flex: 1, textAlign: 'left', fontSize: 12, color: selected ? TEXT.primary : TEXT.dim }}>
                    {s.label}
                  </span>
                  {selected && <span style={{ fontSize: 11, color: ACCENT.gold }}>✓</span>}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => setCreating(true)}
            className="add-source-btn"
            style={{
              ...rowStyle,
              marginTop: 6,
              background: 'transparent',
              border: `1px dashed ${BORDER.base}`,
              color: TEXT.muted,
              fontSize: 12,
            }}
          >
            + Add new source
          </button>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (e.g. Thinking, Fast and Slow)"
            style={inputStyle}
            autoFocus
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as SourceType)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {SOURCE_TYPES.map((t) => (
              <option key={t} value={t}>{ICONS[t]} {t}</option>
            ))}
          </select>
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCreate}
              style={{
                flex: 1,
                background: ACCENT.gold,
                color: '#0b0b10',
                border: 'none',
                borderRadius: 5,
                padding: '8px 0',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '0.03em',
              }}
            >
              Create source
            </button>
            <button
              onClick={() => setCreating(false)}
              className="btn-ghost"
              style={{
                background: BG.card,
                color: TEXT.dim,
                border: `1px solid ${BORDER.base}`,
                borderRadius: 5,
                padding: '8px 14px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
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
  background: BG.card,
  border: `1px solid ${BORDER.base}`,
  borderRadius: 5,
  padding: '8px 10px',
  color: TEXT.primary,
  fontSize: 12,
  outline: 'none',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 10px',
  borderRadius: 5,
  border: `1px solid ${BORDER.base}`,
  cursor: 'pointer',
  width: '100%',
  background: BG.card,
}
