# Note Workspace Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make notes the primary unit of the desktop app by introducing a dedicated note workspace with direct editing, auto-save, note-aware side context, and a contextual graph that supports navigation.

**Architecture:** Add a new `workspace` screen owned by `App.tsx`, and route all note-opening events into it. Build the workspace from small desktop-only components: a left rail for switching notes, a document pane for title/body editing with auto-save, a context pane for type-specific actions and metadata, and a shared graph layer that powers both the workspace mini-graph and the expanded graph screen.

**Tech Stack:** React 18, TypeScript, Tauri v2, inline styles, global CSS, CodeMirror, D3, `@zettelkasten/core`

**Important:** Do not create git commits unless the human explicitly asks for them.

---

## File Map

- Modify: `apps/desktop/src/App.tsx`
  Responsibility: own global screen state, workspace target state, and note-opening event routing.
- Modify: `apps/desktop/src/components/Sidebar.tsx`
  Responsibility: expose the new `Workspace` destination in global navigation.
- Modify: `apps/desktop/src/components/NoteCard.tsx`
  Responsibility: give inbox notes a real open action instead of only a review action.
- Modify: `apps/desktop/src/components/GraphCanvas.tsx`
  Responsibility: support shared contextual/full-map rendering with stable focus and selection.
- Delete: `apps/desktop/src/components/NoteModal.tsx`
  Responsibility: remove the old cramped note viewing path once the workspace is live.
- Create: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`
  Responsibility: orchestrate loading, drafting, auto-save, note actions, and graph state for the active workspace target.
- Create: `apps/desktop/src/components/workspace/WorkspaceRail.tsx`
  Responsibility: show note sets and note switching inside the workspace.
- Create: `apps/desktop/src/components/workspace/DocumentPane.tsx`
  Responsibility: render the title field, markdown editor, and save status.
- Create: `apps/desktop/src/components/workspace/NoteContextPane.tsx`
  Responsibility: render source controls, link controls, note-type actions, and contextual metadata.
- Create: `apps/desktop/src/components/workspace/SaveStatus.tsx`
  Responsibility: display quiet save feedback for the current draft.
- Create: `apps/desktop/src/components/workspace/ContextGraph.tsx`
  Responsibility: render the focused neighborhood graph for the active note.
- Create: `apps/desktop/src/lib/note-workflow.ts`
  Responsibility: centralize desktop-only note workflow actions such as promotion and link syncing.
- Create: `apps/desktop/src/lib/graph.ts`
  Responsibility: derive graph neighborhoods and shared graph selections from all notes and links.
- Modify: `apps/desktop/src/screens/InboxScreen.tsx`
  Responsibility: route note selection and new-note actions into the workspace.
- Modify: `apps/desktop/src/screens/LibraryScreen.tsx`
  Responsibility: stop rendering expanded inline note bodies and open notes in the workspace instead.
- Modify: `apps/desktop/src/screens/ReviewScreen.tsx`
  Responsibility: reduce Review to workflow guidance and queue management instead of being the only serious editor.
- Modify: `apps/desktop/src/screens/GraphScreen.tsx`
  Responsibility: reuse the shared graph model as an expanded exploration view that stays in sync with workspace selection.
- Modify: `apps/desktop/src/global.css`
  Responsibility: add any workspace-specific editor and panel refinements that cannot stay inline.

### Task 1: Add Workspace Routing And Global Selection State

**Files:**
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/components/Sidebar.tsx`
- Create: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`
- Test: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Extend `App.tsx` with a first-class workspace target**

Update `apps/desktop/src/App.tsx` so screen state can point at a shared workspace instead of a modal:

```ts
import { useCallback, useEffect, useState } from 'react'
import { getDb } from './db'
import { getNotesByType, getNoteById, runMigrations } from '@zettelkasten/core'
import type { Database, Note } from '@zettelkasten/core'
import Sidebar from './components/Sidebar'
import InboxScreen from './screens/InboxScreen'
import ReviewScreen from './screens/ReviewScreen'
import GraphScreen from './screens/GraphScreen'
import LibraryScreen from './screens/LibraryScreen'
import NoteWorkspace from './components/workspace/NoteWorkspace'

export type Screen = 'inbox' | 'workspace' | 'review' | 'library' | 'graph'

export type WorkspaceTarget =
  | { mode: 'note'; noteId: string }
  | { mode: 'draft'; noteType: 'literature' | 'permanent' }

