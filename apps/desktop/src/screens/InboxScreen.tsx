import { useEffect, useState, useCallback, useRef } from 'react'
import { getNotesByType, createNote } from '@zettelkasten/core'
import type { Database, Note } from '@zettelkasten/core'
import NoteCard from '../components/NoteCard'
import { BG, TEXT, ACCENT, FONT, BORDER } from '../theme'

interface Props {
  db: Database
  onCountChange: (count: number) => void
}

export default function InboxScreen({ db, onCountChange }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownContainerRef = useRef<HTMLDivElement>(null)
  const bodyInputRef = useRef<HTMLTextAreaElement>(null)

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
    const trimmedTitle = title.trim()
    const trimmedBody = body.trim()

    if (!trimmedTitle) return

    await createNote(db, {
      type: 'fleeting',
      title: trimmedTitle,
      ...(trimmedBody ? { content: trimmedBody } : {}),
    })

    setTitle('')
    setBody('')
    await loadNotes()
  }

  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return

    e.preventDefault()
    bodyInputRef.current?.focus()
  }

  function handleBodyKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void handleCapture()
    }
  }

  const showBody = title.length > 0 || body.length > 0

  function handleOpen(note: Note) {
    const event = new CustomEvent('zettel:open-note', { detail: note })
    window.dispatchEvent(event)
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
      <div style={{ padding: '28px 32px 18px' }}>
        <div style={{
          fontFamily: FONT.display,
          fontSize: 29,
          fontWeight: 500,
          color: TEXT.primary,
          letterSpacing: '-0.015em',
        }}>
          Inbox
        </div>
        <div style={{ fontSize: 12, color: TEXT.secondary, marginTop: 6, lineHeight: 1.6 }}>
          A quiet place for unfinished thoughts.{' '}
          {notes.length} fleeting note{notes.length !== 1 ? 's' : ''} waiting.
        </div>
      </div>

      {/* Capture card */}
      <div style={{ padding: '0 32px 24px' }}>
        <div style={{
          background: BG.panel,
          border: `1px solid ${BORDER.faint}`,
          borderRadius: 16,
          padding: '18px 18px 14px',
        }}>
          <div style={{
            fontSize: 10,
            color: TEXT.faint,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}>
            Quick capture
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            placeholder="Write a fleeting thought…"
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: TEXT.primary,
              fontFamily: FONT.display,
              fontSize: 22,
              lineHeight: 1.4,
              padding: '2px 0 10px',
              outline: 'none',
            }}
          />
          {showBody && (
            <textarea
              ref={bodyInputRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleBodyKeyDown}
              placeholder="Add a little more context…"
              rows={3}
              style={{
                width: '100%',
                resize: 'none',
                background: 'transparent',
                border: 'none',
                color: TEXT.secondary,
                fontFamily: FONT.ui,
                fontSize: 14,
                lineHeight: 1.6,
                padding: '0 0 10px',
                outline: 'none',
              }}
            />
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: TEXT.faint }}>
              {showBody ? 'Press Ctrl/Cmd+Enter to capture' : 'Press Enter for details or Capture to save'}
            </span>
            {/* Dropdown for direct note creation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button
                onClick={() => void handleCapture()}
                style={{
                  background: 'transparent',
                  color: ACCENT.ink,
                  border: 'none',
                  padding: '4px 0',
                  fontSize: 11,
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                }}
              >
                Capture
              </button>
              <div ref={dropdownContainerRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="btn-new"
                  style={{
                    background: 'transparent',
                    color: TEXT.faint,
                    border: 'none',
                    padding: '4px 0',
                    fontSize: 11,
                    cursor: 'pointer',
                    letterSpacing: '0.04em',
                  }}
                >
                  + New ▾
                </button>
                {showDropdown && (
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: '110%',
                    background: BG.panel,
                    border: `1px solid ${BORDER.base}`,
                    borderRadius: 10,
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
          </div>
        </div>
      </div>

      {/* Notes list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 32px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        {notes.length === 0 ? (
          <div style={{
            color: TEXT.muted,
            fontSize: 13,
            textAlign: 'center',
            marginTop: 48,
            letterSpacing: '0.01em',
            fontStyle: 'italic',
          }}>
            Nothing in the inbox. Capture a thought above.
          </div>
        ) : (
          notes.map((note) => (
            <NoteCard key={note.id} note={note} onOpen={handleOpen} onProcess={handleProcess} />
          ))
        )}
      </div>
    </div>
  )
}

const dropdownItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '10px 12px',
  background: 'transparent',
  border: 'none',
  color: TEXT.secondary,
  fontSize: 12,
  textAlign: 'left',
  cursor: 'pointer',
  borderRadius: 8,
  letterSpacing: '0.03em',
}
