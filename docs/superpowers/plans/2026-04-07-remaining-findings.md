# Remaining Findings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the remaining audited correctness, UX, and repo-hygiene findings after the foreign-key enforcement work.

**Architecture:** Fix the remaining issues in narrow tracks: core lifecycle invariants first, then desktop rendering and review-flow correctness, then draft/notification UX, then repo hygiene. Core changes use TDD with focused Vitest coverage; desktop changes follow the repo's current verification model of typecheck-driven validation because the desktop package does not yet have an automated test suite.

**Tech Stack:** TypeScript, React 18, Tauri v2, SQLite, Vitest, pnpm

**Important:** Do not create git commits unless the human explicitly asks for them.

---

## File Map

- Modify: `packages/core/src/notes.ts`
  Responsibility: reject literature-note writes that do not have a source.
- Modify: `packages/core/src/enforce.ts`
  Responsibility: make `validatePromotion()` match the documented state machine.
- Modify: `packages/core/src/links.ts`
  Responsibility: hide links whose endpoints are soft-deleted.
- Modify: `packages/core/tests/notes.test.ts`
  Responsibility: cover literature source invariants on create and update.
- Modify: `packages/core/tests/enforce.test.ts`
  Responsibility: cover invalid promotion transitions.
- Modify: `packages/core/tests/links.test.ts`
  Responsibility: cover deleted-note link filtering.
- Modify: `apps/desktop/src/screens/GraphScreen.tsx`
  Responsibility: derive rendered links from the visible note set.
- Modify: `apps/desktop/src/screens/ReviewScreen.tsx`
  Responsibility: make permanent-note saves atomic, support real direct-create drafts, keep bootstrap button state correct, and refresh queue-related state.
- Modify: `apps/desktop/src/App.tsx`
  Responsibility: own draft-mode routing and centralized inbox-count refresh.
- Modify: `packages/core/tsconfig.json`
  Responsibility: make repo-level typecheck pass.
- Modify: `.gitignore`
  Responsibility: ignore environment files and SQLite sidecars.
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
  Responsibility: restore a real CSP.
- Create: `README.md`
  Responsibility: document setup, tests, and desktop execution.

### Task 1: Enforce Literature Source Invariants And Promotion Rules

**Files:**
- Modify: `packages/core/src/notes.ts`
- Modify: `packages/core/src/enforce.ts`
- Modify: `packages/core/tests/notes.test.ts`
- Modify: `packages/core/tests/enforce.test.ts`

- [ ] **Step 1: Write the failing tests for source invariants and invalid transitions**

Add these tests to `packages/core/tests/notes.test.ts` and `packages/core/tests/enforce.test.ts`:

```ts
// packages/core/tests/notes.test.ts
async function insertSource(id = 'src-1') {
  await db.execute(
    'INSERT INTO sources (id, type, label, description, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, 'book', 'Thinking, Fast and Slow', null, Date.now()]
  )
  return id
}

it('rejects literature notes without a source on create', async () => {
  await expect(
    createNote(db, { type: 'literature', title: 'Missing source' })
  ).rejects.toThrow(/source/i)
})

it('rejects updating a note into literature without a source', async () => {
  const fleeting = await createNote(db, { type: 'fleeting', title: 'Draft' })
  await expect(
    updateNote(db, fleeting.id, { type: 'literature' })
  ).rejects.toThrow(/source/i)
})

it('allows updating a note into literature when a source is provided', async () => {
  const sourceId = await insertSource()
  const fleeting = await createNote(db, { type: 'fleeting', title: 'Draft' })
  await updateNote(db, fleeting.id, { type: 'literature', source_id: sourceId })
  const updated = await getNoteById(db, fleeting.id)
  expect(updated?.type).toBe('literature')
  expect(updated?.source_id).toBe(sourceId)
})

// packages/core/tests/enforce.test.ts
it('blocks literature → fleeting regression', () => {
  const r = validatePromotion('literature', 'fleeting')
  expect(r.ok).toBe(false)
})

it('blocks permanent → literature regression', () => {
  const r = validatePromotion('permanent', 'literature')
  expect(r.ok).toBe(false)
})

it('blocks no-op promotion attempts', () => {
  const r = validatePromotion('literature', 'literature')
  expect(r.ok).toBe(false)
})
```

- [ ] **Step 2: Run the focused tests to verify they fail for the expected reasons**