export default function App() {
  const [db, setDb] = useState<Database | null>(null)
  const [dbError, setDbError] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>('inbox')
  const [inboxCount, setInboxCount] = useState(0)
  const [workspaceTarget, setWorkspaceTarget] = useState<WorkspaceTarget | null>(null)

  const openWorkspaceNote = useCallback((note: Note) => {
    setWorkspaceTarget({ mode: 'note', noteId: note.id })
    setScreen('workspace')
  }, [])

  const openWorkspaceById = useCallback(async (noteId: string) => {
    if (!db) return
    const note = await getNoteById(db, noteId)
    if (!note) return
    openWorkspaceNote(note)
  }, [db, openWorkspaceNote])
```

- [ ] **Step 2: Route existing custom events into the workspace instead of modal/review-only flows**

Replace the event listeners in `App.tsx` with workspace-aware handlers:

```ts
  useEffect(() => {
    const handleReview = (e: Event) => {
      const note = (e as CustomEvent<Note>).detail
      openWorkspaceNote(note)
    }

    const handleNewLiterature = () => {
      setWorkspaceTarget({ mode: 'draft', noteType: 'literature' })
      setScreen('workspace')
    }

    const handleNewPermanent = () => {
      setWorkspaceTarget({ mode: 'draft', noteType: 'permanent' })
      setScreen('workspace')
    }

    const handleOpenNote = (e: Event) => {
      const note = (e as CustomEvent<Note>).detail
      openWorkspaceNote(note)
    }

    window.addEventListener('zettel:review', handleReview)
    window.addEventListener('zettel:new-literature', handleNewLiterature)
    window.addEventListener('zettel:new-permanent', handleNewPermanent)
    window.addEventListener('zettel:open-note', handleOpenNote)

    return () => {
      window.removeEventListener('zettel:review', handleReview)
      window.removeEventListener('zettel:new-literature', handleNewLiterature)
      window.removeEventListener('zettel:new-permanent', handleNewPermanent)
      window.removeEventListener('zettel:open-note', handleOpenNote)
    }
  }, [openWorkspaceNote])
```

- [ ] **Step 3: Render the new workspace screen and remove `NoteModal` usage from `App.tsx`**

Replace the old main-content render block with this version:

```tsx
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar current={screen} onNavigate={setScreen} inboxCount={inboxCount} />
      <main style={{ flex: 1, overflow: 'hidden' }}>
        {screen === 'inbox' && <InboxScreen db={db} onCountChange={setInboxCount} />}
        {screen === 'workspace' && (
          <NoteWorkspace
            db={db}
            target={workspaceTarget}
            onOpenNoteId={openWorkspaceById}
            onOpenTarget={setWorkspaceTarget}
            onInboxCountChange={refreshInboxCount}
          />
        )}
        {screen === 'review' && <ReviewScreen db={db} onOpenNoteId={openWorkspaceById} />}
        {screen === 'library' && <LibraryScreen db={db} />}
        {screen === 'graph' && (
          <GraphScreen
            db={db}
            workspaceTarget={workspaceTarget}
            onOpenNoteId={openWorkspaceById}
          />
        )}
      </main>
    </div>
  )
```

- [ ] **Step 4: Create a compile-safe placeholder `NoteWorkspace` component**

Create `apps/desktop/src/components/workspace/NoteWorkspace.tsx` with a minimal placeholder so the app compiles before the real workspace is built:

```tsx
import type { Database } from '@zettelkasten/core'
import type { WorkspaceTarget } from '../../App'
import { BG, TEXT } from '../../theme'

interface Props {
  db: Database
  target: WorkspaceTarget | null
  onOpenNoteId: (noteId: string) => Promise<void>
  onOpenTarget: (target: WorkspaceTarget | null) => void
  onInboxCountChange: () => Promise<void> | void
}

export default function NoteWorkspace({ target }: Props) {
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', background: BG.base, color: TEXT.secondary }}>
      {target ? 'Workspace loading…' : 'Open a note from Inbox, Library, Review, or Graph.'}
    </div>
  )
}
```

- [ ] **Step 5: Add `Workspace` to the sidebar navigation**

Update `apps/desktop/src/components/Sidebar.tsx` so the nav items include the new screen:

```ts
const items: { id: Screen; label: string }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'review', label: 'Review' },
  { id: 'library', label: 'Library' },
  { id: 'graph', label: 'Graph' },
]
```

- [ ] **Step 6: Run desktop typecheck before building the real workspace**

Run: `pnpm --filter @zettelkasten/desktop typecheck`

Expected: PASS

### Task 2: Build The Workspace Shell, Rail, And Auto-Saving Document Pane

**Files:**
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`
- Create: `apps/desktop/src/components/workspace/WorkspaceRail.tsx`
- Create: `apps/desktop/src/components/workspace/DocumentPane.tsx`
- Create: `apps/desktop/src/components/workspace/SaveStatus.tsx`
- Test: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`

- [ ] **Step 1: Add shared draft and save-state types to `NoteWorkspace.tsx`**

Replace the placeholder with state that supports existing notes and new drafts:

```ts
import { useEffect, useState } from 'react'
import { getNoteById, updateNote } from '@zettelkasten/core'
import type { Database, Note } from '@zettelkasten/core'
import type { WorkspaceTarget } from '../../App'
import WorkspaceRail from './WorkspaceRail'
import DocumentPane from './DocumentPane'
import { type SaveState } from './SaveStatus'
import { BG, BORDER, TEXT } from '../../theme'

export interface WorkspaceDraft {
  title: string
  content: string
  sourceId: string | null
  ownWords: boolean
  linkedIds: string[]
}

const EMPTY_DRAFT: WorkspaceDraft = {
  title: '',
  content: '',
  sourceId: null,
  ownWords: false,
  linkedIds: [],
}
```

- [ ] **Step 2: Load the current target and initialize note or draft state in `NoteWorkspace.tsx`**

Use this effect and helpers:

```ts
  const [loadedNote, setLoadedNote] = useState<Note | null>(null)
  const [draft, setDraft] = useState<WorkspaceDraft>(EMPTY_DRAFT)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [error, setError] = useState<string | null>(null)
  const isDraftTarget = target?.mode === 'draft'

  useEffect(() => {
    let cancelled = false

    async function loadTarget() {
      setError(null)

      if (!target) {
        setLoadedNote(null)
        setDraft(EMPTY_DRAFT)
        setSaveState('saved')
        return
      }

      if (target.mode === 'draft') {
        setLoadedNote(null)
        setDraft(EMPTY_DRAFT)
        setSaveState('saved')
        return
      }

      const note = await getNoteById(db, target.noteId)
      if (!cancelled) {
        setLoadedNote(note)
        setDraft({
          title: note?.title ?? '',
          content: note?.content ?? '',
          sourceId: note?.source_id ?? null,
          ownWords: note?.own_words_confirmed === 1,
          linkedIds: [],
        })
        setSaveState('saved')
      }
    }

    void loadTarget()
    return () => { cancelled = true }
  }, [db, target])
