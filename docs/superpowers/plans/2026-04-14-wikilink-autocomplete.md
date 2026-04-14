# Wikilink Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline `[[...]]` note autocomplete to the editor, including search over existing notes and inline creation of a new fleeting note when there is no good match.

**Architecture:** Keep wikilinks title-based and build the new behavior around the existing `MarkdownEditor` and `note-workflow` pipeline. Add a small editor-native picker for active wikilink queries, pass note suggestion/create callbacks from the workspace into the editor layer, and continue relying on the existing save/link-sync flow so graph connectivity comes from the current `note_links` mechanism rather than a parallel system.

**Tech Stack:** React 18, TypeScript, CodeMirror 6, Vitest, existing note/workspace helpers

---

## File Map

- Modify: `apps/desktop/src/components/MarkdownEditor.tsx`
  Detect active wikilink queries while typing, render the inline picker, and handle keyboard insertion/selection.
- Modify: `apps/desktop/src/components/MarkdownEditor.test.tsx`
  Add tests for opening the picker, filtering notes, inserting a selected result, and create-new selection.
- Modify: `apps/desktop/src/lib/wikilinks.ts`
  Add small parsing helpers for active wikilink query detection and title insertion.
- Create: `apps/desktop/src/lib/wikilinks.test.ts`
  Add deterministic tests for active-query parsing and insertion behavior.
- Modify: `apps/desktop/src/components/workspace/DocumentPane.tsx`
  Pass note suggestion/create callbacks into the markdown editor.
- Modify: `apps/desktop/src/components/workspace/DocumentPane.test.tsx`
  Update the mocked editor contract to include autocomplete callbacks if needed.
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`
  Provide existing-note suggestions and inline fleeting-note creation to the editor.
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.test.tsx`
  Add regression coverage for create-new note wiring if needed.

## Task 1: Add Wikilink Query Parsing Helpers

**Files:**
- Modify: `apps/desktop/src/lib/wikilinks.ts`
- Create: `apps/desktop/src/lib/wikilinks.test.ts`

- [ ] **Step 1: Write the failing parsing tests**

Create `apps/desktop/src/lib/wikilinks.test.ts` and add focused tests for active-query detection and insertion text rewriting.

```ts
import { describe, expect, it } from 'vitest'
import { getActiveWikilinkQuery, insertWikilinkSelection } from './wikilinks'

describe('getActiveWikilinkQuery', () => {
  it('detects an open wikilink query after double brackets', () => {
    expect(getActiveWikilinkQuery('See [[Al', 8)).toEqual({
      from: 4,
      to: 8,
      query: 'Al',
    })
  })

  it('returns null when the cursor is outside an unfinished wikilink', () => {
    expect(getActiveWikilinkQuery('See [[Alpha]] next', 5)).toBeNull()
  })
})

describe('insertWikilinkSelection', () => {
  it('replaces the active query with a completed wikilink', () => {
    expect(insertWikilinkSelection('See [[Al', { from: 4, to: 8, query: 'Al' }, 'Alpha Note')).toEqual({
      value: 'See [[Alpha Note]]',
      cursor: 18,
    })
  })
})
```

- [ ] **Step 2: Run the wikilinks helper tests to verify they fail**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/lib/wikilinks.test.ts
```

Expected: FAIL because the new helper functions do not exist yet.

- [ ] **Step 3: Implement the minimal parsing helpers**

Update `apps/desktop/src/lib/wikilinks.ts` with two small pure helpers.

```ts
export interface ActiveWikilinkQuery {
  from: number
  to: number
  query: string
}

export function getActiveWikilinkQuery(value: string, cursor: number): ActiveWikilinkQuery | null {
  const beforeCursor = value.slice(0, cursor)
  const openIndex = beforeCursor.lastIndexOf('[[')
  if (openIndex === -1) return null

  const closingIndex = beforeCursor.indexOf(']]', openIndex)
  if (closingIndex !== -1) return null

  const query = beforeCursor.slice(openIndex + 2)
  if (query.includes('\n')) return null

  return {
    from: openIndex,
    to: cursor,
    query,
  }
}

