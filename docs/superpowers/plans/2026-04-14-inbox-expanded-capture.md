# Inbox Expanded Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Inbox capture both fleeting-note title and body directly, with low-friction keyboard handling.

**Architecture:** Keep the change local to `InboxScreen` and its tests. Expand the capture composer from a single title input into a small two-field card, preserve the current fleeting-note creation path, and add keyboard behavior that keeps quick capture fast without introducing new screens or workflow branches.

**Tech Stack:** React 18, TypeScript, Vitest, inline styles with shared theme tokens

---

## File Map

- Modify: `apps/desktop/src/screens/InboxScreen.tsx`
  Expand local capture state to title + body, update createNote payload, and add the keyboard flow.
- Modify: `apps/desktop/src/screens/InboxScreen.test.tsx`
  Add focused tests for title-only capture, title+body capture, `Ctrl/Cmd+Enter` save, and empty capture no-op behavior.

## Task 1: Expand Inbox Capture To Title + Body

**Files:**
- Modify: `apps/desktop/src/screens/InboxScreen.tsx`
- Modify: `apps/desktop/src/screens/InboxScreen.test.tsx`

- [ ] **Step 1: Write the failing capture tests**

Update `apps/desktop/src/screens/InboxScreen.test.tsx` to add all four missing capture tests before touching production code.

Add tests like:

```tsx
import { createNote, getNotesByType } from '@zettelkasten/core'
```

```tsx
  it('captures a title-only fleeting note from the Inbox composer', async () => {
    await renderScreen()

    const titleInput = container.querySelector('input') as HTMLInputElement

    await act(async () => {
      titleInput.value = 'Quick thought'
      titleInput.dispatchEvent(new Event('input', { bubbles: true }))
      titleInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await flushEffects()
    })

    expect(createNote).toHaveBeenCalledWith(expect.anything(), {
      type: 'fleeting',
      title: 'Quick thought',
    })
  })

  it('captures a fleeting note with both title and body', async () => {
    await renderScreen()

    const titleInput = container.querySelector('input') as HTMLInputElement
    const bodyInput = container.querySelector('textarea') as HTMLTextAreaElement

    await act(async () => {
      titleInput.value = 'Expanded thought'
      titleInput.dispatchEvent(new Event('input', { bubbles: true }))
      bodyInput.value = 'Body text for the fleeting note.'
      bodyInput.dispatchEvent(new Event('input', { bubbles: true }))
      bodyInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }))
      await flushEffects()
    })

    expect(createNote).toHaveBeenCalledWith(expect.anything(), {
      type: 'fleeting',
      title: 'Expanded thought',
      content: 'Body text for the fleeting note.',
    })
  })

  it('does nothing when the composer is empty', async () => {
    await renderScreen()

    const titleInput = container.querySelector('input') as HTMLInputElement

    await act(async () => {
      titleInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await flushEffects()
    })

    expect(createNote).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Run the Inbox screen tests to verify they fail**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/screens/InboxScreen.test.tsx
```

Expected: FAIL because the current Inbox composer only stores title, has no body textarea, and does not implement the expanded keyboard behavior.

- [ ] **Step 3: Implement the expanded Inbox composer**

Update `apps/desktop/src/screens/InboxScreen.tsx`.

1. Expand state:

```tsx
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const bodyRef = useRef<HTMLTextAreaElement>(null)
```

2. Update save logic:

```tsx
  async function handleCapture() {
    const trimmedTitle = title.trim()
    const trimmedBody = body.trim()
    if (!trimmedTitle) return

    await createNote(db, {
      type: 'fleeting',
      title: trimmedTitle,
      ...(trimmedBody ? { content: trimmedBody } : {}),
    })

    setTitle('')
    setBody('')
    await loadNotes()
  }
```

3. Update keyboard behavior:

```tsx
  function handleTitleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()

    if (body.trim()) {
      void handleCapture()
      return
    }

    bodyRef.current?.focus()
  }

  function handleBodyKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      void handleCapture()
    }
  }
```

4. Add the body field below the title input while keeping the card visually quiet:

```tsx
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleBodyKeyDown}
            placeholder="Add a few lines if needed…"
            rows={3}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              borderTop: `1px solid ${BORDER.faint}`,
              color: TEXT.secondary,
              fontFamily: FONT.ui,
              fontSize: 13,
              lineHeight: 1.6,
              padding: '12px 0 0',
              outline: 'none',
              resize: 'none',
            }}
          />
```

5. Update footer hint text to reflect the new behavior:

```tsx
            <span style={{ fontSize: 11, color: TEXT.faint }}>
              Enter continues · Ctrl/Cmd+Enter captures
            </span>
```

Keep these parts unchanged:

- the Inbox list below the composer
- existing note opening and review event dispatching
- the `+ New` dropdown for direct literature/permanent creation

- [ ] **Step 4: Run the Inbox screen tests to verify they pass**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/screens/InboxScreen.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit the expanded Inbox capture flow**

```bash
git add apps/desktop/src/screens/InboxScreen.tsx apps/desktop/src/screens/InboxScreen.test.tsx
git commit -m "feat: expand inbox fleeting capture"
```

## Task 2: Full Verification

**Files:**
- Modify: `apps/desktop/src/screens/InboxScreen.tsx`
- Modify: `apps/desktop/src/screens/InboxScreen.test.tsx`

- [ ] **Step 1: Run focused Inbox tests**

Run:

```bash
pnpm --filter @zettelkasten/desktop exec vitest run src/screens/InboxScreen.test.tsx
```

Expected: PASS

- [ ] **Step 2: Run the full workspace test suite**

Run:

```bash
pnpm test
```

Expected: PASS with all workspace tests green.

- [ ] **Step 3: Run workspace typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 4: Manually verify the Inbox flow**

Run:

```bash
pnpm --filter @zettelkasten/desktop dev
```

Verify:

- title-only fleeting capture still works quickly
- title + body capture saves both fields in one step
- pressing `Enter` in the title moves focus into the body when continuing to write
- pressing `Ctrl/Cmd+Enter` in the body captures the note
- empty capture still does nothing

- [ ] **Step 5: Commit the verification-safe final state**

```bash
git add apps/desktop/src/screens/InboxScreen.tsx apps/desktop/src/screens/InboxScreen.test.tsx
git commit -m "test: lock inbox expanded capture behavior"
```

## Self-Review

- Spec coverage: Task 1 covers the two-field Inbox composer, expanded save payload, and keyboard behavior. Task 2 covers verification.
- Placeholder scan: No `TODO`/`TBD` placeholders remain. Each task includes exact files, code, and commands.
- Type consistency: The plan stays local to `InboxScreen` and uses the existing `createNote(db, { type: 'fleeting', ... })` shape without changing note models or workflow boundaries.
