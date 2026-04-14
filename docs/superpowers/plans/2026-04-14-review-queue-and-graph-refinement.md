# Review Queue And Graph Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Review queue for better hierarchy and scanability, make graph node inspection preserve zoom/layout while slightly increasing node spacing, add a trash workflow for deleted notes, keep title-based wikilinks synced when notes are renamed, make notes open in Preview by default with a more VS Code-like Code View, and make major layout dividers draggable and persistent.

**Architecture:** Keep the existing screen/component boundaries, but improve Review markup and styling in place. Refactor `GraphCanvas` so SVG setup, zoom state, and simulation lifecycle are preserved across selection-only updates, with selection styling updated separately from graph initialization. Add note deletion by wiring the existing soft-delete path into the workspace context pane, then expose restore and permanent-delete flows through a dedicated Trash screen. Add a focused wikilink rename-propagation helper that rewrites title-based wikilinks across stored note content when a persisted note title changes. Refine the workspace document pane so existing notes open in Preview and Code View feels like an embedded editor rather than a form field. Add reusable resizable-pane behavior for the sidebar and workspace columns, with local persistence and width clamping.

**Tech Stack:** React 18, TypeScript, Vitest, D3 force simulation, inline style objects with shared theme tokens

---

## File Map

- Modify: `apps/desktop/src/screens/ReviewScreen.tsx`
  Review queue layout, card hierarchy, chip/button styling, preview text.
- Modify: `apps/desktop/src/screens/ReviewScreen.test.tsx`
  Regression tests for redesigned review cards.
- Modify: `apps/desktop/src/components/GraphCanvas.tsx`
  Preserve zoom/layout across selection changes and increase node spacing.
- Modify: `apps/desktop/src/screens/GraphScreen.tsx`
  Keep graph selection behavior aligned with the new stable-canvas lifecycle.
- Modify: `apps/desktop/src/components/workspace/ContextGraph.tsx`
  Reuse graph spacing/stability improvements in context mode.
- Create: `apps/desktop/src/components/GraphCanvas.test.tsx`
  Regression tests for stable selection behavior and spacing configuration.
- Modify: `apps/desktop/src/components/workspace/NoteContextPane.tsx`
  Surface a destructive delete action for persisted notes.
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`
  Execute soft deletion, confirm it, and navigate away safely.
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.test.tsx`
  Regression tests for delete behavior and post-delete navigation.
- Modify: `packages/core/src/notes.ts`
  Add restore and permanent-delete note helpers.
- Modify: `packages/core/tests/notes.test.ts`
  Regression tests for restore and permanent-delete behavior.
- Modify: `apps/desktop/src/App.tsx`
  Add the Trash route and preview-first note opening behavior.
- Modify: `apps/desktop/src/components/Sidebar.tsx`
  Add `Trash` to primary navigation.
- Create: `apps/desktop/src/screens/TrashScreen.tsx`
  Show deleted notes and allow restore/permanent-delete actions.
- Create: `apps/desktop/src/screens/TrashScreen.test.tsx`
  Regression tests for trash listing and actions.
- Modify: `apps/desktop/src/components/workspace/DocumentPane.tsx`
  Default to Preview for existing notes and add stronger editor chrome.
- Modify: `apps/desktop/src/components/workspace/DocumentPane.test.tsx`
  Regression tests for preview-default behavior and editor presentation cues.
- Modify: `apps/desktop/src/components/MarkdownEditor.tsx`
  Add VS Code-like editor presentation details.
- Modify: `apps/desktop/src/global.css`
  Support stronger editor chrome, gutters, and active-line/editor-surface styling.
- Create: `apps/desktop/src/lib/layout.ts`
  Store and validate persisted pane widths.
- Create: `apps/desktop/src/hooks/useResizablePane.ts`
  Reusable drag-to-resize behavior with clamped widths.
- Modify: `apps/desktop/src/components/Sidebar.tsx`
  Apply persistent adjustable width.
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`
  Apply adjustable widths to rail/document/context columns.
- Create: `apps/desktop/src/hooks/useResizablePane.test.ts`
  Regression tests for resize clamping and persistence.
- Modify: `apps/desktop/src/lib/note-workflow.ts`
  Add a helper to rewrite title-based wikilinks across stored notes.
- Modify: `apps/desktop/src/lib/note-workflow.test.ts`
  Regression tests for wikilink title propagation.

## Task 1A: Add Workspace Note Deletion

**Files:**
- Modify: `apps/desktop/src/components/workspace/NoteContextPane.tsx`
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.test.tsx`

- [ ] **Step 1: Write the failing delete-note test**

Add a test to `apps/desktop/src/components/workspace/NoteWorkspace.test.tsx` that verifies a saved note can be deleted from the context pane and that the workspace navigates away afterward.