Run: `pnpm --filter @zettelkasten/core exec vitest run tests/notes.test.ts tests/enforce.test.ts`

Expected: FAIL because `createNote()` / `updateNote()` still allow literature without a source and `validatePromotion()` still returns `{ ok: true }` for unsupported transitions.

- [ ] **Step 3: Implement the minimal core fixes**

Update `packages/core/src/notes.ts` and `packages/core/src/enforce.ts` like this:

```ts
// packages/core/src/notes.ts
function assertLiteratureHasSource(type: NoteType, sourceId: string | null | undefined): void {
  if (type === 'literature' && !sourceId) {
    throw new Error('Literature notes require a source.')
  }
}

export async function createNote(db: Database, input: CreateNoteInput): Promise<Note> {
  assertLiteratureHasSource(input.type, input.source_id)

  const note: Note = {
    id: globalThis.crypto.randomUUID(),
    type: input.type,
    title: input.title,
    content: input.content ?? '',
    created_at: Date.now(),
    updated_at: Date.now(),
    source_id: input.source_id ?? null,
    own_words_confirmed: 0,
    deleted_at: null,
    processed_at: null,
  }
  await db.execute(
    `INSERT INTO notes (id, type, title, content, created_at, updated_at, source_id, own_words_confirmed, deleted_at, processed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      note.id,
      note.type,
      note.title,
      note.content,
      note.created_at,
      note.updated_at,
      note.source_id,
      note.own_words_confirmed,
      note.deleted_at,
      note.processed_at,
    ]
  )
  return note
}

export async function updateNote(
  db: Database,
  id: string,
  updates: Partial<Pick<Note, 'title' | 'content' | 'type' | 'source_id' | 'own_words_confirmed' | 'processed_at'>>
): Promise<void> {
  const entries = Object.entries(updates)
  if (entries.length === 0) return

  const current = await db.queryOne<Pick<Note, 'type' | 'source_id'>>(
    `SELECT type, source_id FROM notes WHERE id = ?`,
    [id]
  )
  if (!current) throw new Error('Note not found.')

  const nextType = updates.type ?? current.type
  const nextSourceId = updates.source_id !== undefined ? updates.source_id : current.source_id
  assertLiteratureHasSource(nextType, nextSourceId)

  const fields = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = [...entries.map(([, v]) => v), Date.now(), id]
  await db.execute(`UPDATE notes SET ${fields}, updated_at = ? WHERE id = ?`, values)
}

// packages/core/src/enforce.ts
export function validatePromotion(from: NoteType, to: NoteType): Result {
  if (from === to) {
    return { ok: false, reason: 'Promotion must move a note forward to the next stage.' }
  }
  if (from === 'fleeting' && to === 'literature') return { ok: true }
  if (from === 'literature' && to === 'permanent') return { ok: true }
  if (from === 'fleeting' && to === 'permanent') {
    return {
      ok: false,
      reason: 'Fleeting notes cannot skip to permanent. Process through literature first.',
    }
  }
  return { ok: false, reason: 'Notes can only move forward one stage at a time.' }
}
```

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `pnpm --filter @zettelkasten/core exec vitest run tests/notes.test.ts tests/enforce.test.ts`

Expected: PASS.

- [ ] **Step 5: If the human explicitly asks for a commit, create one**

```bash
git add packages/core/src/notes.ts packages/core/src/enforce.ts packages/core/tests/notes.test.ts packages/core/tests/enforce.test.ts
git commit -m "fix: enforce literature source and promotion rules"
```

### Task 2: Filter Deleted Notes Out Of Link Queries

**Files:**
- Modify: `packages/core/src/links.ts`
- Modify: `packages/core/tests/links.test.ts`

- [ ] **Step 1: Write the failing deleted-link tests**

Add these tests to `packages/core/tests/links.test.ts`:

```ts
import { createNote, softDeleteNote } from '../src/notes'

it('hides linked note ids when the linked note is soft-deleted', async () => {
  await addLink(db, idA, idB)
  await softDeleteNote(db, idB)
  await expect(getLinkedNoteIds(db, idA)).resolves.toEqual([])
})

