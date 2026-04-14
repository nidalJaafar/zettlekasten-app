import { useEffect, useRef, useState } from 'react'
import { createNote, getLinkedNoteIds, getNoteById, softDeleteNote, type Database, type Note } from '@zettelkasten/core'
import type { WorkspaceTarget } from '../../App'
import { BG, BORDER } from '../../theme'
import {
  createPermanentDraft,
  promoteFleetingToLiterature,
  savePersistedNote,
  saveLiteratureAsPermanent,
  syncNoteLinks,
} from '../../lib/note-workflow'
import DocumentPane from './DocumentPane'
import NoteContextPane from './NoteContextPane'
import type { SaveState } from './SaveStatus'
import WorkspaceRail from './WorkspaceRail'
import ContextGraph from './ContextGraph'

interface Props {
  db: Database
  target: WorkspaceTarget | null
  onOpenNoteId: (noteId: string) => Promise<void>
  onOpenTarget: (target: WorkspaceTarget | null) => void
  onInboxCountChange: () => Promise<void> | void
}

export interface WorkspaceDraft {
  title: string
  content: string
  sourceId: string | null
  ownWords: boolean
  linkedIds: string[]
}

export const EMPTY_DRAFT: WorkspaceDraft = {
  title: '',
  content: '',
  sourceId: null,
  ownWords: false,
  linkedIds: [],
}

function createDraftFromNote(note: Note): WorkspaceDraft {
  return {
    title: note.title,
    content: note.content,
    sourceId: note.source_id,
    ownWords: note.own_words_confirmed === 1,
    linkedIds: [],
  }
}

async function findNoteIdByTitle(db: Database, title: string): Promise<string | null> {
  const match = await db.queryOne<{ id: string }>(
    `SELECT id FROM notes WHERE title = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1`,
    [title]
  )

  return match?.id ?? null
}

