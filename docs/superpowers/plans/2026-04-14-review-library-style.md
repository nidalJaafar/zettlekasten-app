# Review Library-Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Review screen use the Library-style row shell while keeping the current Review colors and actions.

**Architecture:** Keep the Review screen as a single screen component and replace only the current row/card markup. Reuse the Library screen's structural rhythm: horizontal row card, left accent strip, calm text block, and integrated action area, while preserving Review queue behavior, Review-specific buttons, and the current Review color palette.

**Tech Stack:** React 18, TypeScript, Vitest, inline style objects with shared theme tokens

---

## File Map

- Modify: `apps/desktop/src/screens/ReviewScreen.tsx`
  Replace the segmented Review card layout with a Library-style horizontal row shell while preserving Review queue behavior and current colors.
- Modify: `apps/desktop/src/screens/ReviewScreen.test.tsx`
  Update the tests to assert the Library-style row shell, left accent strip, integrated action area, and unchanged queue behavior.

## Task 1: Redesign Review Rows To Match Library Structure

**Files:**
- Modify: `apps/desktop/src/screens/ReviewScreen.tsx`
- Modify: `apps/desktop/src/screens/ReviewScreen.test.tsx`

- [ ] **Step 1: Write the failing tests for the Library-style row shell**

Update `apps/desktop/src/screens/ReviewScreen.test.tsx` so the test suite asserts the new structure directly instead of the current segmented card layout.

Add or replace assertions with tests like:

```tsx
  it('renders review items with a library-style row shell and integrated action area', async () => {
    const db = createFakeDb()
    db.query.mockResolvedValue([
      makeNote({ id: 'lit-2', title: 'Literature card', type: 'literature' }),
    ])

    await act(async () => {
      root.render(
        <ReviewScreen db={db as any} onOpenNoteId={vi.fn(async () => {})} />
      )
      await flushEffects()
    })

    const cards = Array.from(container.querySelectorAll('[data-testid="review-card"]'))

    expect(cards).toHaveLength(2)
    expect(cards[0]?.querySelector('[data-testid="review-card-accent"]')).toBeTruthy()
    expect(cards[0]?.querySelector('[data-testid="review-card-body"]')).toBeTruthy()
    expect(cards[0]?.querySelector('[data-testid="review-card-meta"]')).toBeTruthy()
    expect(cards[0]?.querySelector('[data-testid="review-card-open-action"]')?.textContent).toBe('Open in Workspace')
    expect(cards[0]?.querySelector('[data-testid="review-card-preview-panel"]')).toBeNull()
  })

  it('keeps preview text inline with the library-style content block', async () => {
    vi.mocked(getNotesByType).mockResolvedValue([
      makeNote({ content: 'A roomy preview for the review card.' }),
    ])

    await act(async () => {
      root.render(
        <ReviewScreen db={createFakeDb() as any} onOpenNoteId={vi.fn(async () => {})} />
      )
      await flushEffects()
    })

    const body = container.querySelector('[data-testid="review-card-body"]')
    expect(body?.textContent).toContain('Unreadable title')
    expect(body?.textContent).toContain('A roomy preview for the review card.')
  })
```

