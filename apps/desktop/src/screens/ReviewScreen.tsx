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

interface Props {
  db: Database
}

type ReviewStep = 'fleeting-to-literature' | 'literature-to-permanent'

export default function ReviewScreen({ db }: Props) {
  const [queue, setQueue] = useState<Note[]>([])
  const [current, setCurrent] = useState<Note | null>(null)
  const [step, setStep] = useState<ReviewStep>('fleeting-to-literature')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [ownWords, setOwnWords] = useState(false)
  const [linkedIds, setLinkedIds] = useState<string[]>([])
  const [blockReason, setBlockReason] = useState<string | null>(null)

  const loadQueue = useCallback(async () => {
    const fleeting = await getNotesByType(db, 'fleeting')
    const literature = await getNotesByType(db, 'literature')
    setQueue([...fleeting, ...literature])
  }, [db])

  useEffect(() => { loadQueue() }, [loadQueue])

  // Listen for process events from Inbox
  useEffect(() => {
    const handler = (e: Event) => {
      const note = (e as CustomEvent<Note>).detail
      selectNote(note)
    }
    window.addEventListener('zettel:review', handler)
    return () => window.removeEventListener('zettel:review', handler)
  }, [])

  function selectNote(note: Note) {
    setCurrent(note)
    setTitle(note.title)
    setContent(note.content)
    setSourceId(note.source_id)
    setOwnWords(false)
    setLinkedIds([])
    setBlockReason(null)
    setStep(note.type === 'fleeting' ? 'fleeting-to-literature' : 'literature-to-permanent')
  }

  async function handlePromoteToLiterature() {
    if (!current) return
    const check = canPromoteToLiterature({ ...current, source_id: sourceId })
    if (!check.ok) { setBlockReason(check.reason); return }
    await updateNote(db, current.id, { type: 'literature', title, content, source_id: sourceId! })
    const updated = { ...current, type: 'literature' as const, title, content, source_id: sourceId }
    setCurrent(updated)
    setStep('literature-to-permanent')
    setBlockReason(null)
  }

  async function handleSavePermanent() {
    if (!current) return
    const totalPermanent = await countNotesByType(db, 'permanent')
    const check = canSavePermanentNote(
      { own_words_confirmed: ownWords ? 1 : 0 },
      { linkedPermanentNoteIds: linkedIds, totalPermanentNotes: totalPermanent }
    )
    if (!check.ok) { setBlockReason(check.reason); return }

    // Create new permanent note, preserve literature note
    const permanent = await createNote(db, {
      type: 'permanent',
      title,
      content,
    })
    await updateNote(db, permanent.id, { own_words_confirmed: 1 })
    for (const id of linkedIds) {
      await addLink(db, permanent.id, id)
    }
    setCurrent(null)
    setBlockReason(null)
    await loadQueue()
  }

  function toggleLink(id: string) {
    setLinkedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  if (queue.length === 0 && !current) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#555', fontSize: 14 }}>
        Queue is empty. Capture some fleeting notes first.
      </div>
    )
  }

  if (!current) {
    return (
      <div style={{ padding: 24, background: '#1a1a2e', height: '100%' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#e0e0ff', marginBottom: 16 }}>
          Review Queue ({queue.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {queue.map((note) => (
            <button
              key={note.id}
              onClick={() => selectNote(note)}
              style={{
                background: '#22223a',
                border: '1px solid #3d3d6b',
                borderRadius: 8,
                padding: '12px 14px',
                textAlign: 'left',
                cursor: 'pointer',
                color: '#e0e0ff',
              }}
            >
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 4,
                background: note.type === 'fleeting' ? '#ffd32a22' : '#6c63ff22',
                color: note.type === 'fleeting' ? '#ffd32a' : '#6c63ff',
                marginRight: 8,
                textTransform: 'uppercase',
              }}>
                {note.type}
              </span>
              {note.title}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, background: '#1a1a2e', height: '100%', overflowY: 'auto' }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        {(['fleeting', 'literature', 'permanent'] as const).map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <div style={{ width: 24, height: 1, background: '#3d3d6b' }} />}
            <div style={{
              padding: '4px 12px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600,
              background: current.type === s ? '#6c63ff22' : 'transparent',
              color: current.type === s ? '#6c63ff' : '#555',
              border: `1px solid ${current.type === s ? '#6c63ff' : '#2a2a4a'}`,
            }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </div>
          </div>
        ))}
        <button
          onClick={() => setCurrent(null)}
          style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 12 }}
        >
          ← Back to queue
        </button>
      </div>

      {/* Note editor */}
      <div style={{ marginBottom: 16 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid #3d3d6b',
            color: '#e0e0ff',
            fontSize: 18,
            fontWeight: 700,
            padding: '4px 0',
            marginBottom: 12,
            outline: 'none',
          }}
        />
        <MarkdownEditor value={content} onChange={setContent} minHeight="140px" />
      </div>

      {/* Step-specific gates */}
      {step === 'fleeting-to-literature' && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7f8fa6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Attach a source <span style={{ color: '#ff6b81' }}>*required</span>
          </div>
          <SourcePicker db={db} selectedId={sourceId} onSelect={setSourceId} />
        </div>
      )}

      {step === 'literature-to-permanent' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={ownWords}
                onChange={(e) => setOwnWords(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#2ed573' }}
              />
              <span style={{ fontSize: 13, color: '#b0b0cc' }}>I wrote this in my own words</span>
            </label>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7f8fa6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Link to permanent notes <span style={{ color: '#ff6b81' }}>*required</span>
            </div>
            <LinkPicker db={db} selectedIds={linkedIds} onToggle={toggleLink} />
          </div>
        </>
      )}

      {/* Error message */}
      {blockReason && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#ff6b8122', border: '1px solid #ff6b8155', borderRadius: 6, fontSize: 12, color: '#ff6b81' }}>
          {blockReason}
        </div>
      )}

      {/* Action button */}
      {step === 'fleeting-to-literature' ? (
        <button
          onClick={handlePromoteToLiterature}
          style={actionButtonStyle(!!sourceId)}
        >
          Promote to Literature →
        </button>
      ) : (
        <button
          onClick={handleSavePermanent}
          style={actionButtonStyle(ownWords && linkedIds.length > 0)}
        >
          Save as Permanent note ✓
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
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: active ? 'pointer' : 'default',
    background: active ? '#2ed573' : '#2a2a4a',
    color: active ? '#1a1a2e' : '#555',
    transition: 'background 0.2s',
  }
}
