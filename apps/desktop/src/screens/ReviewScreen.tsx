import { useEffect, useState, useCallback } from 'react'
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

const STEP_ORDER = ['fleeting', 'literature', 'permanent'] as const

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
  const editorType = activeDraftType ?? current?.type ?? null

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

  const selectNote = useCallback((note: Note) => {
    setActiveDraftType(null)
    setCurrent(note)
    setTitle(note.title)
    setContent(note.content)
    setSourceId(note.source_id)
    setOwnWords(false)
    setLinkedIds([])
    setBlockReason(null)
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
    const currentPermanentCount = await countNotesByType(db, 'permanent')
    const check = canSavePermanentNote(
      { own_words_confirmed: ownWords ? 1 : 0 },
      { linkedPermanentNoteIds: linkedIds, totalPermanentNotes: currentPermanentCount }
    )
    if (!check.ok) { setBlockReason(check.reason); return }

    await savePermanentNote(current.id)
    setCurrent(null)
    setBlockReason(null)
    await loadQueue()
  }

  async function handleCreatePermanentDraft() {
    const currentPermanentCount = await countNotesByType(db, 'permanent')
    const check = canSavePermanentNote(
      { own_words_confirmed: ownWords ? 1 : 0 },
      { linkedPermanentNoteIds: linkedIds, totalPermanentNotes: currentPermanentCount }
    )
    if (!check.ok) {
      setBlockReason(check.reason)
      return
    }

    await savePermanentNote()
    setActiveDraftType(null)
    setCurrent(null)
    setBlockReason(null)
    await loadQueue()
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
            fontWeight: 600,
            color: TEXT.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.10em',
            marginBottom: 20,
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
                  background: BG.card,
                  border: `1px solid ${BORDER.base}`,
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
                  fontFamily: FONT.serif,
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
                  fontWeight: 600,
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
    <div style={{ padding: '24px 28px', background: BG.base, height: '100%', overflowY: 'auto' }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
        {STEP_ORDER.map((s, i) => {
          const active = editorType === s
          const isDone = editorType ? STEP_ORDER.indexOf(editorType) > i : false
          const stepTypeColors = { fleeting: ACCENT.amber, literature: ACCENT.blue, permanent: ACCENT.violet }
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {i > 0 && (
                <div style={{
                  width: 20,
                  height: 1,
                  background: isDone ? TEXT.dim : BORDER.base,
                  margin: '0 6px',
                }} />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: active ? stepTypeColors[s] : isDone ? TEXT.dim : BORDER.hi,
                }} />
                <span style={{
                  fontSize: 10,
                  color: active ? stepTypeColors[s] : TEXT.muted,
                  fontWeight: active ? 600 : 400,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  {s}
                </span>
              </div>
            </div>
          )
        })}
        <button
          onClick={() => {
            setCurrent(null)
            setActiveDraftType(null)
          }}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: 'none',
            color: TEXT.muted,
            cursor: 'pointer',
            fontSize: 11,
            letterSpacing: '0.03em',
          }}
        >
          ← queue
        </button>
      </div>

      {/* Title */}
      <div style={{ marginBottom: 16 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            borderBottom: `1px solid ${BORDER.base}`,
            color: TEXT.primary,
            fontFamily: FONT.serif,
            fontSize: 22,
            fontWeight: 500,
            padding: '4px 0 10px',
            marginBottom: 16,
            outline: 'none',
            letterSpacing: '0.01em',
            lineHeight: 1.3,
          }}
        />
        <MarkdownEditor value={content} onChange={setContent} minHeight="140px" />
      </div>

      {/* Source section */}
      {step === 'fleeting-to-literature' && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: TEXT.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.10em',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            Source
            <span style={{ color: ACCENT.red, fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>
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
                style={{ width: 14, height: 14, accentColor: ACCENT.green }}
              />
              <span style={{ fontSize: 12, color: TEXT.dim }}>Written in my own words</span>
            </label>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              color: TEXT.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.10em',
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              Link to permanent notes
              <span style={{ color: ACCENT.red, fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>
                *required
              </span>
            </div>
            <LinkPicker db={db} selectedIds={linkedIds} onToggle={toggleLink} />
          </div>
        </>
      )}

      {/* Error */}
      {blockReason && (
        <div style={{
          marginBottom: 14,
          padding: '9px 12px',
          background: 'rgba(184,85,85,0.10)',
          border: `1px solid rgba(184,85,85,0.25)`,
          borderRadius: 5,
          fontSize: 12,
          color: ACCENT.red,
          letterSpacing: '0.01em',
        }}>
          {blockReason}
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
    padding: '12px',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    cursor: active ? 'pointer' : 'default',
    background: active ? ACCENT.gold : BG.hover,
    color: active ? BG.base : TEXT.muted,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
  }
}