it('omits deleted-note edges from getAllLinks', async () => {
  await addLink(db, idA, idB)
  await addLink(db, idA, idC)
  await softDeleteNote(db, idB)
  await expect(getAllLinks(db)).resolves.toEqual([
    expect.objectContaining({ from_note_id: idA, to_note_id: idC }),
  ])
})
```

- [ ] **Step 2: Run the focused link tests to verify they fail**

Run: `pnpm --filter @zettelkasten/core exec vitest run tests/links.test.ts`

Expected: FAIL because link queries still read raw `note_links` rows and ignore `deleted_at`.

- [ ] **Step 3: Implement filtered link queries**

Update `packages/core/src/links.ts`:

```ts
export async function getLinkedNoteIds(db: Database, noteId: string): Promise<string[]> {
  const rows = await db.query<{ to_note_id: string }>(
    `SELECT nl.to_note_id
     FROM note_links nl
     JOIN notes from_note ON from_note.id = nl.from_note_id AND from_note.deleted_at IS NULL
     JOIN notes to_note ON to_note.id = nl.to_note_id AND to_note.deleted_at IS NULL
     WHERE nl.from_note_id = ?`,
    [noteId]
  )
  return rows.map((r) => r.to_note_id)
}

export async function getAllLinks(db: Database): Promise<NoteLink[]> {
  return db.query<NoteLink>(
    `SELECT nl.*
     FROM note_links nl
     JOIN notes from_note ON from_note.id = nl.from_note_id AND from_note.deleted_at IS NULL
     JOIN notes to_note ON to_note.id = nl.to_note_id AND to_note.deleted_at IS NULL
     WHERE nl.from_note_id < nl.to_note_id
     ORDER BY nl.created_at ASC`
  )
}
```

- [ ] **Step 4: Run the focused link tests to verify they pass**

Run: `pnpm --filter @zettelkasten/core exec vitest run tests/links.test.ts`

Expected: PASS.

- [ ] **Step 5: If the human explicitly asks for a commit, create one**

```bash
git add packages/core/src/links.ts packages/core/tests/links.test.ts
git commit -m "fix: hide links for deleted notes"
```

### Task 3: Filter Rendered Graph Links To Visible Notes

**Files:**
- Modify: `apps/desktop/src/screens/GraphScreen.tsx`

- [ ] **Step 1: Implement visible-link derivation in the graph screen**

Update `apps/desktop/src/screens/GraphScreen.tsx` like this:

```ts
const filtered = query
  ? notes.filter((n) => n.title.toLowerCase().includes(query.toLowerCase()))
  : notes

const visibleNoteIds = new Set(filtered.map((note) => note.id))
const visibleLinks = links.filter(
  (link) => visibleNoteIds.has(link.from_note_id) && visibleNoteIds.has(link.to_note_id)
)

useEffect(() => {
  if (selected && !visibleNoteIds.has(selected.id)) {
    setSelected(null)
  }
}, [selected, visibleNoteIds])

<GraphCanvas notes={filtered} links={visibleLinks} onNodeClick={setSelected} />

<div style={{ fontSize: 10, color: TEXT.muted, marginBottom: 12, letterSpacing: '0.04em' }}>
  {visibleLinks.filter((l) => l.from_note_id === selected.id || l.to_note_id === selected.id).length} connections
</div>
```

- [ ] **Step 2: Run desktop typecheck to verify the screen compiles**

Run: `pnpm --filter @zettelkasten/desktop typecheck`

Expected: PASS.

- [ ] **Step 3: If the human explicitly asks for a commit, create one**

```bash
git add apps/desktop/src/screens/GraphScreen.tsx
git commit -m "fix: filter graph links to visible notes"
```

### Task 4: Make Permanent Saves Atomic And Fix Bootstrap Button State

**Files:**
- Modify: `apps/desktop/src/screens/ReviewScreen.tsx`

- [ ] **Step 1: Add the shared permanent-save helpers and local count state**

Update `apps/desktop/src/screens/ReviewScreen.tsx` with these sections:

```ts
const [totalPermanentNotes, setTotalPermanentNotes] = useState(0)

const loadQueue = useCallback(async () => {
  const fleeting = await getNotesByType(db, 'fleeting')
  const literature = await db.query<Note>(
    `SELECT * FROM notes WHERE type = 'literature' AND processed_at IS NULL AND deleted_at IS NULL ORDER BY created_at ASC`
  )
  const permanentCount = await countNotesByType(db, 'permanent')
  setQueue([...fleeting, ...literature])
  setTotalPermanentNotes(permanentCount)
}, [db])