```tsx
  it('soft-deletes the loaded note and clears the workspace target', async () => {
    const db = createFakeDb()
    const onOpenTarget = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={vi.fn(async () => {})}
          onOpenTarget={onOpenTarget}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    clickButton(container, 'Delete Note')
    await flushEffects()

    expect(db.execute).toHaveBeenCalledWith(
      'UPDATE notes SET deleted_at = ? WHERE id = ?',
      expect.any(Array)
    )
    expect(onOpenTarget).toHaveBeenCalledWith(null)
  })
```

- [ ] **Step 2: Run the delete-note test to verify it fails**

Run: `pnpm --filter @zettelkasten/desktop exec vitest run src/components/workspace/NoteWorkspace.test.tsx`

Expected: FAIL because there is no delete button or deletion handler yet.

- [ ] **Step 3: Implement the delete action in the workspace**

Import `softDeleteNote` into `apps/desktop/src/components/workspace/NoteWorkspace.tsx`, add a confirmation-backed delete handler, and surface it through `NoteContextPane`.

```tsx
import { createNote, getLinkedNoteIds, getNoteById, softDeleteNote, updateNote, type Database, type Note } from '@zettelkasten/core'

async function handleDeleteNote() {
  if (!loadedNote) return
  const confirmed = window.confirm(`Delete "${loadedNote.title || 'Untitled'}"?`)
  if (!confirmed) return

  setError(null)
  await softDeleteNote(db, loadedNote.id)
  await onInboxCountChange()
  onOpenTarget(null)
}
```

Add the button to `apps/desktop/src/components/workspace/NoteContextPane.tsx`:

```tsx
        {note && (
          <button
            onClick={onDeleteNote}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: `1px solid ${ACCENT.danger}`,
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              background: 'rgba(176,108,104,0.10)',
              color: ACCENT.danger,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontFamily: FONT.ui,
            }}
          >
            Delete Note
          </button>
        )}
```

- [ ] **Step 4: Run the delete-note test to verify it passes**

Run: `pnpm --filter @zettelkasten/desktop exec vitest run src/components/workspace/NoteWorkspace.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the workspace deletion flow**

```bash
git add apps/desktop/src/components/workspace/NoteContextPane.tsx apps/desktop/src/components/workspace/NoteWorkspace.tsx apps/desktop/src/components/workspace/NoteWorkspace.test.tsx
git commit -m "feat: add workspace note deletion"
```

## Task 1B: Add Trash Recovery Workflow

**Files:**
- Modify: `packages/core/src/notes.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/tests/notes.test.ts`
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/components/Sidebar.tsx`
- Create: `apps/desktop/src/screens/TrashScreen.tsx`
- Create: `apps/desktop/src/screens/TrashScreen.test.tsx`

- [ ] **Step 1: Write the failing core and screen tests**

Add core tests in `packages/core/tests/notes.test.ts`:

```ts
it('restores a soft-deleted note', async () => {
  const note = await createNote(db, { type: 'fleeting', title: 'Trash me' })
  await softDeleteNote(db, note.id)
  await restoreNote(db, note.id)
  expect((await getNoteById(db, note.id))?.deleted_at).toBeNull()
})

it('permanently deletes a note and its links', async () => {
  const a = await createNote(db, { type: 'permanent', title: 'A' })
  const b = await createNote(db, { type: 'permanent', title: 'B' })
  await addLink(db, a.id, b.id)
  await permanentlyDeleteNote(db, a.id)
  expect(await getNoteById(db, a.id)).toBeNull()
  expect(await getAllLinks(db)).toEqual([])
})
```

Create `apps/desktop/src/screens/TrashScreen.test.tsx`:

```tsx
it('lists deleted notes and supports restore and permanent delete', async () => {
  await act(async () => {
    root.render(<TrashScreen db={createFakeDb() as any} />)
    await flushEffects()
  })

  expect(container.textContent).toContain('Deleted note')
  expect(container.textContent).toContain('Restore')
  expect(container.textContent).toContain('Delete Permanently')
})
```

- [ ] **Step 2: Run the trash tests to verify they fail**

Run:

```bash
pnpm --filter @zettelkasten/core exec vitest run tests/notes.test.ts
pnpm --filter @zettelkasten/desktop exec vitest run src/screens/TrashScreen.test.tsx
```

Expected: FAIL because restore/permanent-delete helpers and `TrashScreen` do not exist yet.

- [ ] **Step 3: Implement restore, permanent delete, and the Trash screen**

Update `packages/core/src/notes.ts`:

```ts
export async function restoreNote(db: Database, id: string): Promise<void> {
  await db.execute(`UPDATE notes SET deleted_at = NULL, updated_at = ? WHERE id = ?`, [Date.now(), id])
}

export async function permanentlyDeleteNote(db: Database, id: string): Promise<void> {
  await db.execute(`DELETE FROM note_links WHERE from_note_id = ? OR to_note_id = ?`, [id, id])
  await db.execute(`DELETE FROM notes WHERE id = ?`, [id])
}
```