export function insertWikilinkSelection(
  value: string,
  activeQuery: ActiveWikilinkQuery,
  title: string,
): { value: string; cursor: number } {
  const replacement = `[[${title}]]`
  const nextValue = value.slice(0, activeQuery.from) + replacement + value.slice(activeQuery.to)
  return {
    value: nextValue,
    cursor: activeQuery.from + replacement.length,
  }
}
```

- [ ] **Step 4: Run the helper tests to verify they pass**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/lib/wikilinks.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit the wikilink helper layer**

```bash
git add apps/desktop/src/lib/wikilinks.ts apps/desktop/src/lib/wikilinks.test.ts
git commit -m "feat: add wikilink query helpers"
```

## Task 2: Add Inline Autocomplete UI To MarkdownEditor

**Files:**
- Modify: `apps/desktop/src/components/MarkdownEditor.tsx`
- Modify: `apps/desktop/src/components/MarkdownEditor.test.tsx`

- [ ] **Step 1: Write the failing editor autocomplete tests**

Add tests to `apps/desktop/src/components/MarkdownEditor.test.tsx`.

```tsx
  it('shows wikilink suggestions when typing double brackets', async () => {
    await act(async () => {
      root.render(
        <MarkdownEditor
          value="See [[Al"
          onChange={vi.fn()}
          wikilinkOptions={[{ id: '1', title: 'Alpha Note' }, { id: '2', title: 'Another Note' }]}
        />
      )
    })

    expect(container.textContent).toContain('Alpha Note')
    expect(container.textContent).not.toContain('Another Note')
  })

  it('calls onCreateWikilinkNote when the create-new option is selected', async () => {
    const onCreateWikilinkNote = vi.fn(async () => ({ id: 'new-1', title: 'Missing Note' }))
    const onChange = vi.fn()

    await act(async () => {
      root.render(
        <MarkdownEditor
          value="See [[Missing Note"
          onChange={onChange}
          wikilinkOptions={[]}
          onCreateWikilinkNote={onCreateWikilinkNote}
        />
      )
    })

    const createOption = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Create new fleeting note')
    )

    await act(async () => {
      createOption?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onCreateWikilinkNote).toHaveBeenCalledWith('Missing Note')
    expect(onChange).toHaveBeenCalledWith('See [[Missing Note]]')
  })
```

- [ ] **Step 2: Run the MarkdownEditor tests to verify they fail**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/components/MarkdownEditor.test.tsx
```

Expected: FAIL because the editor currently has no autocomplete props or picker UI.

- [ ] **Step 3: Implement the minimal editor picker**

Update `apps/desktop/src/components/MarkdownEditor.tsx`.

Add props:

```ts
interface WikilinkOption {
  id: string
  title: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
  readOnly?: boolean
  onLinkClick?: (linkText: string) => void
  wikilinkOptions?: WikilinkOption[]
  onCreateWikilinkNote?: (title: string) => Promise<{ id: string; title: string }>
}
```

Use the new helper to derive the active query from `value` and the current selection. If you cannot read cursor position directly from the wrapper, track it from CodeMirror update events.

Render a lightweight picker below the editor when an active query exists:

```tsx
      {activeQuery && !readOnly && (
        <div className="wikilink-picker">
          {filteredOptions.map((option, index) => (
            <button key={option.id} onClick={() => handleOptionSelect(option.title)}>
              {option.title}
            </button>
          ))}
          {!!activeQuery.query.trim() && (
            <button onClick={() => void handleCreateOption(activeQuery.query.trim())}>
              Create new fleeting note "{activeQuery.query.trim()}"
            </button>
          )}
        </div>
      )}
```

When selecting a result:

- rewrite the editor text with `insertWikilinkSelection(...)`
- call `onChange(nextValue)`
- keep focus in the editor if possible

