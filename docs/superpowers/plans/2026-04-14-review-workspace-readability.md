# Review And Workspace Readability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Review rows clickable like Library, wrap long workspace titles, and replace the cramped compact 3-column workspace with a more readable fallback.

**Architecture:** Keep the current screen/component boundaries and make the smallest changes in place. `ReviewScreen` will adopt Library-style whole-row click behavior while preserving Review colors. The workspace will keep the current desktop three-pane experience on wide windows, but `NoteWorkspace` and `DocumentPane` will switch to a document-first compact layout with wrapped titles and toggleable supporting panes on narrow widths.

**Tech Stack:** React 18, TypeScript, Vitest, inline styles with shared theme tokens, existing workspace/layout helpers

---

## File Map

- Modify: `apps/desktop/src/screens/ReviewScreen.tsx`
  Remove the per-row button and make the whole Review row clickable like Library while preserving Review colors and queue behavior.
- Modify: `apps/desktop/src/screens/ReviewScreen.test.tsx`
  Lock the clickable-row behavior and preserve current queue/fallback behavior.
- Modify: `apps/desktop/src/components/workspace/DocumentPane.tsx`
  Make the title field wrap cleanly instead of clipping.
- Modify: `apps/desktop/src/components/workspace/DocumentPane.test.tsx`
  Add regression coverage for wrapped title behavior.
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`
  Add compact-window fallback behavior so the document pane stays primary and supporting panes stop crushing the layout.
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.test.tsx`
  Add regression coverage for compact workspace controls and layout fallback.
- Modify: `apps/desktop/src/global.css`
  Add any minimal responsive styles or utility classes needed for the compact workspace fallback.

## Task 1: Make Review Rows Clickable Like Library

**Files:**
- Modify: `apps/desktop/src/screens/ReviewScreen.tsx`
- Modify: `apps/desktop/src/screens/ReviewScreen.test.tsx`

- [ ] **Step 1: Write the failing clickable-row test**

Add a new interaction test to `apps/desktop/src/screens/ReviewScreen.test.tsx`:

```tsx
  it('opens the note when the whole review row is clicked', async () => {
    const onOpenNoteId = vi.fn(async () => {})

    await act(async () => {
      root.render(
        <ReviewScreen db={createFakeDb() as any} onOpenNoteId={onOpenNoteId} />
      )
      await flushEffects()
    })

    const card = container.querySelector('[data-testid="review-card"]') as HTMLElement | null
    expect(card).toBeTruthy()

    await act(async () => {
      card?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onOpenNoteId).toHaveBeenCalledWith('note-1')
    expect(container.textContent).not.toContain('Open in Workspace')
  })
```

- [ ] **Step 2: Run the Review test file to verify it fails**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/screens/ReviewScreen.test.tsx
```

Expected: FAIL because the current implementation still renders a separate `Open in Workspace` action and the row itself is not the primary click target.

- [ ] **Step 3: Implement whole-row click behavior**

Update `apps/desktop/src/screens/ReviewScreen.tsx` so each row behaves like the Library rows.

Use a clickable row shell similar to:

```tsx
            <button
              key={note.id}
              onClick={() => void onOpenNoteId(note.id)}
              data-testid="review-card"
              style={{
                background: BG.raised,
                border: `1px solid ${BORDER.faint}`,
                borderRadius: 12,
                overflow: 'hidden',
                padding: '16px 18px',
                display: 'flex',
                alignItems: 'stretch',
                gap: 16,
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
```

Also:

- remove the dedicated `review-card-open-action` button
- keep the left accent strip
- keep the inline metadata and preview text
- keep the current Review colors and type accents

- [ ] **Step 4: Run the Review test file to verify it passes**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/screens/ReviewScreen.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit the clickable Review rows**

```bash
git add apps/desktop/src/screens/ReviewScreen.tsx apps/desktop/src/screens/ReviewScreen.test.tsx
git commit -m "feat: make review rows open like library"
```

## Task 2: Wrap Long Workspace Titles

**Files:**
- Modify: `apps/desktop/src/components/workspace/DocumentPane.tsx`
- Modify: `apps/desktop/src/components/workspace/DocumentPane.test.tsx`

- [ ] **Step 1: Write the failing wrapped-title test**

Add a test to `apps/desktop/src/components/workspace/DocumentPane.test.tsx`:

```tsx
  it('lets long workspace titles wrap instead of clipping', async () => {
    await act(async () => {
      root.render(
        <DocumentPane
          title="A very long note title that should wrap across lines instead of being clipped by the input field"
          content="Body"
          saveState="saved"
          placeholderTitle="Title"
          placeholderBody="Body"
          onTitleChange={vi.fn()}
          onContentChange={vi.fn()}
        />
      )
    })

    const titleInput = container.querySelector('input') as HTMLInputElement | null
    expect(titleInput).toBeTruthy()
    expect(titleInput?.style.whiteSpace).toBe('normal')
  })
```

- [ ] **Step 2: Run the DocumentPane tests to verify they fail**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/components/workspace/DocumentPane.test.tsx
```

Expected: FAIL because the current title field still behaves like a single-line clipped input.

- [ ] **Step 3: Implement wrapped title editing**

Replace the single-line title input in `apps/desktop/src/components/workspace/DocumentPane.tsx` with a wrapped editing surface that still behaves as an inline title editor.

Minimal acceptable implementation:

```tsx
          <textarea
            value={title}
            onChange={(event) => onTitleChange(event.currentTarget.value)}
            readOnly={readOnly}
            placeholder={placeholderTitle}
            rows={1}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: TEXT.primary,
              fontFamily: FONT.display,
              fontSize: 26,
              fontWeight: 500,
              lineHeight: 1.2,
              width: '100%',
              padding: '8px 0 12px',
              resize: 'none',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
            }}
          />
```

If needed, add a tiny auto-height effect so the textarea grows with content instead of showing a scrollbar.

- [ ] **Step 4: Run the DocumentPane tests to verify they pass**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/components/workspace/DocumentPane.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit the wrapped title change**

```bash
git add apps/desktop/src/components/workspace/DocumentPane.tsx apps/desktop/src/components/workspace/DocumentPane.test.tsx
git commit -m "fix: wrap long workspace titles"
```

## Task 3: Add Compact Workspace Fallback

**Files:**
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.test.tsx`
- Modify: `apps/desktop/src/global.css`

- [ ] **Step 1: Write the failing compact-layout tests**

Add focused tests to `apps/desktop/src/components/workspace/NoteWorkspace.test.tsx` that assert compact-mode controls exist and the document pane stays primary.

Use a window-width driven contract, for example:

```tsx
  it('shows compact workspace toggles instead of forcing three visible columns on narrow widths', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 980, configurable: true })

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={createFakeDb() as any}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={vi.fn(async () => {})}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    expect(container.querySelector('[data-testid="workspace-compact-toggle-rail"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="workspace-compact-toggle-context"]')).toBeTruthy()
  })
