import { useEffect, useState, useCallback, useRef } from 'react'
import { getNotesByType, createNote } from '@zettelkasten/core'
import type { Database, Note } from '@zettelkasten/core'
import NoteCard from '../components/NoteCard'
import { BG, TEXT, ACCENT, BORDER } from '../theme'

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
    window.dispatchEvent(new CustomEvent('zettel:new-literature'))
  }

  async function handleCreatePermanent() {
    setShowDropdown(false)
    window.dispatchEvent(new CustomEvent('zettel:new-permanent'))
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG.base }}>
      {/* Header */}
      <div style={{
        padding: '18px 24px 14px',
        borderBottom: `1px solid ${BORDER.dim}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: TEXT.primary, letterSpacing: '0.01em' }}>
            Inbox
          </div>
          <div style={{ fontSize: 11, color: TEXT.muted, marginTop: 2, letterSpacing: '0.01em' }}>
            {notes.length} fleeting note{notes.length !== 1 ? 's' : ''} to process
          </div>
        </div>
        <div ref={dropdownContainerRef} style={{ marginLeft: 'auto', position: 'relative' }}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="btn-new"
            style={{
              background: 'transparent',
              color: TEXT.dim,
              border: `1px solid ${BORDER.base}`,
              borderRadius: 5,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 400,
              cursor: 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            + New ▾
          </button>
          {showDropdown && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '110%',
              background: BG.surface,
              border: `1px solid ${BORDER.base}`,
              borderRadius: 6,
              padding: 4,
              zIndex: 100,
              minWidth: 180,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              <button onClick={handleCreateLiterature} className="dropdown-item" style={dropdownItemStyle}>
                Literature note
              </button>
              <button onClick={handleCreatePermanent} className="dropdown-item" style={dropdownItemStyle}>
                Permanent note
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick capture */}
      <div style={{ padding: '14px 24px', borderBottom: `1px solid ${BORDER.dim}` }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCapture()}
          placeholder="Capture a fleeting thought… (Enter to save)"
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            borderBottom: `1px solid ${BORDER.base}`,
            color: TEXT.primary,
            fontSize: 13,
            padding: '6px 0',
            outline: 'none',
            letterSpacing: '0.01em',
          }}
        />
      </div>

      {/* Notes list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '14px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}>
        {notes.length === 0 ? (
          <div style={{
            color: TEXT.muted,
            fontSize: 13,
            textAlign: 'center',
            marginTop: 48,
            letterSpacing: '0.01em',
          }}>
            Nothing in the inbox. Capture a thought above.
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
  color: TEXT.dim,
  fontSize: 12,
  textAlign: 'left',
  cursor: 'pointer',
  borderRadius: 4,
  letterSpacing: '0.02em',
}