```

- [ ] **Step 3: Add debounced auto-save for title and content changes**

Append this effect to `NoteWorkspace.tsx`:

```ts
  useEffect(() => {
    if (!loadedNote) return

    const titleChanged = draft.title !== loadedNote.title
    const contentChanged = draft.content !== loadedNote.content

    if (!titleChanged && !contentChanged) {
      setSaveState('saved')
      return
    }

    setSaveState('dirty')

    const timer = window.setTimeout(async () => {
      setSaveState('saving')
      try {
        await updateNote(db, loadedNote.id, {
          title: draft.title,
          content: draft.content,
        })

        setLoadedNote((prev) => prev ? {
          ...prev,
          title: draft.title,
          content: draft.content,
          updated_at: Date.now(),
        } : prev)
        setSaveState('saved')
      } catch (err) {
        console.error('workspace autosave failed', err)
        setError('Failed to save note.')
        setSaveState('error')
      }
    }, 450)

    return () => window.clearTimeout(timer)
  }, [db, loadedNote, draft.title, draft.content])
```

- [ ] **Step 4: Create `SaveStatus.tsx` for quiet save feedback**

Create `apps/desktop/src/components/workspace/SaveStatus.tsx`:

```tsx
import { ACCENT, FONT, TEXT } from '../../theme'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

interface Props {
  state: SaveState
}

const copy: Record<SaveState, string> = {
  saved: 'Saved',
  dirty: 'Unsaved changes',
  saving: 'Saving...',
  error: 'Save failed',
}

export default function SaveStatus({ state }: Props) {
  const color = state === 'error' ? ACCENT.danger : state === 'saved' ? TEXT.faint : TEXT.secondary

  return (
    <div style={{ fontSize: 10, color, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: FONT.ui }}>
      {copy[state]}
    </div>
  )
}
```

- [ ] **Step 5: Create the central document pane**

Create `apps/desktop/src/components/workspace/DocumentPane.tsx`:

```tsx
import MarkdownEditor from '../MarkdownEditor'
import SaveStatus, { type SaveState } from './SaveStatus'
import { BG, BORDER, FONT, TEXT } from '../../theme'

interface Props {
  title: string
  content: string
  placeholderTitle: string
  placeholderBody: string
  saveState: SaveState
  onTitleChange: (value: string) => void
  onContentChange: (value: string) => void
}

export default function DocumentPane({
  title,
  content,
  placeholderTitle,
  placeholderBody,
  saveState,
  onTitleChange,
  onContentChange,
}: Props) {
  return (
    <section style={{ minWidth: 0, display: 'flex', flexDirection: 'column', background: BG.base }}>
      <div style={{ padding: '30px 34px 14px' }}>
        <SaveStatus state={saveState} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 34px 34px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={placeholderTitle}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: TEXT.primary,
              fontFamily: FONT.display,
              fontSize: 34,
              lineHeight: 1.2,
              letterSpacing: '-0.015em',
              padding: '0 0 18px',
              outline: 'none',
            }}
          />

          <div style={{ border: `1px solid ${BORDER.faint}`, borderRadius: 18, overflow: 'hidden', background: BG.panel }}>
            <MarkdownEditor
              value={content}
              onChange={onContentChange}
              placeholder={placeholderBody}
              minHeight="62vh"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Create the workspace rail for note switching**

Create `apps/desktop/src/components/workspace/WorkspaceRail.tsx`:

```tsx
import { useEffect, useState } from 'react'
import type { Database, Note } from '@zettelkasten/core'
import { BG, BORDER, FONT, TEXT, typeColor } from '../../theme'

interface Props {
  db: Database
  activeNoteId: string | null
  onOpenNoteId: (noteId: string) => Promise<void>
}

export default function WorkspaceRail({ db, activeNoteId, onOpenNoteId }: Props) {
  const [notes, setNotes] = useState<Note[]>([])

  useEffect(() => {
    db.query<Note>(`
      SELECT *
      FROM notes
      WHERE deleted_at IS NULL
      ORDER BY updated_at DESC
      LIMIT 40
    `).then(setNotes)
  }, [db, activeNoteId])

  return (
    <aside style={{ width: 280, borderRight: `1px solid ${BORDER.faint}`, background: BG.panel, overflowY: 'auto' }}>
      <div style={{ padding: '22px 18px 12px', fontSize: 10, color: TEXT.faint, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        Recent notes
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px 16px' }}>
        {notes.map((note) => {
          const active = note.id === activeNoteId
          return (
            <button
              key={note.id}
              onClick={() => void onOpenNoteId(note.id)}
              className="queue-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                background: active ? BG.hover : 'transparent',
                border: `1px solid ${active ? BORDER.base : 'transparent'}`,
                borderRadius: 10,
                cursor: 'pointer',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: typeColor(note.type), flexShrink: 0 }} />
              <span style={{ flex: 1, color: active ? TEXT.primary : TEXT.secondary, fontFamily: FONT.display, fontSize: 15, lineHeight: 1.35 }}>
                {note.title || 'Untitled'}
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
```

- [ ] **Step 7: Replace the placeholder workspace render with the three-region shell**

Update the `return` block in `NoteWorkspace.tsx` to:

```tsx
  const placeholderTitle = isDraftTarget ? 'Untitled note' : 'Untitled'
  const placeholderBody = 'Write here...'

  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr) 320px', background: BG.base }}>
      <WorkspaceRail db={db} activeNoteId={loadedNote?.id ?? null} onOpenNoteId={onOpenNoteId} />

      <DocumentPane
        title={draft.title}
        content={draft.content}
        placeholderTitle={placeholderTitle}
        placeholderBody={placeholderBody}
        saveState={saveState}
        onTitleChange={(title) => setDraft((prev) => ({ ...prev, title }))}
        onContentChange={(content) => setDraft((prev) => ({ ...prev, content }))}
      />

      <aside style={{ borderLeft: `1px solid ${BORDER.faint}`, background: BG.panel, padding: 20, color: TEXT.secondary }}>
        {error ?? 'Context panel arrives in the next task.'}
      </aside>
    </div>
  )
```

- [ ] **Step 8: Run desktop typecheck for the workspace shell**