Create `apps/desktop/src/screens/TrashScreen.tsx` with a deleted-notes query and two actions:

```tsx
const trashed = await db.query<Note>(
  `SELECT * FROM notes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`
)
```

Update `apps/desktop/src/App.tsx`:

```ts
export type Screen = 'inbox' | 'workspace' | 'review' | 'library' | 'graph' | 'trash'
```

And render:

```tsx
{screen === 'trash' && <TrashScreen db={db} />}
```

Update `apps/desktop/src/components/Sidebar.tsx`:

```ts
{ id: 'trash', label: 'Trash' },
```

- [ ] **Step 4: Run the trash tests to verify they pass**

Run:

```bash
pnpm --filter @zettelkasten/core exec vitest run tests/notes.test.ts
pnpm --filter @zettelkasten/desktop exec vitest run src/screens/TrashScreen.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit the trash workflow**

```bash
git add packages/core/src/notes.ts packages/core/src/index.ts packages/core/tests/notes.test.ts apps/desktop/src/App.tsx apps/desktop/src/components/Sidebar.tsx apps/desktop/src/screens/TrashScreen.tsx apps/desktop/src/screens/TrashScreen.test.tsx
git commit -m "feat: add trash recovery workflow"
```

## Task 1C: Propagate Wikilink Titles On Rename

**Files:**
- Modify: `apps/desktop/src/lib/note-workflow.ts`
- Modify: `apps/desktop/src/lib/note-workflow.test.ts`
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`

- [ ] **Step 1: Write the failing wikilink-rename test**

Add a test to `apps/desktop/src/lib/note-workflow.test.ts` that proves a title rename rewrites stored wikilinks while preserving aliases.