- [ ] **Step 2: Run the Review screen test file to verify it fails**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/screens/ReviewScreen.test.tsx
```

Expected: FAIL because the current Review markup still uses the segmented custom card structure and does not render the new Library-style row markers.

- [ ] **Step 3: Implement the Library-style Review rows**

Update `apps/desktop/src/screens/ReviewScreen.tsx` so each Review item uses the same horizontal shell pattern as `LibraryScreen`, while keeping Review's current colors and queue actions.

Replace the current row markup inside `queue.map(...)` with a structure like:

```tsx
          {queue.map((note) => (
            <div
              key={note.id}
              data-testid="review-card"
              style={{
                background: BG.raised,
                border: `1px solid ${BORDER.faint}`,
                borderRadius: 12,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'stretch',
                gap: 16,
                padding: '16px 18px',
              }}
            >
              <div
                data-testid="review-card-accent"
                style={{
                  width: 6,
                  borderRadius: 999,
                  background: typeColor(note.type),
                  opacity: 0.7,
                  flexShrink: 0,
                }}
              />

              <div data-testid="review-card-body" style={{ flex: 1, minWidth: 0 }}>
                <div
                  data-testid="review-card-title"
                  style={{
                    fontFamily: FONT.ui,
                    fontSize: 17,
                    fontWeight: 600,
                    color: TEXT.primary,
                    lineHeight: 1.3,
                    letterSpacing: '0.005em',
                  }}
                >
                  {note.title}
                </div>

                <div
                  data-testid="review-card-meta"
                  style={{
                    fontSize: 11,
                    color: TEXT.secondary,
                    marginTop: 5,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    fontFamily: FONT.ui,
                  }}
                >
                  {note.type} · Ready for workspace editing
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: previewText(note.content) ? TEXT.secondary : TEXT.muted,
                    marginTop: 8,
                    lineHeight: 1.55,
                    fontFamily: FONT.ui,
                  }}
                >
                  {previewText(note.content) ?? 'No content yet. Open this note to continue shaping it.'}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <button
                  onClick={() => void onOpenNoteId(note.id)}
                  data-testid="review-card-open-action"
                  style={{
                    background: BG.panel,
                    border: `1px solid ${BORDER.strong}`,
                    borderRadius: 8,
                    color: TEXT.primary,
                    fontFamily: FONT.ui,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '8px 12px',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Open in Workspace
                </button>
              </div>
            </div>
          ))}
```

Keep these parts unchanged:

- queue loading logic in `loadQueue()`
- `New Literature` and `New Permanent` header actions
- Review-specific color usage through existing `BG`, `TEXT`, `BORDER`, and `typeColor(note.type)` values
- `previewText()` truncation behavior

- [ ] **Step 4: Run the Review screen test file to verify it passes**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/screens/ReviewScreen.test.tsx
```

Expected: PASS with the updated row-shell assertions and the existing queue-behavior tests green.

- [ ] **Step 5: Commit the Review Library-style redesign**

```bash
git add apps/desktop/src/screens/ReviewScreen.tsx apps/desktop/src/screens/ReviewScreen.test.tsx
git commit -m "feat: align review screen with library layout"
```

## Task 2: Verify Review Behavior And Styling Boundaries

**Files:**
- Modify: `apps/desktop/src/screens/ReviewScreen.tsx`
- Modify: `apps/desktop/src/screens/ReviewScreen.test.tsx`

- [ ] **Step 1: Add one regression test for color/layout boundary**

Add a test to ensure the Review row keeps Review-specific type accents while using the Library-style shell.

```tsx
  it('keeps the review type accent while using the library-style shell', async () => {
    const db = createFakeDb()
    db.query.mockResolvedValue([
      makeNote({ id: 'lit-2', title: 'Literature card', type: 'literature' }),
    ])

    await act(async () => {
      root.render(
        <ReviewScreen db={db as any} onOpenNoteId={vi.fn(async () => {})} />
      )
      await flushEffects()
    })

    const accent = container.querySelector('[data-testid="review-card-accent"]') as HTMLElement | null
    expect(accent).toBeTruthy()
    expect(accent?.style.background).toBeTruthy()
  })
```

- [ ] **Step 2: Run the Review screen test file to verify it passes**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/screens/ReviewScreen.test.tsx
```

Expected: PASS

- [ ] **Step 3: Run the full desktop test suite**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run
```

Expected: PASS with all desktop tests green.

- [ ] **Step 4: Run workspace typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS with `packages/core` and `apps/desktop` both clean.

- [ ] **Step 5: Commit the verification-safe final state**

```bash
git add apps/desktop/src/screens/ReviewScreen.tsx apps/desktop/src/screens/ReviewScreen.test.tsx
git commit -m "test: lock review library-style layout behavior"
```

## Self-Review

- Spec coverage: The plan updates only `ReviewScreen` and its tests, which fully covers the spec's scope: Library-style row shell, preserved Review colors, integrated action area, and unchanged Review queue behavior.
- Placeholder scan: No `TODO`/`TBD` placeholders remain. Each task includes exact file paths, concrete test code, exact commands, and implementation snippets.
- Type consistency: The plan uses the existing `ReviewScreen` props (`db`, `onOpenNoteId`) and existing helpers (`previewText`, `typeColor`, theme tokens) without inventing new public APIs.