When creating a new note:

- call `onCreateWikilinkNote(title)`
- insert `[[Title]]` into the editor text

- [ ] **Step 4: Run the MarkdownEditor tests to verify they pass**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/components/MarkdownEditor.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit the editor autocomplete UI**

```bash
git add apps/desktop/src/components/MarkdownEditor.tsx apps/desktop/src/components/MarkdownEditor.test.tsx
git commit -m "feat: add wikilink autocomplete picker"
```

## Task 3: Wire Suggestions And Create-New Through The Workspace

**Files:**
- Modify: `apps/desktop/src/components/workspace/DocumentPane.tsx`
- Modify: `apps/desktop/src/components/workspace/DocumentPane.test.tsx`
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.test.tsx`

- [ ] **Step 1: Write the failing workspace wiring tests**

Add or update tests in `apps/desktop/src/components/workspace/NoteWorkspace.test.tsx` to prove the workspace passes note suggestions and handles create-new note creation.

```tsx
  it('passes wikilink suggestions from existing notes into the document pane', async () => {
    const db = createFakeDb()
    db.query.mockResolvedValueOnce([
      { id: 'note-2', title: 'Alpha Note', content: '', type: 'fleeting', created_at: 1, updated_at: 1, source_id: null, own_words_confirmed: 0, processed_at: null, deleted_at: null },
    ])

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db as any}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={vi.fn(async () => {})}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    expect(documentPaneSpy).toHaveBeenCalledWith(expect.objectContaining({
      wikilinkOptions: expect.arrayContaining([
        expect.objectContaining({ title: 'Alpha Note' }),
      ]),
    }))
  })
```

- [ ] **Step 2: Run the workspace tests to verify they fail**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/components/workspace/NoteWorkspace.test.tsx
```

Expected: FAIL because the workspace does not yet provide autocomplete props.

- [ ] **Step 3: Implement workspace suggestion/create wiring**

Update `apps/desktop/src/components/workspace/NoteWorkspace.tsx`.

1. Add a small note-title lookup query for suggestions:

```ts
async function loadWikilinkOptions(): Promise<Array<{ id: string; title: string }>> {
  return db.query<{ id: string; title: string }>(
    'SELECT id, title FROM notes WHERE deleted_at IS NULL ORDER BY updated_at DESC'
  )
}
```

2. Add a create-new helper:

```ts
async function handleCreateWikilinkNote(title: string) {
  const created = await createNote(db, { type: 'fleeting', title })
  await onInboxCountChange()
  return { id: created.id, title: created.title }
}
```

3. Pass these into `DocumentPane`:

```tsx
          wikilinkOptions={wikilinkOptions}
          onCreateWikilinkNote={handleCreateWikilinkNote}
```

4. Update `apps/desktop/src/components/workspace/DocumentPane.tsx` to forward the props to `MarkdownEditor`.

- [ ] **Step 4: Run the workspace tests to verify they pass**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/components/workspace/NoteWorkspace.test.tsx src/components/workspace/DocumentPane.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit the workspace wiring**

```bash
git add apps/desktop/src/components/workspace/DocumentPane.tsx apps/desktop/src/components/workspace/DocumentPane.test.tsx apps/desktop/src/components/workspace/NoteWorkspace.tsx apps/desktop/src/components/workspace/NoteWorkspace.test.tsx
git commit -m "feat: wire wikilink suggestions through workspace"
```

## Task 4: Verify Link And Graph Flow

**Files:**
- Modify: `apps/desktop/src/lib/note-workflow.test.ts`
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.test.tsx`

- [ ] **Step 1: Add a regression test for create-new note link flow**

Add a test proving that a created note can be referenced immediately and still uses the existing save/link-sync path.

```ts
  it('allows a newly created fleeting note title to be inserted as a wikilink target', async () => {
    const created = await createNote(db, { type: 'fleeting', title: 'New Linked Note' })
    const updated = rewriteTitleBasedWikilinks('See [[New Linked N', 'New Linked N', created.title)
    expect(updated).not.toBeNull()
  })