```ts
  it('rewrites title-based wikilinks when a note title changes', async () => {
    await db.execute(
      `INSERT INTO notes (id, type, title, content, created_at, updated_at, source_id, own_words_confirmed, deleted_at, processed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['target', 'permanent', 'Old Title', '', 1, 1, null, 1, null, null]
    )
    await db.execute(
      `INSERT INTO notes (id, type, title, content, created_at, updated_at, source_id, own_words_confirmed, deleted_at, processed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['ref', 'permanent', 'Ref Note', 'See [[Old Title]] and [[Old Title|Alias]]', 1, 1, null, 1, null, null]
    )

    await propagateRenamedWikilinks(db, 'Old Title', 'New Title')

    const updated = await getNoteById(db, 'ref')
    expect(updated?.content).toBe('See [[New Title]] and [[New Title|Alias]]')
  })
```

- [ ] **Step 2: Run the wikilink-rename test to verify it fails**

Run: `pnpm --filter @zettelkasten/core exec vitest run tests/note-workflow.test.ts`

Expected: FAIL because the propagation helper does not exist yet.

- [ ] **Step 3: Implement the minimal rename-propagation helper**

Add a helper to `apps/desktop/src/lib/note-workflow.ts` that rewrites title-based wikilinks in persisted notes.

```ts
function rewriteWikilinkTargets(content: string, oldTitle: string, newTitle: string): string {
  const escaped = oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`\\[\\[(${escaped})(\\|[^\\]]+)?\\]\\]`, 'g')
  return content.replace(pattern, (_match, _target, alias = '') => `[[${newTitle}${alias}]]`)
}

export async function propagateRenamedWikilinks(db: Database, oldTitle: string, newTitle: string): Promise<void> {
  if (!oldTitle.trim() || !newTitle.trim() || oldTitle === newTitle) return

  const notes = await db.query<{ id: string; content: string }>(
    `SELECT id, content FROM notes WHERE deleted_at IS NULL AND content LIKE ?`,
    [`%[[${oldTitle}%`]
  )

  for (const note of notes) {
    const nextContent = rewriteWikilinkTargets(note.content, oldTitle, newTitle)
    if (nextContent !== note.content) {
      await updateNote(db, note.id, { content: nextContent })
    }
  }
}
```

Then call it from `NoteWorkspace.tsx` after a persisted note title change succeeds:

```ts
      void updateNote(db, loadedNote.id, {
        title: draft.title,
        content: draft.content,
        ...(loadedNote.type !== 'permanent' ? { source_id: draft.sourceId } : {}),
      })
        .then(async () => {
          if (loadedNote.title !== draft.title) {
            await propagateRenamedWikilinks(db, loadedNote.title, draft.title)
          }
          // existing state updates continue here
        })
```

- [ ] **Step 4: Run the wikilink-rename test to verify it passes**

Run: `pnpm --filter @zettelkasten/core exec vitest run tests/note-workflow.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the wikilink-rename propagation**

```bash
git add apps/desktop/src/lib/note-workflow.ts apps/desktop/src/lib/note-workflow.test.ts apps/desktop/src/components/workspace/NoteWorkspace.tsx
git commit -m "feat: keep wikilinks synced on note rename"
```

## Task 1D: Make Preview Default And Code View Feel Like An Editor

**Files:**
- Modify: `apps/desktop/src/components/workspace/DocumentPane.tsx`
- Modify: `apps/desktop/src/components/workspace/DocumentPane.test.tsx`
- Modify: `apps/desktop/src/components/MarkdownEditor.tsx`
- Modify: `apps/desktop/src/global.css`

- [ ] **Step 1: Write the failing document-pane tests**

Add tests to `apps/desktop/src/components/workspace/DocumentPane.test.tsx`:

```tsx
it('opens existing notes in preview mode by default', async () => {
  await act(async () => {
    root.render(
      <DocumentPane
        title="Test Note"
        content="Preview body"
        saveState="saved"
        placeholderTitle="Title"
        placeholderBody="Body"
        onTitleChange={vi.fn()}
        onContentChange={vi.fn()}
        defaultMode="preview"
      />
    )
  })

  expect(container.querySelector('.rendered-markdown')).toBeTruthy()
})

it('shows editor chrome in code view', async () => {
  await act(async () => {
    root.render(
      <DocumentPane
        title="Test Note"
        content="Body"
        saveState="saved"
        placeholderTitle="Title"
        placeholderBody="Body"
        onTitleChange={vi.fn()}
        onContentChange={vi.fn()}
        defaultMode="code"
      />
    )
  })

  expect(container.textContent).toContain('Markdown')
  expect(container.querySelector('[data-testid="editor-chrome"]')).toBeTruthy()
})
```

- [ ] **Step 2: Run the document-pane tests to verify they fail**

Run: `pnpm --filter @zettelkasten/desktop exec vitest run src/components/workspace/DocumentPane.test.tsx`

Expected: FAIL because `defaultMode` and the stronger editor chrome do not exist yet.

- [ ] **Step 3: Implement preview-first opening and VS Code-like code chrome**

Update `apps/desktop/src/components/workspace/DocumentPane.tsx` to accept a mode default and render a stronger editor header.

```tsx
interface Props {
  // existing props...
  defaultMode?: 'preview' | 'code'
}

const [isRenderedView, setIsRenderedView] = useState(defaultMode === 'preview')
```

Add editor chrome above `MarkdownEditor`:

```tsx
<div data-testid="editor-chrome" style={{
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  borderBottom: `1px solid ${BORDER.faint}`,
  background: BG.raised,
}}>
  <span style={{ fontFamily: FONT.ui, fontSize: 11, color: TEXT.faint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
    Markdown
  </span>
  <span style={{ fontFamily: FONT.ui, fontSize: 11, color: TEXT.secondary }}>
    Code View
  </span>
</div>
```

Refine `apps/desktop/src/global.css` and `apps/desktop/src/components/MarkdownEditor.tsx` so the editor surface feels embedded and IDE-like:

```css
.cm-editor {
  background: #171a20 !important;
}

.cm-gutters {
  border-right: 1px solid #232831 !important;
  color: #5e5b55;
  background: #14171d !important;
}

.cm-activeLine {
  background: rgba(255,255,255,0.03) !important;
}
```

And in `MarkdownEditor.tsx`:

```tsx
basicSetup={{
  lineNumbers: true,
  foldGutter: false,
  highlightActiveLine: true,
  highlightSelectionMatches: false,
}}
```

- [ ] **Step 4: Run the document-pane tests to verify they pass**

Run: `pnpm --filter @zettelkasten/desktop exec vitest run src/components/workspace/DocumentPane.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the editor experience update**

```bash
git add apps/desktop/src/components/workspace/DocumentPane.tsx apps/desktop/src/components/workspace/DocumentPane.test.tsx apps/desktop/src/components/MarkdownEditor.tsx apps/desktop/src/global.css
git commit -m "feat: make notes open in preview with stronger editor chrome"
```

## Task 1E: Add Resizable Major Layout Dividers

**Files:**
- Create: `apps/desktop/src/lib/layout.ts`
- Create: `apps/desktop/src/hooks/useResizablePane.ts`
- Create: `apps/desktop/src/hooks/useResizablePane.test.ts`
- Modify: `apps/desktop/src/components/Sidebar.tsx`
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`
- Modify: `apps/desktop/src/global.css`

- [ ] **Step 1: Write the failing resize-behavior tests**

Create `apps/desktop/src/hooks/useResizablePane.test.ts`.

```ts
it('clamps pane widths and persists them', () => {
  const storage = new Map<string, string>()
  const result = clampPaneWidth(40, 160, 420)
  expect(result).toBe(160)

  savePaneWidth(storageLike, 'sidebar', 280)
  expect(loadPaneWidth(storageLike, 'sidebar', 168)).toBe(280)
})
```

Add a lightweight component test that verifies the workspace renders resize handles with the expected test IDs.

```tsx
expect(container.querySelector('[data-testid="resize-sidebar"]')).toBeTruthy()
expect(container.querySelector('[data-testid="resize-rail"]')).toBeTruthy()
expect(container.querySelector('[data-testid="resize-context"]')).toBeTruthy()
```

- [ ] **Step 2: Run the resize tests to verify they fail**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/hooks/useResizablePane.test.ts src/components/workspace/NoteWorkspace.test.tsx
```

Expected: FAIL because the resize helpers and handles do not exist yet.

- [ ] **Step 3: Implement reusable pane resizing with persistence**

Create `apps/desktop/src/lib/layout.ts`:

```ts
export function clampPaneWidth(width: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, width))
}

export function loadPaneWidth(storage: Storage, key: string, fallback: number): number {
  const raw = storage.getItem(key)
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

export function savePaneWidth(storage: Storage, key: string, width: number): void {
  storage.setItem(key, String(width))
}
```

Create `apps/desktop/src/hooks/useResizablePane.ts` with pointer-driven resizing and persistence.

Apply it in `Sidebar.tsx` and `NoteWorkspace.tsx` using handles such as:

```tsx
<div data-testid="resize-sidebar" className="pane-resize-handle" onPointerDown={sidebarResize.onPointerDown} />
```

and:

```tsx
<div data-testid="resize-rail" className="pane-resize-handle" onPointerDown={railResize.onPointerDown} />
<div data-testid="resize-context" className="pane-resize-handle" onPointerDown={contextResize.onPointerDown} />
```

Add handle styling in `apps/desktop/src/global.css`:

```css
.pane-resize-handle {
  width: 6px;
  cursor: col-resize;
  background: transparent;
  position: relative;
}

.pane-resize-handle:hover::after,
.pane-resize-handle.is-dragging::after {
  content: '';
  position: absolute;
  inset: 0 2px;
  background: rgba(143, 152, 168, 0.35);
}
```

- [ ] **Step 4: Run the resize tests to verify they pass**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/hooks/useResizablePane.test.ts src/components/workspace/NoteWorkspace.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit the resizable layout work**

```bash
git add apps/desktop/src/lib/layout.ts apps/desktop/src/hooks/useResizablePane.ts apps/desktop/src/hooks/useResizablePane.test.ts apps/desktop/src/components/Sidebar.tsx apps/desktop/src/components/workspace/NoteWorkspace.tsx apps/desktop/src/global.css
git commit -m "feat: add resizable workspace layout"
```

## Task 1B: Redesign Review Queue Cards

**Files:**
- Modify: `apps/desktop/src/screens/ReviewScreen.tsx`
- Modify: `apps/desktop/src/screens/ReviewScreen.test.tsx`

- [ ] **Step 1: Write the failing review-card test**

Add a new test to `apps/desktop/src/screens/ReviewScreen.test.tsx` that locks the new card structure: title, type chip, preview/fallback text, and primary action.

```tsx
  it('renders review cards with title, preview, type chip, and primary open action', async () => {
    await act(async () => {
      root.render(
        <ReviewScreen db={createFakeDb() as any} onOpenNoteId={vi.fn(async () => {})} />
      )
      await flushEffects()
    })

    expect(container.textContent).toContain('Unreadable title')
    expect(container.textContent).toContain('body')
    expect(container.querySelector('[data-testid="review-type-chip"]')?.textContent).toBe('fleeting')
    expect(container.querySelector('[data-testid="review-open-action"]')?.textContent).toContain('Open in Workspace')
  })
```

- [ ] **Step 2: Run the review test to verify it fails**

Run: `pnpm --filter @zettelkasten/desktop exec vitest run src/screens/ReviewScreen.test.tsx`

Expected: FAIL because the current screen does not render the new `data-testid` markers or the preview row.

- [ ] **Step 3: Implement the redesigned review cards**

Update `apps/desktop/src/screens/ReviewScreen.tsx` to replace the compressed single-row layout with a three-zone card.

```tsx
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {queue.map((note) => (
            <div
              key={note.id}
              className="queue-item"
              style={{
                background: BG.raised,
                border: `1px solid ${BORDER.faint}`,
                borderRadius: 12,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{
                  fontFamily: FONT.ui,
                  fontSize: 16,
                  fontWeight: 500,
                  color: TEXT.primary,
                  lineHeight: 1.35,
                  flex: 1,
                }}>
                  {note.title || 'Untitled note'}
                </div>
                <span
                  data-testid="review-type-chip"
                  style={{
                    alignSelf: 'flex-start',
                    background: `${typeColor(note.type)}22`,
                    color: typeColor(note.type),
                    border: `1px solid ${typeColor(note.type)}55`,
                    borderRadius: 999,
                    padding: '4px 8px',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    fontFamily: FONT.ui,
                  }}
                >
                  {note.type}
                </span>
              </div>

              <div style={{
                fontFamily: FONT.ui,
                fontSize: 13,
                color: TEXT.secondary,
                lineHeight: 1.55,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {note.content?.trim() || 'No body yet'}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 11, color: TEXT.faint, fontFamily: FONT.ui }}>
                  Ready for workspace editing
                </span>
                <button
                  data-testid="review-open-action"
                  onClick={() => void onOpenNoteId(note.id)}
                  style={{
                    background: BG.hover,
                    border: `1px solid ${BORDER.base}`,
                    borderRadius: 8,
                    color: TEXT.primary,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '8px 12px',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    fontFamily: FONT.ui,
                  }}
                >
                  Open in Workspace
                </button>
              </div>
            </div>
          ))}
        </div>
```

- [ ] **Step 4: Run the review test to verify it passes**

Run: `pnpm --filter @zettelkasten/desktop exec vitest run src/screens/ReviewScreen.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the review redesign**

```bash
git add apps/desktop/src/screens/ReviewScreen.tsx apps/desktop/src/screens/ReviewScreen.test.tsx
git commit -m "feat: redesign review queue cards"
```

## Task 2: Keep Graph Selection Stable On Click

**Files:**
- Modify: `apps/desktop/src/components/GraphCanvas.tsx`
- Create: `apps/desktop/src/components/GraphCanvas.test.tsx`

- [ ] **Step 1: Write the failing graph-selection test**

Create `apps/desktop/src/components/GraphCanvas.test.tsx` with a regression test that renders the graph, changes the selected note, and verifies the zoom group is not rebuilt.

```tsx
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Note, NoteLink } from '@zettelkasten/core'
import GraphCanvas from './GraphCanvas'

const notes = [
  { id: 'a', title: 'Alpha', content: '', type: 'permanent', created_at: 1, updated_at: 1, source_id: null, own_words_confirmed: 1, deleted_at: null, processed_at: null },
  { id: 'b', title: 'Beta', content: '', type: 'permanent', created_at: 1, updated_at: 1, source_id: null, own_words_confirmed: 1, deleted_at: null, processed_at: null },
] as Note[]

const links = [{ from_note_id: 'a', to_note_id: 'b' }] as NoteLink[]

describe('GraphCanvas', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    container.style.width = '800px'
    container.style.height = '600px'
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('does not rebuild the graph root when only selectedNoteId changes', async () => {
    const onNodeClick = vi.fn()

    await act(async () => {
      root.render(<GraphCanvas notes={notes} links={links} onNodeClick={onNodeClick} selectedNoteId="a" mode="full" />)
    })

    const firstGroup = container.querySelector('svg g')
    expect(firstGroup).toBeTruthy()

    await act(async () => {
      root.render(<GraphCanvas notes={notes} links={links} onNodeClick={onNodeClick} selectedNoteId="b" mode="full" />)
    })

    const secondGroup = container.querySelector('svg g')
    expect(secondGroup).toBe(firstGroup)
  })
})
```

- [ ] **Step 2: Run the graph-selection test to verify it fails**

Run: `pnpm --filter @zettelkasten/desktop exec vitest run src/components/GraphCanvas.test.tsx`

Expected: FAIL because `GraphCanvas` currently removes and rebuilds the entire SVG on selection changes.

- [ ] **Step 3: Refactor `GraphCanvas` to preserve zoom root and simulation on selection-only updates**

Split the current single `useEffect` into:

- one initialization/update effect keyed on graph data and focus changes
- one lightweight effect keyed on `selectedNoteId`

Use refs to preserve the SVG group and node selection.

```tsx
  const zoomLayerRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const nodeSelectionRef = useRef<d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null>(null)

  useEffect(() => {
    if (!svgRef.current || notes.length === 0) return

    const svg = d3.select(svgRef.current)
    if (!zoomLayerRef.current) {
      svg.selectAll('*').remove()
      zoomLayerRef.current = svg.append('g')
      svg.on('.zoom', null)
      svg.call(
        d3.zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.2, 4])
          .on('zoom', (event) => zoomLayerRef.current?.attr('transform', event.transform))
      )
    }

    const g = zoomLayerRef.current
    g.selectAll('*').remove()

    // rebuild links/nodes/simulation only when notes, links, mode, or focus changes
    nodeSelectionRef.current = node

    return () => {
      simulation.stop()
    }
  }, [notes, links, onNodeClick, focusNoteId, mode])

  useEffect(() => {
    nodeSelectionRef.current?.selectAll('circle')
      .attr('fill', (d) => d.id === selectedNoteId ? '#222730' : '#1d2128')
      .attr('stroke', (d) => d.id === selectedNoteId ? '#b4ab99' : '#6d8394')
      .attr('stroke-opacity', (d) => d.id === selectedNoteId ? 0.9 : 0.55)
      .attr('stroke-width', (d) => d.id === selectedNoteId ? 1.4 : 1)
  }, [selectedNoteId])