export default function NoteWorkspace({ db, target, onOpenNoteId, onOpenTarget, onInboxCountChange }: Props) {
  const [loadedNote, setLoadedNote] = useState<Note | null>(null)
  const [draft, setDraft] = useState<WorkspaceDraft>(EMPTY_DRAFT)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [error, setError] = useState<string | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const inFlightSave = useRef<{
    noteId: string
    title: string
    content: string
    sourceId: string | null
  } | null>(null)
  const targetVersion = useRef(0)
  const isDraftTarget = target?.mode === 'draft'
  const isEditable = Boolean(target)

  useEffect(() => {
    let cancelled = false
    const version = targetVersion.current + 1
    targetVersion.current = version

    if (!target) {
      inFlightSave.current = null
      setDeletePending(false)
      setLoadedNote(null)
      setDraft(EMPTY_DRAFT)
      setSaveState('saved')
      setError(null)
      return
    }

    if (target.mode === 'draft') {
      inFlightSave.current = null
      setDeletePending(false)
      setLoadedNote(null)
      setDraft(EMPTY_DRAFT)
      setSaveState('dirty')
      setError(null)
      return
    }

    setError(null)

    void getNoteById(db, target.noteId)
      .then(async (note) => {
        if (cancelled || targetVersion.current !== version) return
        if (!note) {
          inFlightSave.current = null
          setLoadedNote(null)
          setDraft(EMPTY_DRAFT)
          setSaveState('error')
          setError('Note not found.')
          return
        }

        const linkedIds = note.type === 'fleeting' ? [] : await getLinkedNoteIds(db, note.id)
        if (cancelled || targetVersion.current !== version) return

        setLoadedNote(note)
        setDraft({ ...createDraftFromNote(note), linkedIds })
        inFlightSave.current = null
        setSaveState('saved')
      })
      .catch((err) => {
        if (cancelled || targetVersion.current !== version) return
        inFlightSave.current = null
        setLoadedNote(null)
        setDraft(EMPTY_DRAFT)
        setSaveState('error')
        setError(String(err))
      })

    return () => {
      cancelled = true
    }
  }, [db, target])

  useEffect(() => {
    if (!loadedNote) return

    const titleChanged = draft.title !== loadedNote.title
    const contentChanged = draft.content !== loadedNote.content
    const sourceChanged = loadedNote.type !== 'permanent' && draft.sourceId !== loadedNote.source_id
    const activeSave = inFlightSave.current

    if (deletePending) {
      if (titleChanged || contentChanged || sourceChanged) {
        setSaveState('dirty')
      }
      return
    }

    if (!titleChanged && !contentChanged && !sourceChanged) {
      if (!activeSave) {
        setSaveState('saved')
      }
      return
    }

    if (
      activeSave
      && activeSave.noteId === loadedNote.id
      && activeSave.title === draft.title
      && activeSave.content === draft.content
      && activeSave.sourceId === draft.sourceId
    ) {
      setSaveState('saving')
      return
    }

    setSaveState('dirty')

    const saveVersion = targetVersion.current
    const timeoutId = window.setTimeout(() => {
      if (deletePending || targetVersion.current !== saveVersion) {
        return
      }

      inFlightSave.current = {
        noteId: loadedNote.id,
        title: draft.title,
        content: draft.content,
        sourceId: draft.sourceId,
      }
      setError(null)
      setSaveState('saving')
      void savePersistedNote(db, loadedNote, {
        title: draft.title,
        content: draft.content,
        ...(loadedNote.type !== 'permanent' ? { source_id: draft.sourceId } : {}),
      })
        .then(() => {
          if (targetVersion.current !== saveVersion) {
            return
          }
          inFlightSave.current = null
           setLoadedNote((current) => (current && current.id === loadedNote.id
             ? {
                 ...current,
                 title: draft.title,
                 content: draft.content,
                source_id: loadedNote.type === 'permanent' ? current.source_id : draft.sourceId,
                updated_at: Date.now(),
               }
             : current))
           setError(null)
           setSaveState('saved')
         })
        .catch((err) => {
          if (targetVersion.current !== saveVersion) {
            return
          }
          inFlightSave.current = null
          setError(err instanceof Error ? err.message : String(err))
          setSaveState('error')
        })
    }, 450)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [db, deletePending, draft.content, draft.sourceId, draft.title, loadedNote])

  async function handlePromoteToLiterature() {
    setError(null)

    if (!draft.sourceId) {
      setError('Attach a source before promoting to a literature note.')
      return
    }

    try {
      if (isDraftTarget) {
        const created = await createNote(db, {
          type: 'literature',
          title: draft.title,
          content: draft.content,
          source_id: draft.sourceId,
        })
        await onOpenNoteId(created.id)
        return
      }

      if (!loadedNote || loadedNote.type !== 'fleeting') return

      await promoteFleetingToLiterature(db, loadedNote, draft.title, draft.content, draft.sourceId)
      setLoadedNote({
        ...loadedNote,
        type: 'literature',
        title: draft.title,
        content: draft.content,
        source_id: draft.sourceId,
        updated_at: Date.now(),
      })
      setSaveState('saved')
      await onInboxCountChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleSaveAsPermanent() {
    setError(null)

    try {
      if (isDraftTarget) {
        const created = await createPermanentDraft(
          db,
          draft.title,
          draft.content,
          draft.linkedIds,
          draft.ownWords
        )
        await onOpenNoteId(created.id)
        return
      }

      if (!loadedNote) return

      if (loadedNote.type === 'literature') {
        const created = await saveLiteratureAsPermanent(
          db,
          loadedNote,
          draft.title,
          draft.content,
          draft.linkedIds,
          draft.ownWords
        )
        await onOpenNoteId(created.id)
        return
      }

      if (loadedNote.type === 'permanent') {
        await syncNoteLinks(db, loadedNote.id, draft.linkedIds)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleLinkClick(linkText: string) {
    setError(null)

    const linkedNoteId = await findNoteIdByTitle(db, linkText)
    if (!linkedNoteId) {
      setError(`Linked note not found: ${linkText}`)
      return
    }

    await onOpenNoteId(linkedNoteId)
  }

  async function handleDeleteNote() {
    if (!loadedNote) return

    const confirmed = window.confirm('Delete this note? You can no longer open it from the workspace.')
    if (!confirmed) return

    setError(null)
    setDeletePending(true)
    targetVersion.current += 1
    inFlightSave.current = null

    try {
      await softDeleteNote(db, loadedNote.id)
      await onInboxCountChange()
      onOpenTarget(null)
    } catch (err) {
      setDeletePending(false)
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div
      className="workspace-pane"
      style={{
        display: 'flex',
        height: '100%',
        background: BG.base,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <div style={{ width: 240, flexShrink: 0, borderRight: `1px solid ${BORDER.faint}`, overflow: 'auto' }}>
        <WorkspaceRail db={db} activeNoteId={loadedNote?.id ?? null} onOpenNoteId={onOpenNoteId} />
      </div>

      <div style={{ flex: '1 1 0%', minWidth: 0, minHeight: 0, overflow: 'auto' }}>
        <DocumentPane
          key={target ? (target.mode === 'draft' ? `draft:${target.noteType}` : `note:${target.noteId}`) : 'workspace-empty'}
          title={draft.title}
          content={draft.content}
          saveState={saveState}
          defaultMode={target?.mode === 'note' ? 'preview' : 'code'}
          readOnly={!isEditable}
          placeholderTitle={isDraftTarget ? 'Untitled note' : 'Untitled'}
          placeholderBody="Write here..."
          onTitleChange={(title) => {
            setDraft((current) => ({ ...current, title }))
          }}
          onContentChange={(content) => {
            setDraft((current) => ({ ...current, content }))
          }}
          onLinkClick={(linkText) => {
            void handleLinkClick(linkText)
          }}
        />
      </div>

      <div style={{
        width: 280,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        borderLeft: `1px solid ${BORDER.faint}`,
        overflow: 'hidden',
      }}>
        <div style={{ flex: '1 1 0%', overflow: 'auto', minHeight: 0 }}>
          <NoteContextPane
            db={db}
            note={loadedNote}
            draftType={target?.mode === 'draft' ? target.noteType : null}
            sourceId={draft.sourceId}
            ownWords={draft.ownWords}
            linkedIds={draft.linkedIds}
            error={error}
            onSourceIdChange={(sourceId) => {
              setDraft((current) => ({ ...current, sourceId }))
            }}
            onOwnWordsChange={(ownWords) => {
              setDraft((current) => ({ ...current, ownWords }))
            }}
            onToggleLink={(noteId) => {
              setDraft((current) => ({
                ...current,
                linkedIds: current.linkedIds.includes(noteId)
                  ? current.linkedIds.filter((id) => id !== noteId)
                  : [...current.linkedIds, noteId],
              }))
            }}
            onPromoteToLiterature={handlePromoteToLiterature}
            onSaveAsPermanent={handleSaveAsPermanent}
            onDeleteNote={loadedNote ? handleDeleteNote : undefined}
          />
        </div>
        {loadedNote && (
          <div style={{ borderTop: `1px solid ${BORDER.faint}`, padding: 12, flexShrink: 0 }}>
            <ContextGraph db={db} activeNote={loadedNote} onOpenNoteId={(id) => { void onOpenNoteId(id) }} />
          </div>
        )}
      </div>
    </div>
  )
}