Run: `pnpm --filter @zettelkasten/desktop typecheck`

Expected: PASS

### Task 3: Add Note Workflow Actions And The Context Pane

**Files:**
- Create: `apps/desktop/src/lib/note-workflow.ts`
- Create: `apps/desktop/src/components/workspace/NoteContextPane.tsx`
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`
- Modify: `apps/desktop/src/screens/ReviewScreen.tsx`
- Test: `apps/desktop/src/lib/note-workflow.ts`

- [ ] **Step 1: Create shared desktop note workflow helpers**

Create `apps/desktop/src/lib/note-workflow.ts` so workspace and Review use the same promotion rules:

```ts
import {
  addLink,
  canPromoteToLiterature,
  canSavePermanentNote,
  countNotesByType,
  createNote,
  getLinkedNoteIds,
  removeLink,
  updateNote,
} from '@zettelkasten/core'
import type { Database, Note } from '@zettelkasten/core'

async function runInTransaction<T>(db: Database, work: () => Promise<T>): Promise<T> {
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

export async function promoteFleetingToLiterature(db: Database, note: Note, title: string, content: string, sourceId: string | null) {
  const check = canPromoteToLiterature({ ...note, source_id: sourceId })
  if (!check.ok) throw new Error(check.reason)
  if (!sourceId) throw new Error('Literature notes require a source.')

  await updateNote(db, note.id, { type: 'literature', title, content, source_id: sourceId })
  return { ...note, type: 'literature' as const, title, content, source_id: sourceId }
}

export async function saveLiteratureAsPermanent(db: Database, note: Note, title: string, content: string, linkedIds: string[], ownWords: boolean) {
  const totalPermanentNotes = await countNotesByType(db, 'permanent')
  const check = canSavePermanentNote(
    { own_words_confirmed: ownWords ? 1 : 0 },
    { linkedPermanentNoteIds: linkedIds, totalPermanentNotes }
  )
  if (!check.ok) throw new Error(check.reason)

  return runInTransaction(db, async () => {
    const permanent = await createNote(db, { type: 'permanent', title, content })
    await updateNote(db, permanent.id, { own_words_confirmed: 1 })
    for (const linkedId of linkedIds) {
      await addLink(db, permanent.id, linkedId)
    }
    await updateNote(db, note.id, { processed_at: Date.now() })
    return permanent
  })
}

export async function createPermanentDraft(db: Database, title: string, content: string, linkedIds: string[], ownWords: boolean) {
  const totalPermanentNotes = await countNotesByType(db, 'permanent')
  const check = canSavePermanentNote(
    { own_words_confirmed: ownWords ? 1 : 0 },
    { linkedPermanentNoteIds: linkedIds, totalPermanentNotes }
  )
  if (!check.ok) throw new Error(check.reason)

  const permanent = await createNote(db, { type: 'permanent', title, content })
  await updateNote(db, permanent.id, { own_words_confirmed: 1 })
  await syncNoteLinks(db, permanent.id, linkedIds)
  return permanent
}

export async function syncNoteLinks(db: Database, noteId: string, nextLinkedIds: string[]) {
  const currentLinkedIds = await getLinkedNoteIds(db, noteId)
  const current = new Set(currentLinkedIds)
  const next = new Set(nextLinkedIds)

  for (const linkedId of next) {
    if (!current.has(linkedId)) await addLink(db, noteId, linkedId)
  }

  for (const linkedId of current) {
    if (!next.has(linkedId)) await removeLink(db, noteId, linkedId)
  }
}
```

- [ ] **Step 2: Create the context pane UI for source, links, and note actions**

Create `apps/desktop/src/components/workspace/NoteContextPane.tsx`:

```tsx
import type { Database, Note } from '@zettelkasten/core'
import SourcePicker from '../SourcePicker'
import LinkPicker from '../LinkPicker'
import { ACCENT, BG, BORDER, FONT, TEXT } from '../../theme'

interface Props {
  db: Database
  note: Note | null
  draftType: 'literature' | 'permanent' | null
  sourceId: string | null
  ownWords: boolean
  linkedIds: string[]
  error: string | null
  onSourceIdChange: (sourceId: string) => void
  onOwnWordsChange: (value: boolean) => void
  onToggleLink: (noteId: string) => void
  onPromoteToLiterature: () => Promise<void>
  onSaveAsPermanent: () => Promise<void>
}

export default function NoteContextPane(props: Props) {
  const { note, draftType, sourceId, ownWords, linkedIds, error } = props
  const noteType = note?.type ?? draftType

  return (
    <aside style={{ borderLeft: `1px solid ${BORDER.faint}`, background: BG.panel, overflowY: 'auto', padding: 20 }}>
      <div style={{ fontSize: 10, color: TEXT.faint, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 18 }}>
        {noteType ? `${noteType} note` : 'Workspace'}
      </div>

      {(noteType === 'fleeting' || noteType === 'literature') && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, color: TEXT.faint, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
            Source
          </div>
          <SourcePicker db={props.db} selectedId={sourceId} onSelect={props.onSourceIdChange} />
        </div>
      )}

      {noteType === 'literature' && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, color: TEXT.secondary, fontSize: 12 }}>
            <input type="checkbox" checked={ownWords} onChange={(e) => props.onOwnWordsChange(e.target.checked)} />
            Written in my own words
          </label>

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: TEXT.faint, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
              Links
            </div>
            <LinkPicker db={props.db} selectedIds={linkedIds} onToggle={props.onToggleLink} />
          </div>
        </>
      )}

      {noteType === 'permanent' && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, color: TEXT.faint, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
            Links
          </div>
          <LinkPicker db={props.db} selectedIds={linkedIds} onToggle={props.onToggleLink} />
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, border: `1px solid rgba(176,108,104,0.25)`, background: 'rgba(176,108,104,0.10)', color: ACCENT.danger, fontSize: 12, lineHeight: 1.6 }}>
          {error}
        </div>
      )}

      {noteType === 'fleeting' && (
        <button onClick={() => void props.onPromoteToLiterature()} style={primaryButtonStyle}>
          Promote To Literature
        </button>
      )}

      {noteType === 'literature' && (
        <button onClick={() => void props.onSaveAsPermanent()} style={primaryButtonStyle}>
          Save As Permanent
        </button>
      )}

      {noteType === 'permanent' && (
        <button onClick={() => void props.onSaveAsPermanent()} style={primaryButtonStyle}>
          Update Links
        </button>
      )}
    </aside>
  )
}