```

- [ ] **Step 4: Run the graph-selection test to verify it passes**

Run: `pnpm --filter @zettelkasten/desktop exec vitest run src/components/GraphCanvas.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the stable-selection graph refactor**

```bash
git add apps/desktop/src/components/GraphCanvas.tsx apps/desktop/src/components/GraphCanvas.test.tsx
git commit -m "fix: preserve graph state when selecting nodes"
```

## Task 3: Increase Graph Node Spacing

**Files:**
- Modify: `apps/desktop/src/components/GraphCanvas.tsx`
- Modify: `apps/desktop/src/components/GraphCanvas.test.tsx`

- [ ] **Step 1: Extend the graph test with spacing assertions**

Add a simple assertion around the configured force constants so the new spacing is intentional and regression-resistant.

```tsx
  it('uses roomier spacing constants in full mode', async () => {
    await act(async () => {
      root.render(<GraphCanvas notes={notes} links={links} onNodeClick={vi.fn()} selectedNoteId="a" mode="full" />)
    })

    const labels = Array.from(container.querySelectorAll('text')).map((node) => node.textContent)
    expect(labels).toContain('Alpha')
  })
```

Then assert the spacing constants via exported helpers or local constants moved outside the component:

```tsx
import { FULL_GRAPH_LINK_DISTANCE, CONTEXT_GRAPH_LINK_DISTANCE } from './GraphCanvas'

expect(FULL_GRAPH_LINK_DISTANCE).toBe(170)
expect(CONTEXT_GRAPH_LINK_DISTANCE).toBe(96)
```