```

If that specific shape is awkward, keep this task focused on proving the create-new path feeds the same saved markdown/link-sync workflow rather than inventing a second graph path.

- [ ] **Step 2: Run the note-workflow and workspace tests to verify they fail or need extension**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/lib/note-workflow.test.ts src/components/workspace/NoteWorkspace.test.tsx
```

Expected: FAIL until the coverage matches the new create-new behavior.

- [ ] **Step 3: Implement or tighten the graph/link regression coverage**

Keep this minimal:

- ensure create-new note insertion uses the same markdown wikilink text path
- ensure no separate graph-link code is introduced
- ensure existing note-link syncing remains the path to graph connectivity

If the strongest coverage lives better in `NoteWorkspace.test.tsx`, add it there and keep `note-workflow.ts` unchanged.

- [ ] **Step 4: Run the updated regression tests to verify they pass**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/lib/note-workflow.test.ts src/components/workspace/NoteWorkspace.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit the graph/link regression coverage**

```bash
git add apps/desktop/src/lib/note-workflow.test.ts apps/desktop/src/components/workspace/NoteWorkspace.test.tsx
git commit -m "test: cover wikilink create-note flow"
```

## Task 5: Full Verification

**Files:**
- Modify: `apps/desktop/src/components/MarkdownEditor.tsx`
- Modify: `apps/desktop/src/components/MarkdownEditor.test.tsx`
- Modify: `apps/desktop/src/lib/wikilinks.ts`
- Create: `apps/desktop/src/lib/wikilinks.test.ts`
- Modify: `apps/desktop/src/components/workspace/DocumentPane.tsx`
- Modify: `apps/desktop/src/components/workspace/DocumentPane.test.tsx`
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.test.tsx`

- [ ] **Step 1: Run focused autocomplete tests**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/lib/wikilinks.test.ts src/components/MarkdownEditor.test.tsx src/components/workspace/DocumentPane.test.tsx src/components/workspace/NoteWorkspace.test.tsx
```

Expected: PASS

- [ ] **Step 2: Run the full workspace test suite**

Run:

```bash
pnpm test
```

Expected: PASS

- [ ] **Step 3: Run workspace typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 4: Manually verify the editor flow**

Run:

```bash
pnpm --filter @zettelkasten/desktop dev
```

Verify:

- typing `[[` opens the inline picker
- typing more characters filters matching notes
- selecting a suggestion inserts `[[Title]]`
- selecting create-new creates a fleeting note and inserts its wikilink
- editing can continue without focus loss
- saved links continue to participate in the graph through the existing sync flow

- [ ] **Step 5: Commit the verification-safe final state**

```bash
git add apps/desktop/src/components/MarkdownEditor.tsx apps/desktop/src/components/MarkdownEditor.test.tsx apps/desktop/src/lib/wikilinks.ts apps/desktop/src/lib/wikilinks.test.ts apps/desktop/src/components/workspace/DocumentPane.tsx apps/desktop/src/components/workspace/DocumentPane.test.tsx apps/desktop/src/components/workspace/NoteWorkspace.tsx apps/desktop/src/components/workspace/NoteWorkspace.test.tsx
git commit -m "feat: add wikilink autocomplete"
```

## Self-Review

- Spec coverage: Task 1 covers parsing helpers, Task 2 covers inline picker UI, Task 3 covers workspace note suggestion/create wiring, Task 4 covers graph/link regression boundaries, and Task 5 covers verification.
- Placeholder scan: No `TODO`/`TBD` placeholders remain. Each task includes exact files, code, and commands.
- Type consistency: The plan keeps wikilinks title-based, uses the existing workspace/editor component boundaries, and routes new note creation through the existing `createNote(db, { type: 'fleeting', ... })` path.