const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: `1px solid ${ACCENT.ink}`,
  background: ACCENT.inkSoft,
  color: TEXT.primary,
  fontFamily: FONT.ui,
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  cursor: 'pointer',
}
```

- [ ] **Step 3: Pass `db` into the context pane and replace the temporary right sidebar in `NoteWorkspace.tsx`**

Import `NoteContextPane` and render it from `NoteWorkspace.tsx`:

```tsx
import NoteContextPane from './NoteContextPane'

      <NoteContextPane
        db={db}
        note={loadedNote}
        draftType={target?.mode === 'draft' ? target.noteType : null}
        sourceId={draft.sourceId}
        ownWords={draft.ownWords}
        linkedIds={draft.linkedIds}
        error={error}
        onSourceIdChange={(sourceId) => setDraft((prev) => ({ ...prev, sourceId }))}
        onOwnWordsChange={(ownWords) => setDraft((prev) => ({ ...prev, ownWords }))}
        onToggleLink={(noteId) => setDraft((prev) => ({
          ...prev,
          linkedIds: prev.linkedIds.includes(noteId)
            ? prev.linkedIds.filter((id) => id !== noteId)
            : [...prev.linkedIds, noteId],
        }))}
        onPromoteToLiterature={handlePromoteToLiterature}
        onSaveAsPermanent={handleSaveAsPermanent}
      />
```

- [ ] **Step 4: Implement workspace actions for draft creation, fleeting promotion, and literature-to-permanent conversion**

Append these handlers to `NoteWorkspace.tsx`:

```ts
import { createNote, getLinkedNoteIds } from '@zettelkasten/core'
import { createPermanentDraft, promoteFleetingToLiterature, saveLiteratureAsPermanent, syncNoteLinks } from '../../lib/note-workflow'

  useEffect(() => {
    if (!loadedNote || loadedNote.type === 'fleeting') return
    void getLinkedNoteIds(db, loadedNote.id).then((linkedIds) => {
      setDraft((prev) => ({ ...prev, linkedIds }))
    })
  }, [db, loadedNote?.id])

  async function handlePromoteToLiterature() {
    setError(null)

    if (target?.mode === 'draft') {
      if (!draft.sourceId) {
        setError('Attach a source before creating a literature note.')
        return
      }

      const created = await createNote(db, {
        type: 'literature',
        title: draft.title,
        content: draft.content,
        source_id: draft.sourceId,
      })

      onOpenTarget({ mode: 'note', noteId: created.id })
      return
    }

    if (!loadedNote || loadedNote.type !== 'fleeting') return
    const updated = await promoteFleetingToLiterature(db, loadedNote, draft.title, draft.content, draft.sourceId)
    setLoadedNote(updated)
    await onInboxCountChange()
  }

  async function handleSaveAsPermanent() {
    setError(null)

    if (target?.mode === 'draft') {
      const created = await createPermanentDraft(db, draft.title, draft.content, draft.linkedIds, draft.ownWords)
      onOpenTarget({ mode: 'note', noteId: created.id })
      return
    }

    if (!loadedNote) return

    if (loadedNote.type === 'literature') {
      const permanent = await saveLiteratureAsPermanent(db, loadedNote, draft.title, draft.content, draft.linkedIds, draft.ownWords)
      onOpenTarget({ mode: 'note', noteId: permanent.id })
      return
    }

    if (loadedNote.type === 'permanent') {
      await syncNoteLinks(db, loadedNote.id, draft.linkedIds)
    }
  }
```

- [ ] **Step 5: Keep `NoteContextPane.tsx` props and workspace usage aligned**

Verify that the `Props` interface and `SourcePicker`/`LinkPicker` usage pass `db` directly from `NoteWorkspace.tsx`:

```tsx
import type { Database, Note } from '@zettelkasten/core'

interface Props {
  db: Database
  note: Note | null
  draftType: 'literature' | 'permanent' | null
  sourceId: string | null
  ownWords: boolean
  linkedIds: string[]
  error: string | null
  onSourceIdChange: (sourceId: string) => void
  onOwnWordsChange: (value: boolean) => void
  onToggleLink: (noteId: string) => void
  onPromoteToLiterature: () => Promise<void>
  onSaveAsPermanent: () => Promise<void>
}

          <SourcePicker db={props.db} selectedId={sourceId} onSelect={props.onSourceIdChange} />

            <LinkPicker db={props.db} selectedIds={linkedIds} onToggle={props.onToggleLink} />
```

- [ ] **Step 6: Refactor `ReviewScreen.tsx` to use shared workflow helpers instead of its local transaction logic**

Replace the transaction and save helpers in `apps/desktop/src/screens/ReviewScreen.tsx` with imports from `../lib/note-workflow`:

```ts
import { promoteFleetingToLiterature, saveLiteratureAsPermanent } from '../lib/note-workflow'

  async function handlePromoteToLiterature() {
    if (!current) return
    try {
      const updated = await promoteFleetingToLiterature(db, current, title, content, sourceId)
      setCurrent(updated)
      setStep('literature-to-permanent')
      setBlockReason(null)
      await loadQueue()
      await onInboxCountChange?.()
    } catch (err) {
      setBlockReason(err instanceof Error ? err.message : 'Failed to promote note.')
    }
  }

  async function handleSavePermanent() {
    if (!current || current.type !== 'literature') return
    if (saveState !== 'idle') return

    savedTitleRef.current = title
    setSaveState('saving')

    try {
      await saveLiteratureAsPermanent(db, current, title, content, linkedIds, ownWords)
      setSaveState('saved')
      saveTimeoutRef.current = setTimeout(() => {
        setCurrent(null)
        setActiveDraftType(null)
        setSaveState('idle')
        setBlockReason(null)
        loadQueue().catch(console.error)
      }, 1200)
    } catch (err) {
      setSaveState('idle')
      setBlockReason(err instanceof Error ? err.message : 'Failed to save permanent note.')
    }
  }