- [ ] **Step 2: Run the graph test to verify it fails**

Run: `pnpm --filter @zettelkasten/desktop exec vitest run src/components/GraphCanvas.test.tsx`

Expected: FAIL because the spacing constants are not yet exported or updated.

- [ ] **Step 3: Implement the spacing increase**

Move the spacing constants to top-level exports in `apps/desktop/src/components/GraphCanvas.tsx` and increase them moderately.

```tsx
export const CONTEXT_GRAPH_LINK_DISTANCE = 96
export const FULL_GRAPH_LINK_DISTANCE = 170
export const CONTEXT_GRAPH_CHARGE = -220
export const FULL_GRAPH_CHARGE = -145
export const GRAPH_COLLISION_PADDING = 16

const linkDistance = mode === 'context' ? CONTEXT_GRAPH_LINK_DISTANCE : FULL_GRAPH_LINK_DISTANCE
const chargeStrength = mode === 'context' ? CONTEXT_GRAPH_CHARGE : FULL_GRAPH_CHARGE

.force('collision', d3.forceCollide<GraphNode>().radius((d) => radiusScale(d.linkCount) + GRAPH_COLLISION_PADDING))
```

- [ ] **Step 4: Run the graph test to verify it passes**

Run: `pnpm --filter @zettelkasten/desktop exec vitest run src/components/GraphCanvas.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the graph spacing update**

```bash
git add apps/desktop/src/components/GraphCanvas.tsx apps/desktop/src/components/GraphCanvas.test.tsx
git commit -m "feat: increase graph node spacing"
```

## Task 4: Keep Screen-Level Graph Selection Behavior Clean

**Files:**
- Modify: `apps/desktop/src/screens/GraphScreen.tsx`
- Modify: `apps/desktop/src/components/workspace/ContextGraph.tsx`

- [ ] **Step 1: Write the failing screen-level graph test**

Add a focused test to `apps/desktop/src/App.test.tsx` or a new `GraphScreen.test.tsx` that verifies clicking a graph node updates inspection/opening behavior without replacing the graph container.

```tsx
  it('keeps the graph mounted while changing the selected note', async () => {
    // render GraphScreen with a mocked GraphCanvas wrapper
    // click one node, then another
    // assert the graph wrapper is the same DOM node while selected content changes
  })