async function runInTransaction<T>(work: () => Promise<T>): Promise<T> {
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

async function savePermanentNote(processedLiteratureId?: string) {
  return runInTransaction(async () => {
    const permanent = await createNote(db, { type: 'permanent', title, content })
    await updateNote(db, permanent.id, { own_words_confirmed: 1 })
    for (const id of linkedIds) {
      await addLink(db, permanent.id, id)
    }
    if (processedLiteratureId) {
      await updateNote(db, processedLiteratureId, { processed_at: Date.now() })
    }
    return permanent
  })
}

const canSavePermanent = ownWords && (linkedIds.length > 0 || totalPermanentNotes === 0)
```

- [ ] **Step 2: Switch the existing literature-to-permanent handler to the transaction helper**

Replace the body of `handleSavePermanent()` with:

```ts
async function handleSavePermanent() {
  if (!current) return
  const check = canSavePermanentNote(
    { own_words_confirmed: ownWords ? 1 : 0 },
    { linkedPermanentNoteIds: linkedIds, totalPermanentNotes }
  )
  if (!check.ok) {
    setBlockReason(check.reason)
    return
  }

  await savePermanentNote(current.id)
  setCurrent(null)
  setBlockReason(null)
  await loadQueue()
}
```

- [ ] **Step 3: Align the button style with the bootstrap rule**

Replace the permanent button branch with:

```tsx
<button onClick={handleSavePermanent} style={actionButtonStyle(canSavePermanent)}>
  Save as Permanent Note
</button>
```

- [ ] **Step 4: Run desktop typecheck to verify the review screen compiles**

Run: `pnpm --filter @zettelkasten/desktop typecheck`

Expected: PASS.

- [ ] **Step 5: If the human explicitly asks for a commit, create one**

```bash
git add apps/desktop/src/screens/ReviewScreen.tsx
git commit -m "fix: make permanent saves atomic"
```

### Task 5: Make Direct-Create Actions Real And Keep Inbox Badge Fresh

**Files:**
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/screens/ReviewScreen.tsx`

- [ ] **Step 1: Add review draft routing and centralized inbox refresh in `App.tsx`**

Update `apps/desktop/src/App.tsx` like this:

```ts
import { useCallback, useEffect, useState } from 'react'
import { getNotesByType, runMigrations } from '@zettelkasten/core'

type ReviewDraftType = 'literature' | 'permanent'

const [reviewDraftType, setReviewDraftType] = useState<ReviewDraftType | null>(null)

const refreshInboxCount = useCallback(async () => {
  if (!db) return
  const fleeting = await getNotesByType(db, 'fleeting')
  setInboxCount(fleeting.length)
}, [db])

useEffect(() => {
  if (db) void refreshInboxCount()
}, [db, refreshInboxCount])

const handleReview = (e: Event) => {
  const note = (e as CustomEvent<Note>).detail
  setReviewDraftType(null)
  setPendingReviewNote(note)
  setScreen('review')
}

const handleNewLiterature = () => {
  setPendingReviewNote(null)
  setReviewDraftType('literature')
  setScreen('review')
}

const handleNewPermanent = () => {
  setPendingReviewNote(null)
  setReviewDraftType('permanent')
  setScreen('review')
}

<ReviewScreen
  db={db}
  pendingNote={pendingReviewNote}
  draftType={reviewDraftType}
  onDraftConsumed={() => setReviewDraftType(null)}
  onNoteConsumed={() => setPendingReviewNote(null)}
  onInboxCountChange={refreshInboxCount}
/>
```

- [ ] **Step 2: Add local draft mode to `ReviewScreen.tsx`**

Add these props and state:

```ts
interface Props {
  db: Database
  pendingNote?: Note | null
  draftType?: 'literature' | 'permanent' | null
  onNoteConsumed?: () => void
  onDraftConsumed?: () => void
  onInboxCountChange?: () => Promise<void> | void
}

const [activeDraftType, setActiveDraftType] = useState<'literature' | 'permanent' | null>(null)

const editorType = activeDraftType ?? current?.type ?? null

const startDraft = useCallback((type: 'literature' | 'permanent') => {
  setActiveDraftType(type)
  setCurrent(null)
  setTitle('')
  setContent('')
  setSourceId(null)
  setOwnWords(false)
  setLinkedIds([])
  setBlockReason(null)
  setStep(type === 'literature' ? 'fleeting-to-literature' : 'literature-to-permanent')
}, [])

useEffect(() => {
  if (draftType) {
    startDraft(draftType)
    onDraftConsumed?.()
  }
}, [draftType, startDraft, onDraftConsumed])
```

- [ ] **Step 3: Add draft save handlers and queue refresh calls**

Add or replace these handlers in `ReviewScreen.tsx`:

```ts
async function handlePromoteToLiterature() {
  if (!current) return
  const check = canPromoteToLiterature({ ...current, source_id: sourceId })
  if (!check.ok) {
    setBlockReason(check.reason)
    return
  }
  if (!sourceId) return

  await updateNote(db, current.id, { type: 'literature', title, content, source_id: sourceId })
  const updated = { ...current, type: 'literature' as const, title, content, source_id: sourceId }
  setCurrent(updated)
  setStep('literature-to-permanent')
  setBlockReason(null)
  await loadQueue()
  await onInboxCountChange?.()
}

async function handleCreateLiteratureDraft() {
  if (!sourceId) {
    setBlockReason('Attach a source before creating a literature note.')
    return
  }

  const created = await createNote(db, { type: 'literature', title, content, source_id: sourceId })
  setActiveDraftType(null)
  selectNote(created)
  await loadQueue()
}

async function handleCreatePermanentDraft() {
  const check = canSavePermanentNote(
    { own_words_confirmed: ownWords ? 1 : 0 },
    { linkedPermanentNoteIds: linkedIds, totalPermanentNotes }
  )
  if (!check.ok) {
    setBlockReason(check.reason)
    return
  }

  await savePermanentNote()
  setActiveDraftType(null)
  setCurrent(null)
  setBlockReason(null)
  await loadQueue()
}
```

- [ ] **Step 4: Update the editor rendering to support drafts**

Apply these rendering changes in `ReviewScreen.tsx`:

```tsx
if (queue.length === 0 && !current && !activeDraftType) {
  return <div>Queue is empty. Capture some fleeting notes first.</div>
}

// Update the existing queue-list guard from:
// if (!current) {
// to:
if (!current && !activeDraftType) {
  return (
    <div style={{ height: '100%', background: BG.base, overflowY: 'auto' }}>
      <div style={{ padding: '24px 28px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: TEXT.muted, textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 20 }}>
          Review Queue — {queue.length}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {queue.map((note) => (
            <button key={note.id} onClick={() => selectNote(note)} className="queue-item" style={{ background: BG.card, border: `1px solid ${BORDER.base}`, borderLeft: `3px solid ${typeColor(note.type)}`, borderRadius: 5, padding: '11px 14px 11px 12px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: FONT.serif, fontSize: 15, color: TEXT.primary, flex: 1, lineHeight: 1.35, letterSpacing: '0.005em' }}>
                {note.title}
              </span>
              <span style={{ fontSize: 9, fontWeight: 600, color: typeColor(note.type), textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>
                {note.type}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

{STEP_ORDER.map((s, i) => {
  const active = editorType === s
  const isDone = editorType ? STEP_ORDER.indexOf(editorType) > i : false
  return (
    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {i > 0 && (
        <div style={{ width: 20, height: 1, background: isDone ? TEXT.dim : BORDER.base, margin: '0 6px' }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: active ? stepTypeColors[s] : isDone ? TEXT.dim : BORDER.hi }} />
        <span style={{ fontSize: 10, color: active ? stepTypeColors[s] : TEXT.muted, fontWeight: active ? 600 : 400, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {s}
        </span>
      </div>
    </div>
  )
})}

<button
  onClick={() => {
    setCurrent(null)
    setActiveDraftType(null)
  }}
  style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: TEXT.muted, cursor: 'pointer', fontSize: 11, letterSpacing: '0.03em' }}
>
  ← queue
</button>

{step === 'fleeting-to-literature' ? (
  <button
    onClick={activeDraftType === 'literature' ? handleCreateLiteratureDraft : handlePromoteToLiterature}
    style={actionButtonStyle(!!sourceId)}
  >
    {activeDraftType === 'literature' ? 'Create Literature Note' : 'Promote to Literature'}
  </button>
) : (
  <button
    onClick={activeDraftType === 'permanent' ? handleCreatePermanentDraft : handleSavePermanent}
    style={actionButtonStyle(canSavePermanent)}
  >
    {activeDraftType === 'permanent' ? 'Create Permanent Note' : 'Save as Permanent Note'}
  </button>
)}
```

- [ ] **Step 5: Run desktop typecheck to verify the draft flow compiles**

Run: `pnpm --filter @zettelkasten/desktop typecheck`

Expected: PASS.

- [ ] **Step 6: If the human explicitly asks for a commit, create one**

```bash
git add apps/desktop/src/App.tsx apps/desktop/src/screens/ReviewScreen.tsx
git commit -m "fix: support review drafts and refresh inbox count"
```

### Task 6: Restore Repo Hygiene And Verification

**Files:**
- Modify: `packages/core/tsconfig.json`
- Modify: `.gitignore`
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Create: `README.md`

- [ ] **Step 1: Fix the core package typecheck config**

Update `packages/core/tsconfig.json` to make `include` and `rootDir` consistent:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 2: Expand `.gitignore` for secrets and SQLite sidecars**

Update `.gitignore` to:

```gitignore
node_modules/
dist/
.DS_Store
*.db
*.db-shm
*.db-wal
.env
.env.*
!.env.example
target/
.superpowers/
.worktrees/
```

- [ ] **Step 3: Restore a real Tauri CSP**

Update the `security` block in `apps/desktop/src-tauri/tauri.conf.json` to:

```json
"security": {
  "csp": "default-src 'self'; connect-src 'self' ipc: http://ipc.localhost http://localhost:1420 ws://localhost:1420 https://fonts.googleapis.com https://fonts.gstatic.com; img-src 'self' asset: http://asset.localhost data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; script-src 'self' 'unsafe-eval'"
}
```

- [ ] **Step 4: Add the top-level README**

Create `README.md` with:

```md
# Zettelkasten App

Desktop-first Zettelkasten note-taking app built as a pnpm monorepo.

## Workspace Layout

- `packages/core` — pure TypeScript domain logic, schema, and tests
- `apps/desktop` — Tauri v2 + React desktop application

## Requirements

- Node.js 20+
- pnpm 9+
- Rust toolchain for Tauri desktop builds

## Install

```bash
pnpm install
```

## Verification

```bash
pnpm test
pnpm typecheck
pnpm --filter @zettelkasten/desktop typecheck
```

## Run The Desktop App

```bash
pnpm --filter @zettelkasten/desktop dev
```

## Build The Desktop App

```bash
pnpm --filter @zettelkasten/desktop build
```

## Notes

- SQLite foreign keys are enabled per connection in both tests and the desktop app.
- Core tests run in `packages/core`; the desktop app currently relies on typecheck rather than a dedicated UI test suite.
```

- [ ] **Step 5: Run the repo verification commands**

Run:
- `pnpm typecheck`
- `pnpm test`
- `pnpm --filter @zettelkasten/desktop typecheck`

Expected: all three pass.

- [ ] **Step 6: If the human explicitly asks for a commit, create one**

```bash
git add packages/core/tsconfig.json .gitignore apps/desktop/src-tauri/tauri.conf.json README.md
git commit -m "chore: restore repo verification and docs"
```

### Task 7: Final Verification Sweep

**Files:**
- Modify: none

- [ ] **Step 1: Run the full core and desktop verification commands**

Run:
- `pnpm test`
- `pnpm typecheck`
- `pnpm --filter @zettelkasten/desktop typecheck`

Expected: all commands pass.

- [ ] **Step 2: Inspect the final worktree state**

Run: `git status --short`

Expected: only the intended remaining-findings changes are present.

- [ ] **Step 3: If the human explicitly asks for a commit, create one**

```bash
git status --short
```

Expected: use the output to confirm exactly what would be committed.

---

## Self-Review

- Spec coverage: the plan covers deleted-link filtering, promotion validation, literature source invariants, graph filtering, atomic permanent saves, stale inbox badge refresh, real direct-create behavior, bootstrap button state, root typecheck, `.gitignore`, CSP, and README creation.
- Placeholder scan: no `TODO`, `TBD`, or vague “handle this later” steps remain.
- Type consistency: the plan uses existing names and files from the current codebase (`validatePromotion`, `createNote`, `updateNote`, `GraphScreen`, `ReviewScreen`, `App.tsx`).
