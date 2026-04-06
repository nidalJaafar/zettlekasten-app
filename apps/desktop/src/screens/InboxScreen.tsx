import { useEffect, useState, useCallback, useRef } from 'react'
import { getNotesByType, createNote } from '@zettelkasten/core'
import type { Database, Note } from '@zettelkasten/core'
import NoteCard from '../components/NoteCard'

interface Props {
  db: Database
  onCountChange: (count: number) => void
}

export default function InboxScreen({ db, onCountChange }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [title, setTitle] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownContainerRef = useRef<HTMLDivElement>(null)

  const loadNotes = useCallback(async () => {
    const fleeting = await getNotesByType(db, 'fleeting')
    setNotes(fleeting)
    onCountChange(fleeting.length)
  }, [db, onCountChange])

  useEffect(() => { loadNotes() }, [loadNotes])

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => { document.removeEventListener('mousedown', handleMouseDown) }
  }, [])

  async function handleCapture() {
    if (!title.trim()) return
    await createNote(db, { type: 'fleeting', title: title.trim() })
    setTitle('')
    await loadNotes()
  }

  function handleProcess(note: Note) {
    const event = new CustomEvent('zettel:review', { detail: note })
    window.dispatchEvent(event)
  }

  async function handleCreateLiterature() {
    setShowDropdown(false)
    const event = new CustomEvent('zettel:new-literature')
    window.dispatchEvent(event)
  }

  async function handleCreatePermanent() {
    setShowDropdown(false)
    const event = new CustomEvent('zettel:new-permanent')
    window.dispatchEvent(event)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1a1a2e' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: '1px solid #2a2a4a',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#e0e0ff' }}>Inbox</div>
          <div style={{ fontSize: 12, color: '#7f8fa6' }}>{notes.length} fleeting notes to process</div>
        </div>
        <div ref={dropdownContainerRef} style={{ marginLeft: 'auto', position: 'relative' }}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            style={{
              background: '#6c63ff',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + New ▾
          </button>
          {showDropdown && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '110%',
              background: '#22223a',
              border: '1px solid #3d3d6b',
              borderRadius: 8,
              padding: 4,
              zIndex: 100,
              minWidth: 180,
            }}>
              <button onClick={handleCreateLiterature} style={dropdownItemStyle}>
                Literature note
              </button>
              <button onClick={handleCreatePermanent} style={dropdownItemStyle}>
                Permanent note
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick capture */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #2a2a4a' }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCapture()}
          placeholder="Capture a fleeting thought... (Enter to save)"
          style={{
            width: '100%',
            background: '#22223a',
            border: '1px solid #3d3d6b',
            borderRadius: 6,
            padding: '8px 12px',
            color: '#e0e0ff',
            fontSize: 13,
            outline: 'none',
          }}
        />
      </div>

      {/* Notes list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notes.length === 0 ? (
          <div style={{ color: '#555', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
            No fleeting notes. Capture something above.
          </div>
        ) : (
          notes.map((note) => (
            <NoteCard key={note.id} note={note} onProcess={handleProcess} />
          ))
        )}
      </div>
    </div>
  )
}

const dropdownItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 12px',
  background: 'transparent',
  border: 'none',
  color: '#b0b0cc',
  fontSize: 13,
  textAlign: 'left',
  cursor: 'pointer',
  borderRadius: 4,
}