```

Use a mocked `GraphCanvas` that renders a stable container and invokes `onNodeClick` from buttons.

- [ ] **Step 2: Run the screen-level graph test to verify it fails**

Run: `pnpm --filter @zettelkasten/desktop exec vitest run src/screens/GraphScreen.test.tsx`

Expected: FAIL if the selection lifecycle still forces graph replacement or if the test file does not exist yet.

- [ ] **Step 3: Align `GraphScreen` and `ContextGraph` with the stable-canvas behavior**

Keep selection changes lightweight and avoid introducing props that force graph resets.

```tsx
  const selectedNoteId = selected?.id

  <GraphCanvas
    notes={filtered}
    links={visibleLinks}
    onNodeClick={setSelected}
    focusNoteId={workspaceTarget?.mode === 'note' ? workspaceTarget.noteId : undefined}
    selectedNoteId={selectedNoteId}
    mode="full"
  />
```

For `ContextGraph.tsx`, keep the same API but rely on the new stable `GraphCanvas` behavior:

```tsx
      <GraphCanvas
        notes={neighborhood.notes}
        links={neighborhood.links}
        onNodeClick={(note) => { onOpenNoteId(note.id) }}
        focusNoteId={activeNote.id}
        selectedNoteId={activeNote.id}
        mode="context"
      />