```

- [ ] **Step 2: Run the workspace tests to verify they fail**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/components/workspace/NoteWorkspace.test.tsx
```

Expected: FAIL because the current workspace always renders the full three-pane structure.

- [ ] **Step 3: Implement the compact two-pane fallback**

Update `apps/desktop/src/components/workspace/NoteWorkspace.tsx` so narrow widths stop forcing the left rail and right context pane to stay visible at the same time.

Minimal implementation shape:

```tsx
  const isCompact = window.innerWidth < 1100
  const [showCompactRail, setShowCompactRail] = useState(false)
  const [showCompactContext, setShowCompactContext] = useState(false)
```

In compact mode:

- keep `DocumentPane` always visible
- hide the side panes by default
- add toggle buttons such as:

```tsx
<button data-testid="workspace-compact-toggle-rail" onClick={() => setShowCompactRail((v) => !v)}>
  Notes
</button>
<button data-testid="workspace-compact-toggle-context" onClick={() => setShowCompactContext((v) => !v)}>
  Context
</button>
```

- render the rail/context as overlay drawers or stacked panels only when toggled on

Keep the wide-screen three-column layout unchanged.

- [ ] **Step 4: Run the workspace tests to verify they pass**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/components/workspace/NoteWorkspace.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit the compact workspace fallback**

```bash
git add apps/desktop/src/components/workspace/NoteWorkspace.tsx apps/desktop/src/components/workspace/NoteWorkspace.test.tsx apps/desktop/src/global.css
git commit -m "feat: add compact workspace fallback"
```

## Task 4: Full Verification

**Files:**
- Modify: `apps/desktop/src/screens/ReviewScreen.tsx`
- Modify: `apps/desktop/src/screens/ReviewScreen.test.tsx`
- Modify: `apps/desktop/src/components/workspace/DocumentPane.tsx`
- Modify: `apps/desktop/src/components/workspace/DocumentPane.test.tsx`
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.test.tsx`
- Modify: `apps/desktop/src/global.css`

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/screens/ReviewScreen.test.tsx src/components/workspace/DocumentPane.test.tsx src/components/workspace/NoteWorkspace.test.tsx
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

- [ ] **Step 4: Manually verify the UX**

Run:

```bash
pnpm --filter @zettelkasten/desktop dev
```

Verify:

- Review rows open on whole-row click.
- Review keeps its current colors and no longer shows `Open in Workspace`.
- Long workspace titles wrap cleanly instead of clipping.
- Narrow windows stop forcing the full three-column layout and keep the document readable.

- [ ] **Step 5: Commit the verification-safe final state**

```bash
git add apps/desktop/src/screens/ReviewScreen.tsx apps/desktop/src/screens/ReviewScreen.test.tsx apps/desktop/src/components/workspace/DocumentPane.tsx apps/desktop/src/components/workspace/DocumentPane.test.tsx apps/desktop/src/components/workspace/NoteWorkspace.tsx apps/desktop/src/components/workspace/NoteWorkspace.test.tsx apps/desktop/src/global.css
git commit -m "feat: improve review and workspace readability"
```

## Self-Review

- Spec coverage: Task 1 covers clickable Review rows and preserved Review colors. Task 2 covers wrapped workspace titles. Task 3 covers compact-window workspace fallback. Task 4 covers verification.
- Placeholder scan: No `TODO`/`TBD` placeholders remain. Each task includes exact files, code, and commands.
- Type consistency: The plan keeps the current `ReviewScreen`, `DocumentPane`, and `NoteWorkspace` component boundaries and only changes their existing props/markup in place.