```

- [ ] **Step 7: Run full repo typecheck after introducing shared workflow logic**

Run: `pnpm typecheck`

Expected: PASS

### Task 4: Route Inbox And Review Through The Workspace

**Files:**
- Modify: `apps/desktop/src/components/NoteCard.tsx`
- Modify: `apps/desktop/src/screens/InboxScreen.tsx`
- Modify: `apps/desktop/src/screens/ReviewScreen.tsx`
- Test: `apps/desktop/src/screens/InboxScreen.tsx`

- [ ] **Step 1: Give `NoteCard` a real open action**

Update `apps/desktop/src/components/NoteCard.tsx` so it can open a note directly while still offering review-specific actions when needed:

```tsx
interface Props {
  note: Note
  onOpen: (note: Note) => void
  onProcess?: (note: Note) => void
}

export default function NoteCard({ note, onOpen, onProcess }: Props) {
  return (
    <div className="note-card" style={{ background: BG.raised, border: `1px solid ${BORDER.faint}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ width: 6, paddingTop: 8, flexShrink: 0 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT.fleeting, opacity: 0.8 }} />
      </div>

      <button
        onClick={() => onOpen(note)}
        style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
      >
        <div style={{ fontFamily: FONT.display, fontSize: 18, fontWeight: 500, color: TEXT.primary, marginBottom: 4, lineHeight: 1.3 }}>
          {note.title}
        </div>
        {note.content && (
          <div style={{ fontSize: 12, color: TEXT.secondary, lineHeight: 1.7, marginBottom: 8, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {note.content}
          </div>
        )}
        <div style={{ fontSize: 10, color: TEXT.faint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {timeAgo(note.created_at)}
        </div>
      </button>

      {onProcess && (
        <button onClick={() => onProcess(note)} className="process-btn" style={{ background: 'transparent', color: TEXT.secondary, border: 'none', padding: '5px 0', fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Process
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Route Inbox note selection into `zettel:open-note`**

Update `apps/desktop/src/screens/InboxScreen.tsx`:

```ts
  function handleOpen(note: Note) {
    window.dispatchEvent(new CustomEvent('zettel:open-note', { detail: note }))
  }

  function handleProcess(note: Note) {
    window.dispatchEvent(new CustomEvent('zettel:review', { detail: note }))
  }
```

Then change the list render to:

```tsx
          notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onOpen={handleOpen}
              onProcess={handleProcess}
            />
          ))
```

- [ ] **Step 3: Turn `ReviewScreen` into a queue-and-guidance screen instead of a second full editor**

Replace the queue click behavior in `apps/desktop/src/screens/ReviewScreen.tsx` so queue items open the workspace:

```tsx
interface Props {
  db: Database
  onOpenNoteId: (noteId: string) => Promise<void>
}

  if (!current && !activeDraftType) {
    return (
      <div style={{ height: '100%', background: BG.base, overflowY: 'auto' }}>
        <div style={{ padding: '24px 28px' }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: TEXT.faint, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 20, fontFamily: FONT.ui }}>
            Review Queue — {queue.length}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {queue.map((note) => (
              <div key={note.id} style={{ background: BG.raised, border: `1px solid ${BORDER.faint}`, borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <div style={{ fontFamily: FONT.display, fontSize: 18, color: TEXT.primary, lineHeight: 1.3 }}>{note.title}</div>
                    <div style={{ marginTop: 4, fontSize: 10, color: typeColor(note.type), textTransform: 'uppercase', letterSpacing: '0.10em' }}>
                      {note.type}
                    </div>
                  </div>

                  <button
                    onClick={() => void onOpenNoteId(note.id)}
                    style={{ background: 'transparent', border: `1px solid ${BORDER.base}`, borderRadius: 10, color: TEXT.secondary, padding: '8px 12px', cursor: 'pointer', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}
                  >
                    Open In Workspace
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
```

- [ ] **Step 4: Route Review draft creation shortcuts into the workspace instead of Review-local draft state**

Replace the draft entry points in `ReviewScreen.tsx` with event dispatch:

```tsx
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('zettel:new-literature'))}
          style={secondaryButtonStyle}
        >
          New Literature
        </button>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('zettel:new-permanent'))}
          style={secondaryButtonStyle}
        >
          New Permanent
        </button>
      </div>
```

- [ ] **Step 5: Run typecheck after rerouting list-driven note work into the workspace**

Run: `pnpm --filter @zettelkasten/desktop typecheck`

Expected: PASS

### Task 5: Build The Shared Graph Model And Integrate It Into Workspace And Map View

**Files:**
- Create: `apps/desktop/src/lib/graph.ts`
- Create: `apps/desktop/src/components/workspace/ContextGraph.tsx`
- Modify: `apps/desktop/src/components/GraphCanvas.tsx`
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`
- Modify: `apps/desktop/src/screens/GraphScreen.tsx`
- Test: `apps/desktop/src/lib/graph.ts`

- [ ] **Step 1: Create a shared graph-neighborhood builder**

Create `apps/desktop/src/lib/graph.ts`:

```ts
import type { Note, NoteLink } from '@zettelkasten/core'

export interface GraphNeighborhood {
  notes: Note[]
  links: NoteLink[]
}

export function buildNeighborhood(focusNoteId: string, notes: Note[], links: NoteLink[], maxDepth = 1): GraphNeighborhood {
  const noteMap = new Map(notes.map((note) => [note.id, note]))
  const adjacency = new Map<string, string[]>()

  for (const link of links) {
    adjacency.set(link.from_note_id, [...(adjacency.get(link.from_note_id) ?? []), link.to_note_id])
    adjacency.set(link.to_note_id, [...(adjacency.get(link.to_note_id) ?? []), link.from_note_id])
  }

  const visited = new Set<string>([focusNoteId])
  const queue: Array<{ id: string; depth: number }> = [{ id: focusNoteId, depth: 0 }]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current.depth >= maxDepth) continue

    for (const neighborId of adjacency.get(current.id) ?? []) {
      if (visited.has(neighborId)) continue
      visited.add(neighborId)
      queue.push({ id: neighborId, depth: current.depth + 1 })
    }
  }

  return {
    notes: [...visited].map((id) => noteMap.get(id)).filter((note): note is Note => Boolean(note)),
    links: links.filter((link) => visited.has(link.from_note_id) && visited.has(link.to_note_id)),
  }
}
```

- [ ] **Step 2: Upgrade `GraphCanvas.tsx` to accept focus and selection state**

Update the props and simulation setup in `apps/desktop/src/components/GraphCanvas.tsx`:

```ts
interface Props {
  notes: Note[]
  links: NoteLink[]
  focusNoteId?: string
  selectedNoteId?: string
  mode?: 'context' | 'full'
  onNodeClick: (note: Note) => void
}

export default function GraphCanvas({ notes, links, focusNoteId, selectedNoteId, mode = 'full', onNodeClick }: Props) {
```

Then anchor the focused node in the simulation:

```ts
    const focusNode = nodes.find((node) => node.id === focusNoteId)
    if (focusNode) {
      focusNode.fx = width / 2
      focusNode.fy = height / 2
    }

    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphEdge>(edges).id((d) => d.id).distance(mode === 'context' ? 72 : 96))
      .force('charge', d3.forceManyBody().strength(mode === 'context' ? -120 : -180))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius((d) => radiusScale(d.linkCount) + (mode === 'context' ? 10 : 6)))
```

Use `selectedNoteId` to style the active node more strongly:

```ts
    node.append('circle')
      .attr('r', (d) => radiusScale(d.linkCount))
      .attr('fill', (d) => d.id === selectedNoteId ? '#222730' : '#1d2128')
      .attr('stroke', (d) => d.id === selectedNoteId ? '#b4ab99' : '#6d8394')
      .attr('stroke-opacity', (d) => d.id === selectedNoteId ? 0.9 : 0.55)
      .attr('stroke-width', (d) => d.id === selectedNoteId ? 1.4 : 1)
```

- [ ] **Step 3: Create a contextual graph wrapper for the workspace**

Create `apps/desktop/src/components/workspace/ContextGraph.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { getAllLinks } from '@zettelkasten/core'
import type { Database, Note, NoteLink } from '@zettelkasten/core'
import GraphCanvas from '../GraphCanvas'
import { buildNeighborhood } from '../../lib/graph'

interface Props {
  db: Database
  activeNote: Note | null
  onOpenNoteId: (noteId: string) => Promise<void>
}

export default function ContextGraph({ db, activeNote, onOpenNoteId }: Props) {
  const [allNotes, setAllNotes] = useState<Note[]>([])
  const [allLinks, setAllLinks] = useState<NoteLink[]>([])

  useEffect(() => {
    Promise.all([
      db.query<Note>(`SELECT * FROM notes WHERE deleted_at IS NULL ORDER BY updated_at DESC`),
      getAllLinks(db),
    ]).then(([notes, links]) => {
      setAllNotes(notes)
      setAllLinks(links)
    })
  }, [db, activeNote?.id])

  const neighborhood = useMemo(() => {
    if (!activeNote) return { notes: [], links: [] }
    return buildNeighborhood(activeNote.id, allNotes, allLinks, 2)
  }, [activeNote, allNotes, allLinks])

  if (!activeNote) return null

  return (
    <div style={{ height: 260 }}>
      <GraphCanvas
        notes={neighborhood.notes}
        links={neighborhood.links}
        focusNoteId={activeNote.id}
        selectedNoteId={activeNote.id}
        mode="context"
        onNodeClick={(note) => void onOpenNoteId(note.id)}
      />
    </div>
  )
}
```

- [ ] **Step 4: Mount the contextual graph inside `NoteWorkspace.tsx`**

Import and render the new graph wrapper under the context controls:

```tsx
import ContextGraph from './ContextGraph'

      <div style={{ display: 'grid', gridTemplateRows: 'minmax(0, 1fr) auto', borderLeft: `1px solid ${BORDER.faint}`, background: BG.panel }}>
        <NoteContextPane
          db={db}
          note={loadedNote}
          draftType={target?.mode === 'draft' ? target.noteType : null}
          sourceId={draft.sourceId}
          ownWords={draft.ownWords}
          linkedIds={draft.linkedIds}
          error={error}
          onSourceIdChange={(sourceId) => setDraft((prev) => ({ ...prev, sourceId }))}
          onOwnWordsChange={(ownWords) => setDraft((prev) => ({ ...prev, ownWords }))}
          onToggleLink={(noteId) => setDraft((prev) => ({ ...prev, linkedIds: prev.linkedIds.includes(noteId) ? prev.linkedIds.filter((id) => id !== noteId) : [...prev.linkedIds, noteId] }))}
          onPromoteToLiterature={handlePromoteToLiterature}
          onSaveAsPermanent={handleSaveAsPermanent}
        />

        <div style={{ borderTop: `1px solid ${BORDER.faint}`, padding: 12 }}>
          <ContextGraph db={db} activeNote={loadedNote} onOpenNoteId={onOpenNoteId} />
        </div>
      </div>
```

- [ ] **Step 5: Turn `GraphScreen.tsx` into the expanded view of the same graph model**

Update `apps/desktop/src/screens/GraphScreen.tsx`:

```tsx
interface Props {
  db: Database
  workspaceTarget: WorkspaceTarget | null
  onOpenNoteId: (noteId: string) => Promise<void>
}

  const selectedNoteId = workspaceTarget?.mode === 'note' ? workspaceTarget.noteId : undefined

      <GraphCanvas
        notes={filtered}
        links={visibleLinks}
        focusNoteId={selectedNoteId}
        selectedNoteId={selectedNoteId}
        mode="full"
        onNodeClick={(note) => void onOpenNoteId(note.id)}
      />
```

Also replace the old inspector `Open` button to call `onOpenNoteId(selected.id)` instead of dispatching another event.

- [ ] **Step 6: Run full repo typecheck after the shared graph integration**

Run: `pnpm typecheck`

Expected: PASS

### Task 6: Move Library Viewing Into The Workspace, Remove The Modal Path, And Verify End-To-End

**Files:**
- Modify: `apps/desktop/src/screens/LibraryScreen.tsx`
- Modify: `apps/desktop/src/global.css`
- Modify: `apps/desktop/src/App.tsx`
- Delete: `apps/desktop/src/components/NoteModal.tsx`
- Test: `apps/desktop/src/screens/LibraryScreen.tsx`

- [ ] **Step 1: Replace Library inline expansion with workspace navigation**

Update `apps/desktop/src/screens/LibraryScreen.tsx` so cards open notes instead of expanding them in place:

```tsx
export default function LibraryScreen({ db }: Props) {
  const [notes, setNotes] = useState<LibraryNote[]>([])

  function openNote(note: LibraryNote) {
    window.dispatchEvent(new CustomEvent('zettel:open-note', { detail: note }))
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG.base }}>
      <div style={{ padding: '28px 32px 18px' }}>
        <div style={{ fontFamily: FONT.display, fontSize: 29, fontWeight: 500, color: TEXT.primary, letterSpacing: '-0.015em' }}>
          Library
        </div>
        <div style={{ fontSize: 12, color: TEXT.secondary, marginTop: 6, lineHeight: 1.6 }}>
          Processed literature notes and durable material. Open any note into the workspace.
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {notes.map((note) => (
          <button
            key={note.id}
            onClick={() => openNote(note)}
            className="library-card"
            style={{ background: BG.raised, border: `1px solid ${BORDER.faint}`, borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'stretch', gap: 16, padding: '16px 18px', textAlign: 'left', cursor: 'pointer' }}
          >
            <div style={{ width: 6, borderRadius: 999, background: note.type === 'literature' ? ACCENT.literature : ACCENT.permanent, opacity: 0.7, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONT.display, fontSize: 19, fontWeight: 500, color: TEXT.primary, lineHeight: 1.3 }}>
                {note.title}
              </div>
              <div style={{ fontSize: 11, color: TEXT.secondary, marginTop: 5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {note.source_label ?? 'No source'} · {formatDate(note.processed_at ?? note.updated_at)}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Remove `NoteModal` from `App.tsx` and delete the file**

Make sure `apps/desktop/src/App.tsx` has no `NoteModal` import and no `openNote` modal state left. Then delete the file:

```diff
- import NoteModal from './components/NoteModal'
- const [openNote, setOpenNote] = useState<Note | null>(null)
- {openNote && (
-   <NoteModal db={db} note={openNote} onClose={() => setOpenNote(null)} />
- )}
```

Delete: `apps/desktop/src/components/NoteModal.tsx`

- [ ] **Step 3: Add workspace-specific polish to `global.css`**

Append these workspace refinements to `apps/desktop/src/global.css`:

```css
.workspace-pane button,
.workspace-pane input,
.workspace-pane textarea {
  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease, opacity 120ms ease;
}

.workspace-pane button:hover {
  border-color: #3a4350 !important;
}

.workspace-pane input::placeholder,
.workspace-pane textarea::placeholder {
  color: #5e5b55;
}
```

Then add `className="workspace-pane"` to the root `div` in `NoteWorkspace.tsx`.

- [ ] **Step 4: Run full verification commands**

Run: `pnpm typecheck`

Expected: PASS

Run: `pnpm test`

Expected: PASS

- [ ] **Step 5: Manually verify the redesigned desktop workflow**

Run: `pnpm --filter @zettelkasten/desktop dev`

Expected manual checks:

```text
1. Open a fleeting note from Inbox and confirm it opens in Workspace.
2. Edit the note title/body and confirm SaveStatus moves through Unsaved changes -> Saving... -> Saved.
3. Promote a fleeting note with a source and confirm it becomes literature without leaving the workspace.
4. Open a literature note from Library and confirm the source context is visible.
5. Save a literature note as permanent and confirm the new permanent note opens in the workspace.
6. Open the expanded Graph screen and confirm the active note is visually selected.
7. Click a graph neighbor and confirm the workspace opens that note and the contextual graph recenters.
8. Confirm there is no note modal path left in the app.
```

## Self-Review Checklist

- Spec coverage:
  - workspace as the primary note surface: Tasks 1-2
  - all note types editable: Tasks 2-4
  - auto-save: Task 2
  - contextual graph: Task 5
  - graph full-map continuity: Task 5
  - Review no longer owning the only editor: Task 4
  - modal removal: Task 6
- Placeholder scan: no `TODO`, `TBD`, or "similar to above" references remain.
- Type consistency:
  - `WorkspaceTarget` is defined once in `App.tsx` and reused consistently.
  - `SaveState` is defined in `SaveStatus.tsx` and reused consistently.
  - shared workflow helpers live in `note-workflow.ts` and are referenced by both workspace and Review.
