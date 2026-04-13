import { useEffect, useRef, useState } from 'react'
import { createNote, getLinkedNoteIds, getNoteById, updateNote, type Database, type Note } from '@zettelkasten/core'
import type { WorkspaceTarget } from '../../App'
import { BG, BORDER } from '../../theme'
import {
  createPermanentDraft,
  promoteFleetingToLiterature,
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

export default function NoteWorkspace({ db, target, onOpenNoteId, onInboxCountChange }: Props) {
  const [loadedNote, setLoadedNote] = useState<Note | null>(null)
  const [draft, setDraft] = useState<WorkspaceDraft>(EMPTY_DRAFT)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [error, setError] = useState<string | null>(null)
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
      setLoadedNote(null)
      setDraft(EMPTY_DRAFT)
      setSaveState('saved')
      setError(null)
      return
    }

    if (target.mode === 'draft') {
      inFlightSave.current = null
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
      inFlightSave.current = {
        noteId: loadedNote.id,
        title: draft.title,
        content: draft.content,
        sourceId: draft.sourceId,
      }
      setSaveState('saving')
      void updateNote(db, loadedNote.id, {
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
          setSaveState('saved')
        })
        .catch(() => {
          if (targetVersion.current !== saveVersion) {
            return
          }
          inFlightSave.current = null
          setSaveState('error')
        })
    }, 450)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [db, draft.content, draft.sourceId, draft.title, loadedNote])

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

  return (
    <div
      className="workspace-pane"
      style={{
        display: 'grid',
        gridTemplateColumns: '280px minmax(0, 1fr) 320px',
        height: '100%',
        background: BG.base,
        minHeight: 0,
      }}
    >
      <WorkspaceRail db={db} activeNoteId={loadedNote?.id ?? null} onOpenNoteId={onOpenNoteId} />
      <DocumentPane
        title={draft.title}
        content={draft.content}
        saveState={saveState}
        readOnly={!isEditable}
        placeholderTitle={isDraftTarget ? 'Untitled note' : 'Untitled'}
        placeholderBody="Write here..."
        onTitleChange={(title) => {
          setDraft((current) => ({ ...current, title }))
        }}
        onContentChange={(content) => {
          setDraft((current) => ({ ...current, content }))
        }}
      />
      <div style={{
        display: 'grid',
        gridTemplateRows: 'minmax(0, 1fr) auto',
        minHeight: 0,
        overflow: 'hidden',
      }}>
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
        />
        {loadedNote && (
          <div style={{ borderTop: `1px solid ${BORDER.faint}`, padding: 12 }}>
            <ContextGraph db={db} activeNote={loadedNote} onOpenNoteId={(id) => { void onOpenNoteId(id) }} />
          </div>
        )}
      </div>
    </div>
  )
}
