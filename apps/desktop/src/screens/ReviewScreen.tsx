import { useEffect, useState, useCallback, useRef } from 'react'
import {
  getNotesByType,
  updateNote,
  createNote,
  addLink,
  countNotesByType,
  canPromoteToLiterature,
  canSavePermanentNote,
} from '@zettelkasten/core'
import type { Database, Note } from '@zettelkasten/core'
import MarkdownEditor from '../components/MarkdownEditor'
import SourcePicker from '../components/SourcePicker'
import LinkPicker from '../components/LinkPicker'
import { BG, TEXT, ACCENT, FONT, BORDER, typeColor } from '../theme'

interface Props {
  db: Database
  pendingNote?: Note | null
  draftType?: 'literature' | 'permanent' | null
  onNoteConsumed?: () => void
  onDraftConsumed?: () => void
  onInboxCountChange?: () => Promise<void> | void
}

type ReviewStep = 'fleeting-to-literature' | 'literature-to-permanent'

export default function ReviewScreen({
  db,
  pendingNote,
  draftType,
  onNoteConsumed,
  onDraftConsumed,
  onInboxCountChange,
}: Props) {
  const [queue, setQueue] = useState<Note[]>([])
  const [totalPermanentNotes, setTotalPermanentNotes] = useState(0)
  const [current, setCurrent] = useState<Note | null>(null)
  const [activeDraftType, setActiveDraftType] = useState<'literature' | 'permanent' | null>(null)
  const [step, setStep] = useState<ReviewStep>('fleeting-to-literature')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [ownWords, setOwnWords] = useState(false)
  const [linkedIds, setLinkedIds] = useState<string[]>([])
  const [blockReason, setBlockReason] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const savedTitleRef = useRef('')
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadQueue = useCallback(async () => {
    const fleeting = await getNotesByType(db, 'fleeting')
    const literature = await db.query<Note>(
      `SELECT * FROM notes WHERE type = 'literature' AND processed_at IS NULL AND deleted_at IS NULL ORDER BY created_at ASC`
    )
    const permanentCount = await countNotesByType(db, 'permanent')
    setQueue([...fleeting, ...literature])
    setTotalPermanentNotes(permanentCount)
  }, [db])

  useEffect(() => { loadQueue() }, [loadQueue])

  useEffect(() => () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
  }, [])

  const selectNote = useCallback((note: Note) => {
    setActiveDraftType(null)
    setCurrent(note)
    setTitle(note.title)
    setContent(note.content)
    setSourceId(note.source_id)
    setOwnWords(false)
    setLinkedIds([])
    setBlockReason(null)
    setSaveState('idle')
    setStep(note.type === 'fleeting' ? 'fleeting-to-literature' : 'literature-to-permanent')
  }, [])

  const startDraft = useCallback((type: 'literature' | 'permanent') => {
    setActiveDraftType(type)
    setCurrent(null)
    setTitle('')
    setContent('')
    setSourceId(null)
    setOwnWords(false)
    setLinkedIds([])
    setBlockReason(null)
    setSaveState('idle')
    setStep(type === 'literature' ? 'fleeting-to-literature' : 'literature-to-permanent')
  }, [])

  useEffect(() => {
    if (pendingNote) {
      selectNote(pendingNote)
      onNoteConsumed?.()
    }
  }, [pendingNote, selectNote, onNoteConsumed])

  useEffect(() => {
    if (draftType) {
      startDraft(draftType)
      onDraftConsumed?.()
    }
  }, [draftType, startDraft, onDraftConsumed])

  async function runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    await db.execute('BEGIN')
    try {
      const result = await work()
      await db.execute('COMMIT')
      return result
    } catch (error) {
      await db.execute('ROLLBACK')
      throw error
    }
  }

  async function savePermanentNote(processedLiteratureId?: string) {
    return runInTransaction(async () => {
      const permanent = await createNote(db, { type: 'permanent', title, content })
      await updateNote(db, permanent.id, { own_words_confirmed: 1 })
      for (const id of linkedIds) {
        await addLink(db, permanent.id, id)
      }
      if (processedLiteratureId) {
        await updateNote(db, processedLiteratureId, { processed_at: Date.now() })
      }
      return permanent
    })
  }

  const canSavePermanent = ownWords && (linkedIds.length > 0 || totalPermanentNotes === 0)

  async function handlePromoteToLiterature() {
    if (!current) return
    const check = canPromoteToLiterature({ ...current, source_id: sourceId })
    if (!check.ok) {
      setBlockReason(check.reason)
      return
    }
    if (!sourceId) return

    await updateNote(db, current.id, { type: 'literature', title, content, source_id: sourceId })
    const updated = { ...current, type: 'literature' as const, title, content, source_id: sourceId }
    setCurrent(updated)
    setStep('literature-to-permanent')
    setBlockReason(null)
    await loadQueue()
    await onInboxCountChange?.()
  }

  async function handleCreateLiteratureDraft() {
    if (!sourceId) {
      setBlockReason('Attach a source before creating a literature note.')
      return
    }

    const created = await createNote(db, { type: 'literature', title, content, source_id: sourceId })
    setActiveDraftType(null)
    selectNote(created)
    await loadQueue()
  }

  async function handleSavePermanent() {
    if (!current) return
    if (saveState !== 'idle') return
    const currentPermanentCount = await countNotesByType(db, 'permanent')
    const check = canSavePermanentNote(
      { own_words_confirmed: ownWords ? 1 : 0 },
      { linkedPermanentNoteIds: linkedIds, totalPermanentNotes: currentPermanentCount }
    )
    if (!check.ok) { setBlockReason(check.reason); return }

    savedTitleRef.current = title
    setSaveState('saving')
    try {
      await savePermanentNote(current.id)
      setSaveState('saved')
      saveTimeoutRef.current = setTimeout(() => {
        setCurrent(null)
        setActiveDraftType(null)
        setSaveState('idle')
        setBlockReason(null)
        loadQueue().catch((err) => {
          console.error('Failed to reload queue after save:', err)
        })
      }, 1200)
    } catch (err) {
      console.error('savePermanentNote failed:', err)
      setSaveState('idle')
      setBlockReason('Failed to save permanent note.')
    }
  }

  async function handleCreatePermanentDraft() {
    if (saveState !== 'idle') return
    const currentPermanentCount = await countNotesByType(db, 'permanent')
    const check = canSavePermanentNote(
      { own_words_confirmed: ownWords ? 1 : 0 },
      { linkedPermanentNoteIds: linkedIds, totalPermanentNotes: currentPermanentCount }
    )
    if (!check.ok) {
      setBlockReason(check.reason)
      return
    }

    savedTitleRef.current = title
    setSaveState('saving')
    try {
      await savePermanentNote()
      setSaveState('saved')
      saveTimeoutRef.current = setTimeout(() => {
        setCurrent(null)
        setActiveDraftType(null)
        setSaveState('idle')
        setBlockReason(null)
        loadQueue().catch((err) => {
          console.error('Failed to reload queue after save:', err)
        })
      }, 1200)
    } catch (err) {
      console.error('savePermanentNote failed:', err)
      setSaveState('idle')
      setBlockReason('Failed to save permanent note.')
    }
  }

  function toggleLink(id: string) {
    setLinkedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  // Empty state
  if (queue.length === 0 && !current && !activeDraftType) {
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
        Queue is empty. Capture some fleeting notes first.
      </div>
    )
  }

  // Queue list view
  if (!current && !activeDraftType) {
    return (
      <div style={{ height: '100%', background: BG.base, overflowY: 'auto' }}>
        <div style={{ padding: '24px 28px' }}>
          <div style={{
            fontSize: 10,
            fontWeight: 500,
            color: TEXT.faint,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            marginBottom: 20,
            fontFamily: FONT.ui,
          }}>
            Review Queue — {queue.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {queue.map((note) => (
              <button
                key={note.id}
                onClick={() => selectNote(note)}
                className="queue-item"
                style={{
                  background: BG.raised,
                  border: `1px solid ${BORDER.faint}`,
                  borderLeft: `3px solid ${typeColor(note.type)}`,
                  borderRadius: 5,
                  padding: '11px 14px 11px 12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span style={{
                  fontFamily: FONT.display,
                  fontSize: 15,
                  color: TEXT.primary,
                  flex: 1,
                  lineHeight: 1.35,
                  letterSpacing: '0.005em',
                }}>
                  {note.title}
                </span>
                <span style={{
                  fontSize: 9,
                  fontWeight: 500,
                  color: typeColor(note.type),
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  flexShrink: 0,
                }}>
                  {note.type}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Editor view
  return (
    <div style={{ padding: '30px 34px 36px', background: BG.base, height: '100%', overflowY: 'auto' }}>
      {/* Step header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 34 }}>
        <div>
          <div style={{
            fontSize: 10,
            fontWeight: 500,
            color: TEXT.faint,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            fontFamily: FONT.ui,
            marginBottom: 6,
          }}>
            {step === 'fleeting-to-literature' ? 'Step 1 of 2' : 'Step 2 of 2'}
          </div>
          <div style={{ fontSize: 13, color: TEXT.secondary, fontFamily: FONT.ui }}>
            {step === 'fleeting-to-literature'
              ? 'Attach a source and refine your notes.'
              : totalPermanentNotes === 0
                ? 'Confirm own words. No links required for your first permanent note.'
                : 'Confirm own words and link to the knowledge graph.'}
          </div>
        </div>
        <button
          onClick={() => {
            setCurrent(null)
            setActiveDraftType(null)
            setSaveState('idle')
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: TEXT.muted,
            cursor: 'pointer',
            fontFamily: FONT.ui,
            fontSize: 11,
            letterSpacing: '0.03em',
            flexShrink: 0,
            marginLeft: 16,
          }}
        >
          ← queue
        </button>
      </div>

      {/* Title */}
      <div style={{ marginBottom: 22 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: TEXT.primary,
            fontFamily: FONT.display,
            fontSize: 34,
            fontWeight: 500,
            padding: '2px 0 14px',
            marginBottom: 16,
            outline: 'none',
            letterSpacing: '-0.015em',
            lineHeight: 1.2,
          }}
        />
        <MarkdownEditor value={content} onChange={setContent} minHeight="260px" />
      </div>

      {/* Source section */}
      {step === 'fleeting-to-literature' && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 500,
            color: TEXT.faint,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: FONT.ui,
          }}>
            Source
            <span style={{               color: ACCENT.danger, fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>
              *required
            </span>
          </div>
          <SourcePicker db={db} selectedId={sourceId} onSelect={setSourceId} />
        </div>
      )}

      {/* Link section */}
      {step === 'literature-to-permanent' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={ownWords}
                onChange={(e) => setOwnWords(e.target.checked)}
                style={{ width: 14, height: 14, accentColor: ACCENT.success }}
              />
              <span style={{ fontSize: 12, color: TEXT.secondary, fontFamily: FONT.ui }}>Written in my own words</span>
            </label>
          </div>
          {totalPermanentNotes === 0 ? (
            <div style={{
              marginBottom: 20,
              fontSize: 12,
              color: TEXT.faint,
              fontFamily: FONT.ui,
              fontStyle: 'italic',
              lineHeight: 1.7,
            }}>
              No permanent notes yet.<br />
              Your first permanent note can be saved without links — it will anchor the graph.
            </div>
          ) : (
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 500,
                color: TEXT.faint,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                marginBottom: 12,
                fontFamily: FONT.ui,
              }}>
                Link to permanent notes
              </div>
              <LinkPicker db={db} selectedIds={linkedIds} onToggle={toggleLink} />
            </div>
          )}
        </>
      )}

      {/* Error */}
      {blockReason && (
        <div style={{
          marginBottom: 14,
          padding: '9px 12px',
          background: 'rgba(176,108,104,0.10)', // ACCENT.danger (#b06c68) at 10% opacity
          border: `1px solid rgba(176,108,104,0.25)`, // ACCENT.danger at 25% opacity
          borderRadius: 5,
          fontSize: 12,
          color: ACCENT.danger,
          letterSpacing: '0.01em',
        }}>
          {blockReason}
        </div>
      )}

      {/* Requirements checklist */}
      {step === 'literature-to-permanent' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-block',
              fontFamily: FONT.mono,
              fontSize: 11,
              color: ownWords ? ACCENT.success : TEXT.faint,
              width: 14,
              flexShrink: 0,
            }}>
              {ownWords ? '✓' : '✗'}
            </span>
            <span style={{ fontSize: 11, color: TEXT.secondary, fontFamily: FONT.ui }}>
              Written in own words
            </span>
          </div>
          {totalPermanentNotes > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-block',
                fontFamily: FONT.mono,
                fontSize: 11,
                color: linkedIds.length > 0 ? ACCENT.success : TEXT.faint,
                width: 14,
                flexShrink: 0,
              }}>
                {linkedIds.length > 0 ? '✓' : '✗'}
              </span>
              <span style={{ fontSize: 11, color: TEXT.secondary, fontFamily: FONT.ui }}>
                At least one link selected
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action */}
      {step === 'fleeting-to-literature' ? (
        <button
          onClick={activeDraftType === 'literature' ? handleCreateLiteratureDraft : handlePromoteToLiterature}
          style={actionButtonStyle(!!sourceId)}
        >
          {activeDraftType === 'literature' ? 'Create Literature Note' : 'Promote to Literature'}
        </button>
      ) : (
        <button
          onClick={activeDraftType === 'permanent' ? handleCreatePermanentDraft : handleSavePermanent}
          style={actionButtonStyle(canSavePermanent)}
        >
          {activeDraftType === 'permanent' ? 'Create Permanent Note' : 'Save as Permanent Note'}
        </button>
      )}
    </div>
  )
}

function actionButtonStyle(active: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '13px 16px',
    border: `1px solid ${active ? ACCENT.ink : BORDER.faint}`,
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 500,
    cursor: active ? 'pointer' : 'default',
    background: active ? ACCENT.inkSoft : BG.raised,
    color: active ? TEXT.primary : TEXT.faint,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontFamily: FONT.ui,
  }
}