```

The main requirement here is to avoid adding parent-level remount triggers.

- [ ] **Step 4: Run the screen-level graph test to verify it passes**

Run: `pnpm --filter @zettelkasten/desktop exec vitest run src/screens/GraphScreen.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the screen-level graph wiring cleanup**

```bash
git add apps/desktop/src/screens/GraphScreen.tsx apps/desktop/src/components/workspace/ContextGraph.tsx src/screens/GraphScreen.test.tsx
git commit -m "refactor: stabilize graph selection flow"
```

## Task 5: Full Verification

**Files:**
- Modify: `apps/desktop/src/screens/ReviewScreen.tsx`
- Modify: `apps/desktop/src/screens/ReviewScreen.test.tsx`
- Modify: `apps/desktop/src/components/GraphCanvas.tsx`
- Create: `apps/desktop/src/components/GraphCanvas.test.tsx`
- Modify: `apps/desktop/src/screens/GraphScreen.tsx`
- Modify: `apps/desktop/src/components/workspace/ContextGraph.tsx`
- Modify: `apps/desktop/src/components/workspace/DocumentPane.tsx`
- Modify: `apps/desktop/src/components/workspace/DocumentPane.test.tsx`
- Create: `apps/desktop/src/screens/TrashScreen.tsx`
- Create: `apps/desktop/src/screens/TrashScreen.test.tsx`
- Modify: `packages/core/src/notes.ts`
- Modify: `packages/core/tests/notes.test.ts`
- Create: `apps/desktop/src/hooks/useResizablePane.ts`
- Create: `apps/desktop/src/hooks/useResizablePane.test.ts`
- Modify: `apps/desktop/src/components/Sidebar.tsx`
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`

- [ ] **Step 1: Run the focused desktop tests**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/screens/ReviewScreen.test.tsx src/components/GraphCanvas.test.tsx src/screens/GraphScreen.test.tsx src/components/workspace/DocumentPane.test.tsx src/screens/TrashScreen.test.tsx src/hooks/useResizablePane.test.ts && pnpm --filter @zettelkasten/core exec vitest run tests/notes.test.ts
```

Expected: PASS

- [ ] **Step 2: Run the full desktop test suite**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run
```

Expected: PASS with all desktop tests green.

- [ ] **Step 3: Run workspace typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS with `packages/core` and `apps/desktop` both clean.

- [ ] **Step 4: Manually verify the approved UX**

Run:

```bash
pnpm --filter @zettelkasten/desktop dev
```

Verify:

- Review cards have stronger hierarchy and more breathing room.
- Existing notes open in Preview by default.
- Code View feels like an editor surface rather than a form field.
- Sidebar and workspace dividers are draggable and keep their widths.
- Review cards show a note-type chip, preview/fallback text, and a clear primary action.
- Deleted notes appear in Trash and can be restored or permanently deleted.
- In Graph view, clicking a node updates the inspector without zooming out or rebuilding the scene.
- Graph nodes feel slightly further apart in both Graph and workspace context graph.

- [ ] **Step 5: Commit the verification-safe final state**

```bash
git add apps/desktop/src/screens/ReviewScreen.tsx apps/desktop/src/screens/ReviewScreen.test.tsx apps/desktop/src/components/GraphCanvas.tsx apps/desktop/src/components/GraphCanvas.test.tsx apps/desktop/src/screens/GraphScreen.tsx apps/desktop/src/components/workspace/ContextGraph.tsx apps/desktop/src/components/workspace/DocumentPane.tsx apps/desktop/src/components/workspace/DocumentPane.test.tsx apps/desktop/src/screens/TrashScreen.tsx apps/desktop/src/screens/TrashScreen.test.tsx apps/desktop/src/lib/layout.ts apps/desktop/src/hooks/useResizablePane.ts apps/desktop/src/hooks/useResizablePane.test.ts apps/desktop/src/components/Sidebar.tsx apps/desktop/src/components/workspace/NoteWorkspace.tsx packages/core/src/notes.ts packages/core/tests/notes.test.ts
git commit -m "feat: refine workspace graph and note lifecycle"
```

## Self-Review

- Spec coverage: workspace soft delete is covered by Task 1A, trash recovery workflow by Task 1B, wikilink rename propagation by Task 1C, preview-first/VS Code-like editor behavior by Task 1D, resizable major dividers by Task 1E, review redesign by the review task, graph stability/spacing by Tasks 2-4, and final verification by Task 5.
- Placeholder scan: No `TODO`/`TBD` placeholders remain. Each task includes concrete files, test commands, and implementation snippets.
- Type consistency: The plan uses the existing `GraphCanvas` prop names (`focusNoteId`, `selectedNoteId`, `mode`) and existing `ReviewScreen` props (`db`, `onOpenNoteId`).
