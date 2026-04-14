import { useEffect, useRef, useState } from 'react'
import { createNote, getLinkedNoteIds, getNoteById, softDeleteNote, type Database, type Note } from '@zettelkasten/core'
import type { WorkspaceTarget } from '../../App'
import { ACCENT, BG, BORDER, TEXT } from '../../theme'
import {
  createPermanentDraft,
  promoteFleetingToLiterature,
  savePersistedNote,
  saveLiteratureAsPermanent,
  syncNoteLinks,
} from '../../lib/note-workflow'
import DocumentPane from './DocumentPane'
import type { WikilinkOption } from '../MarkdownEditor'
import NoteContextPane from './NoteContextPane'
import type { SaveState } from './SaveStatus'
import WorkspaceRail from './WorkspaceRail'
import ContextGraph from './ContextGraph'
import { useResizablePane } from '../../hooks/useResizablePane'
import { WORKSPACE_CONTEXT_PANE, WORKSPACE_RAIL_PANE } from '../../lib/layout'

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

const COMPACT_WORKSPACE_BREAKPOINT = 1200
const COMPACT_DRAWER_OVERLAY = `${BG.canvas}b8`
const COMPACT_DRAWER_SHADOW = `0 0 32px ${BG.canvas}`

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
  const railPane = useResizablePane(WORKSPACE_RAIL_PANE)
  const contextPane = useResizablePane({ ...WORKSPACE_CONTEXT_PANE, direction: 'right' })
  const [loadedNote, setLoadedNote] = useState<Note | null>(null)
  const [draft, setDraft] = useState<WorkspaceDraft>(EMPTY_DRAFT)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [error, setError] = useState<string | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const [sourceDetails, setSourceDetails] = useState<{
    type: string
    label: string
    description: string | null
  } | null>(null)
  const inFlightSave = useRef<{
    noteId: string
    title: string
    content: string
    sourceId: string | null
  } | null>(null)
  const targetVersion = useRef(0)
  const isDraftTarget = target?.mode === 'draft'
  const isEditable = Boolean(target)
  const [isCompact, setIsCompact] = useState(() => window.innerWidth < COMPACT_WORKSPACE_BREAKPOINT)
  const [openCompactPanel, setOpenCompactPanel] = useState<'rail' | 'context' | null>(null)
  const [wikilinkOptions, setWikilinkOptions] = useState<WikilinkOption[]>([])

  useEffect(() => {
    function syncCompactMode() {
      setIsCompact(window.innerWidth < COMPACT_WORKSPACE_BREAKPOINT)
    }

    window.addEventListener('resize', syncCompactMode)
    return () => {
      window.removeEventListener('resize', syncCompactMode)
    }
  }, [])

  useEffect(() => {
    if (!isCompact) {
      setOpenCompactPanel(null)
    }
  }, [isCompact])

  useEffect(() => {
    if (isCompact) {
      setOpenCompactPanel(null)
    }
  }, [isCompact, target])

  useEffect(() => {
    let cancelled = false
    void db.query<{ id: string; title: string }>(
      'SELECT id, title FROM notes WHERE deleted_at IS NULL ORDER BY updated_at DESC'
    ).then((rows) => {
      if (cancelled) return
      setWikilinkOptions(rows)
    })
    return () => { cancelled = true }
  }, [db, target])

  useEffect(() => {
    if (!draft.sourceId) {
      setSourceDetails(null)
      return
    }
    let cancelled = false
    void db.queryOne<{ type: string; label: string; description: string | null }>(
      'SELECT type, label, description FROM sources WHERE id = ?',
      [draft.sourceId]
    ).then((row) => {
      if (cancelled) return
      setSourceDetails(row ?? null)
    })
    return () => { cancelled = true }
  }, [db, draft.sourceId])

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

  async function handleCreateWikilinkNote(title: string) {
    const created = await createNote(db, { type: 'fleeting', title })
    await onInboxCountChange()
    void db.query<{ id: string; title: string }>(
      'SELECT id, title FROM notes WHERE deleted_at IS NULL ORDER BY updated_at DESC'
    ).then((rows) => {
      setWikilinkOptions(rows)
    })
    return { id: created.id, title: created.title }
  }

  async function handleRailOpenNote(noteId: string) {
    await onOpenNoteId(noteId)

    if (isCompact) {
      setOpenCompactPanel(null)
    }
  }

  async function handleOpenNote(noteId: string) {
    await onOpenNoteId(noteId)

    if (isCompact) {
      setOpenCompactPanel(null)
    }
  }

  const railContent = (
    <div
      data-testid="workspace-rail-pane"
      style={{ width: isCompact ? '100%' : railPane.width, flexShrink: 0, borderRight: `1px solid ${BORDER.faint}`, overflow: 'auto' }}
    >
      <WorkspaceRail db={db} activeNoteId={loadedNote?.id ?? null} onOpenNoteId={handleRailOpenNote} />
    </div>
  )

  const contextContent = (
    <div data-testid="workspace-context-pane" style={{
      width: isCompact ? '100%' : contextPane.width,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      borderLeft: isCompact ? 'none' : `1px solid ${BORDER.faint}`,
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
          <ContextGraph db={db} activeNote={loadedNote} onOpenNoteId={(id) => { void handleOpenNote(id) }} />
        </div>
      )}
    </div>
  )

  return (
    <div
      className="workspace-pane"
      style={{
        display: 'flex',
        height: '100%',
        background: BG.base,
        minHeight: 0,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {!isCompact && railContent}

      {!isCompact && (
        <div
          data-testid="workspace-rail-resize-handle"
          {...railPane.handleProps}
          aria-label="Resize workspace rail"
          className={`pane-resize-handle workspace-resize-handle${railPane.isDragging ? ' is-dragging' : ''}`}
        />
      )}

      <div style={{ flex: '1 1 0%', minWidth: 0, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {isCompact && (
          <div
            className="workspace-compact-toolbar"
            style={{
              display: 'flex',
              gap: 8,
              padding: 12,
              borderBottom: `1px solid ${BORDER.faint}`,
              background: BG.panel,
              position: 'sticky',
              top: 0,
              zIndex: 1,
            }}
          >
            <button
              type="button"
              className="workspace-compact-toggle"
              aria-label={`${openCompactPanel === 'rail' ? 'Hide' : 'Show'} notes panel`}
              aria-pressed={openCompactPanel === 'rail'}
              onClick={() => {
                setOpenCompactPanel((current) => (current === 'rail' ? null : 'rail'))
              }}
              style={{
                border: `1px solid ${openCompactPanel === 'rail' ? ACCENT.ink : BORDER.base}`,
                background: openCompactPanel === 'rail' ? ACCENT.inkSoft : BG.raised,
                color: TEXT.primary,
                borderRadius: 999,
                padding: '8px 12px',
              }}
            >
              Notes
            </button>
            <button
              type="button"
              className="workspace-compact-toggle"
              aria-label={`${openCompactPanel === 'context' ? 'Hide' : 'Show'} context panel`}
              aria-pressed={openCompactPanel === 'context'}
              onClick={() => {
                setOpenCompactPanel((current) => (current === 'context' ? null : 'context'))
              }}
              style={{
                border: `1px solid ${openCompactPanel === 'context' ? ACCENT.ink : BORDER.base}`,
                background: openCompactPanel === 'context' ? ACCENT.inkSoft : BG.raised,
                color: TEXT.primary,
                borderRadius: 999,
                padding: '8px 12px',
              }}
            >
              Context
            </button>
          </div>
        )}
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
          wikilinkOptions={wikilinkOptions}
          onCreateWikilinkNote={(title) => handleCreateWikilinkNote(title)}
          sourceDetails={draft.sourceId ? sourceDetails : null}
        />
      </div>

      {!isCompact && (
        <div
          data-testid="workspace-context-resize-handle"
          {...contextPane.handleProps}
          aria-label="Resize workspace context"
          className={`pane-resize-handle workspace-resize-handle${contextPane.isDragging ? ' is-dragging' : ''}`}
        />
      )}

      {!isCompact && contextContent}

      {isCompact && openCompactPanel && (
        <div className="workspace-compact-overlay" style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: openCompactPanel === 'rail' ? 'flex-start' : 'flex-end', background: COMPACT_DRAWER_OVERLAY }}>
          <button
            type="button"
            aria-label="Close workspace panel"
            className="workspace-compact-backdrop"
            onClick={() => {
              setOpenCompactPanel(null)
            }}
            style={{ position: 'absolute', inset: 0, border: 'none', background: 'transparent', padding: 0 }}
          />
          <div
            className="workspace-compact-drawer"
            style={{
              position: 'relative',
              zIndex: 1,
              width: 'min(360px, calc(100% - 32px))',
              height: '100%',
              background: BG.panel,
              borderLeft: openCompactPanel === 'context' ? `1px solid ${BORDER.faint}` : 'none',
              borderRight: openCompactPanel === 'rail' ? `1px solid ${BORDER.faint}` : 'none',
              boxShadow: COMPACT_DRAWER_SHADOW,
            }}
          >
            {openCompactPanel === 'rail' ? railContent : contextContent}
          </div>
        </div>
      )}
    </div>
  )
}
