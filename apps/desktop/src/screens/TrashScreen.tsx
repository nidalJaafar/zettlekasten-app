import { useCallback, useEffect, useState } from 'react'
import { permanentlyDeleteNote, restoreNote } from '@zettelkasten/core'
import type { Database, Note } from '@zettelkasten/core'
import { ACCENT, BG, BORDER, FONT, TEXT, typeColor } from '../theme'

interface Props {
  db: Database
  onInboxCountChange?: () => Promise<void>
}

export default function TrashScreen({ db, onInboxCountChange }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [busyNoteId, setBusyNoteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadNotes = useCallback(async () => {
    const deletedNotes = await db.query<Note>(`
      SELECT *
      FROM notes
      WHERE deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
    `)
    setNotes(deletedNotes)
  }, [db])

  useEffect(() => {
    loadNotes().catch((err) => {
      setError(err instanceof Error ? err.message : String(err))
    })
  }, [loadNotes])

  async function handleRestore(noteId: string) {
    setBusyNoteId(noteId)
    setError(null)

    try {
      await restoreNote(db, noteId)
      await loadNotes()
      await onInboxCountChange?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyNoteId(null)
    }
  }

  async function handlePermanentDelete(noteId: string) {
    const confirmed = window.confirm('Delete this note permanently? This cannot be undone.')
    if (!confirmed) return

    setBusyNoteId(noteId)
    setError(null)

    try {
      await permanentlyDeleteNote(db, noteId)
      await loadNotes()
      await onInboxCountChange?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyNoteId(null)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG.base }}>
      <div style={{ padding: '28px 32px 18px' }}>
        <div style={{ fontFamily: FONT.display, fontSize: 29, fontWeight: 500, color: TEXT.primary, letterSpacing: '-0.015em' }}>
          Trash
        </div>
        <div style={{ fontSize: 12, color: TEXT.secondary, marginTop: 6, lineHeight: 1.6, fontFamily: FONT.ui }}>
          Deleted notes stay here until you restore them or remove them for good.
        </div>
        {error && (
          <div style={{ marginTop: 10, fontSize: 12, color: ACCENT.danger, fontFamily: FONT.ui }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {notes.length === 0 ? (
          <div style={{ color: TEXT.muted, fontSize: 13, textAlign: 'center', marginTop: 48, letterSpacing: '0.01em', fontStyle: 'italic', fontFamily: FONT.ui }}>
            Trash is empty.
          </div>
        ) : (
          notes.map((note) => {
            const preview = note.content.trim() || 'No preview available.'
            const isBusy = busyNoteId === note.id

            return (
              <div
                key={note.id}
                style={{
                  background: BG.raised,
                  border: `1px solid ${BORDER.faint}`,
                  borderRadius: 12,
                  padding: '16px 18px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                }}
              >
                <div style={{ width: 6, alignSelf: 'stretch', borderRadius: 999, background: typeColor(note.type), opacity: 0.75, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONT.ui, fontSize: 15, fontWeight: 500, color: TEXT.primary, lineHeight: 1.4 }}>
                    {note.title}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 10, color: TEXT.secondary, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: FONT.ui }}>
                    {note.type} · deleted {formatDeletedAt(note.deleted_at)}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, color: note.content.trim() ? TEXT.secondary : TEXT.muted, lineHeight: 1.6, fontFamily: FONT.ui }}>
                    {preview}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => {
                      void handleRestore(note.id)
                    }}
                    disabled={isBusy}
                    style={buttonStyle}
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => {
                      void handlePermanentDelete(note.id)
                    }}
                    disabled={isBusy}
                    style={{ ...buttonStyle, color: ACCENT.danger }}
                  >
                    Delete Permanently
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function formatDeletedAt(value: number | null): string {
  if (!value) return 'recently'
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const buttonStyle: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${BORDER.base}`,
  color: TEXT.secondary,
  borderRadius: 999,
  padding: '7px 12px',
  cursor: 'pointer',
  fontSize: 11,
  letterSpacing: '0.04em',
  fontFamily: FONT.ui,
  whiteSpace: 'nowrap',
}
