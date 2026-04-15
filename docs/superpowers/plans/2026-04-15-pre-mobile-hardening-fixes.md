# Pre-Mobile Hardening Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the confirmed pre-mobile hardening issues across shared core logic, desktop workflow correctness, and Tauri build/runtime wiring before starting mobile work.

**Architecture:** Keep the current product behavior where direct permanent-note creation is supported, but make the shared lifecycle rules explicit and enforce them consistently. Fix persistence correctness in the desktop workflow, remove title-based identity ambiguity by enforcing unique active note titles, and wire the desktop build/runtime so verification works from a clean checkout.

**Tech Stack:** TypeScript, React 18, Tauri v2, Vitest, pnpm, SQLite via `@tauri-apps/plugin-sql`

---

## File Structure

- Modify: `packages/core/src/notes.ts`
  - Encode the supported lifecycle policy directly in shared mutation APIs
- Modify: `packages/core/tests/notes.test.ts`
  - Lock lifecycle semantics into the public core API
- Modify: `packages/core/tests/helpers/db.ts`
  - Add helpers for legacy-schema migration coverage if needed
- Create/Modify: `packages/core/tests/schema.test.ts`
  - Add migration rerun and legacy upgrade regression coverage
- Modify: `apps/desktop/src/db.ts`
  - Expose real transaction support for multi-write flows
- Modify: `apps/desktop/src/lib/note-workflow.ts`
  - Use real transactions, enforce unique-title policy, skip deleted notes during title propagation
- Modify: `apps/desktop/src/lib/note-workflow.test.ts`
  - Add regression tests for atomicity, stale-save prevention, unique-title behavior, and trash-safe propagation
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`
  - Flush pending literature edits before promotion and reject ambiguous title edits early
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.test.tsx`
  - Add debounce-window save-as-permanent regression coverage
- Modify: `apps/desktop/src/components/MarkdownEditor.tsx`
  - Keep picker placement updated on scroll/resize while open
- Modify: `apps/desktop/src/components/MarkdownEditor.test.tsx`
  - Cover picker position refresh behavior at the component level
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
  - Add `beforeBuildCommand` and replace the `.app` bundle identifier suffix
- Modify: `apps/desktop/package.json`
  - Add the frontend build script used by `beforeBuildCommand`

---

### Task 1: Lock Shared Lifecycle Policy Into Core APIs

**Files:**
- Modify: `packages/core/src/notes.ts`
- Modify: `packages/core/tests/notes.test.ts`

- [ ] **Step 1: Write the failing lifecycle tests**

Add these tests to `packages/core/tests/notes.test.ts`:

```ts
it('allows creating a permanent note directly', async () => {
  const note = await createNote(db, { type: 'permanent', title: 'Evergreen' })
  expect(note.type).toBe('permanent')
})

it('rejects skipping from fleeting straight to permanent on update', async () => {
  const fleeting = await createNote(db, { type: 'fleeting', title: 'Draft' })
  await expect(
    updateNote(db, fleeting.id, { type: 'permanent' })
  ).rejects.toThrow(/lifecycle/i)
})

it('rejects regressing from literature back to fleeting', async () => {
  const sourceId = await insertSource()
  const literature = await createNote(db, { type: 'literature', title: 'Lit', source_id: sourceId })
  await expect(
    updateNote(db, literature.id, { type: 'fleeting' })
  ).rejects.toThrow(/lifecycle/i)
})

it('rejects regressing from permanent to literature', async () => {
  const permanent = await createNote(db, { type: 'permanent', title: 'Permanent' })
  const sourceId = await insertSource()
  await expect(
    updateNote(db, permanent.id, { type: 'literature', source_id: sourceId })
  ).rejects.toThrow(/lifecycle/i)
})
```

- [ ] **Step 2: Run the focused core test file and verify failure**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm --filter @zettelkasten/core exec vitest run tests/notes.test.ts
```

Expected: the new lifecycle tests fail because `updateNote()` currently permits these transitions.

- [ ] **Step 3: Implement explicit transition checks in `notes.ts`**

Add a transition helper near the top of `packages/core/src/notes.ts`:

```ts
function assertValidTypeTransition(currentType: NoteType, nextType: NoteType): void {
  if (currentType === nextType) return

  const allowed: Record<NoteType, NoteType[]> = {
    fleeting: ['literature'],
    literature: [],
    permanent: [],
  }

  if (!allowed[currentType].includes(nextType)) {
    throw new Error(`Invalid lifecycle transition: ${currentType} -> ${nextType}`)
  }
}
```

Then update `updateNote()` so that after computing `nextType`, it validates transitions before writing:

```ts
  if (updates.type !== undefined) {
    assertValidTypeTransition(current.type, nextType)
  }
```

This keeps direct permanent creation via `createNote()` supported while preventing skip/regressive type mutations through `updateNote()`.

- [ ] **Step 4: Re-run the focused test file and verify success**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm --filter @zettelkasten/core exec vitest run tests/notes.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/notes.ts packages/core/tests/notes.test.ts
git commit -m "Enforce supported note lifecycle transitions in core"
```

---

### Task 2: Add Schema Migration Regression Coverage

**Files:**
- Create: `packages/core/tests/schema.test.ts`

- [ ] **Step 1: Write the migration regression tests**

Create `packages/core/tests/schema.test.ts` with:

```ts
import { describe, expect, it } from 'vitest'
import initSqlJs from 'sql.js'
import { runMigrations } from '../src/schema'
import type { Database } from '../src/types'

async function createRawDb(sql?: string): Promise<Database> {
  const SQL = await initSqlJs({})
  const raw = new SQL.Database()
  if (sql) raw.run(sql)
  return {
    async execute(statement: string, params: unknown[] = []) {
      raw.run(statement, params as never[])
    },
    async query<T>(statement: string, params: unknown[] = []) {
      const result = raw.exec(statement, params as never[])
      if (result.length === 0) return []
      const [{ columns, values }] = result
      return values.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])) as T)
    },
    async queryOne<T>(statement: string, params: unknown[] = []) {
      const rows = await this.query<T>(statement, params)
      return rows[0] ?? null
    },
  }
}

describe('runMigrations', () => {
  it('is idempotent on an already migrated schema', async () => {
    const db = await createRawDb()
    await runMigrations(db)
    await expect(runMigrations(db)).resolves.toBeUndefined()
  })

  it('upgrades a legacy notes table without processed_at', async () => {
    const db = await createRawDb(`
      CREATE TABLE notes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        source_id TEXT,
        own_words_confirmed INTEGER NOT NULL DEFAULT 0,
        deleted_at INTEGER
      );
      CREATE TABLE sources (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE note_links (
        from_note_id TEXT NOT NULL,
        to_note_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (from_note_id, to_note_id)
      );
    `)

    await runMigrations(db)

    const row = await db.queryOne<{ processed_at: number | null }>(
      'SELECT processed_at FROM notes LIMIT 1'
    )
    expect(row ?? null).toBeNull()
  })
})
```

- [ ] **Step 2: Run the schema tests and verify they pass**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm --filter @zettelkasten/core exec vitest run tests/schema.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/tests/schema.test.ts
git commit -m "Add regression coverage for core schema migrations"
```

---

### Task 3: Restore Atomic Multi-Write Safety in Desktop Workflows

**Files:**
- Modify: `apps/desktop/src/db.ts`
- Modify: `apps/desktop/src/lib/note-workflow.ts`
- Modify: `apps/desktop/src/lib/note-workflow.test.ts`

- [ ] **Step 1: Write a failing atomicity regression test**

Add a test to `apps/desktop/src/lib/note-workflow.test.ts` that injects a transaction-capable fake DB and asserts rollback on a mid-sequence failure:

```ts
it('rolls back multi-write permanent saves when link creation fails mid-transaction', async () => {
  const db = createTestWorkflowDb({ failOnAddLinkCall: 1 })
  const literature = await createLiteratureNote(db)

  await expect(
    saveLiteratureAsPermanent(db, literature, 'Perm', 'Body', ['linked-1'], true)
  ).rejects.toThrow(/link/i)

  expect(await db.query('SELECT * FROM notes WHERE type = ?', ['permanent'])).toEqual([])
  expect((await getNoteById(db, literature.id))?.processed_at).toBeNull()
})
```

- [ ] **Step 2: Implement a transaction-capable desktop adapter**

In `apps/desktop/src/db.ts`, extend the returned adapter shape with a `transaction` method:

```ts
export interface DesktopDatabase extends CoreDatabase {
  transaction<T>(work: (db: CoreDatabase) => Promise<T>): Promise<T>
}
```

Implement it using explicit SQL transaction control on the same Tauri connection:

```ts
    async transaction<T>(work) {
      await _db!.execute('BEGIN IMMEDIATE')
      try {
        const result = await work(this)
        await _db!.execute('COMMIT')
        return result
      } catch (error) {
        await _db!.execute('ROLLBACK')
        throw error
      }
    },
```

- [ ] **Step 3: Make `runInTransaction()` require and use the transaction hook**

Update `apps/desktop/src/lib/note-workflow.ts`:

```ts
type TransactionCapableDatabase = Database & {
  transaction<T>(work: (db: Database) => Promise<T>): Promise<T>
}

export async function runInTransaction<T>(db: Database, work: () => Promise<T>): Promise<T> {
  const txDb = db as TransactionCapableDatabase
  if (!txDb.transaction) {
    throw new Error('Database adapter must provide transaction() for multi-write workflows.')
  }
  return txDb.transaction(() => work())
}
```

- [ ] **Step 4: Re-run the workflow tests and verify success**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm --filter @zettelkasten/desktop exec vitest run src/lib/note-workflow.test.ts
```

Expected: PASS, including the new rollback regression.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/db.ts apps/desktop/src/lib/note-workflow.ts apps/desktop/src/lib/note-workflow.test.ts
git commit -m "Restore atomic multi-write safety in desktop note workflows"
```

---

### Task 4: Flush Pending Literature Edits Before Permanent Promotion

**Files:**
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.test.tsx`

- [ ] **Step 1: Add a failing debounce-window regression test**

Add a test that edits a literature note and clicks `Save As Permanent` before the 450ms autosave fires. Assert that the preserved literature note gets the latest title/content/source state before `processed_at` is set.

- [ ] **Step 2: Add a flush helper in `NoteWorkspace.tsx`**

Add a helper near the autosave effect:

```ts
async function flushLoadedNoteDraft(note: Note) {
  await savePersistedNote(db, note, {
    title: draft.title,
    content: draft.content,
    ...(note.type !== 'permanent' ? { source_id: draft.sourceId } : {}),
  })
}
```

Then, in `handleSaveAsPermanent()` before `saveLiteratureAsPermanent(...)`, call `await flushLoadedNoteDraft(loadedNote)` and update `loadedNote` state to the flushed draft snapshot before promoting.

- [ ] **Step 3: Re-run the workspace tests**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm --filter @zettelkasten/desktop exec vitest run src/components/workspace/NoteWorkspace.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/workspace/NoteWorkspace.tsx apps/desktop/src/components/workspace/NoteWorkspace.test.tsx
git commit -m "Flush literature edits before permanent promotion"
```

---

### Task 5: Enforce Unique Active Titles and Stop Trash Mutation

**Files:**
- Modify: `apps/desktop/src/lib/note-workflow.ts`
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`
- Modify: `apps/desktop/src/lib/note-workflow.test.ts`
- Modify: `apps/desktop/src/components/workspace/NoteWorkspace.test.tsx`

- [ ] **Step 1: Add failing tests for duplicate-title rejection and deleted-note exclusion**

Add tests that assert:

- creating/opening/editing a note to a duplicate active title is rejected with a user-visible error
- `syncTitleBasedWikilinks()` ignores `deleted_at IS NOT NULL` notes

- [ ] **Step 2: Reject duplicate active titles in the desktop workflow**

In `apps/desktop/src/lib/note-workflow.ts`, add:

```ts
const DUPLICATE_ACTIVE_TITLE_ERROR = 'Active note titles must be unique.'

async function assertUniqueActiveTitle(db: Database, noteId: string | null, title: string): Promise<void> {
  const trimmed = title.trim()
  if (!trimmed) return

  const match = noteId
    ? await db.queryOne<{ id: string }>('SELECT id FROM notes WHERE title = ? AND deleted_at IS NULL AND id != ? LIMIT 1', [trimmed, noteId])
    : await db.queryOne<{ id: string }>('SELECT id FROM notes WHERE title = ? AND deleted_at IS NULL LIMIT 1', [trimmed])

  if (match) throw new Error(DUPLICATE_ACTIVE_TITLE_ERROR)
}
```

Call it from `savePersistedNote()`, `createPermanentDraft()`, and the draft-create paths in `NoteWorkspace.tsx` before writing notes.

- [ ] **Step 3: Skip deleted notes during title propagation**

Change the propagation query in `syncTitleBasedWikilinks()` from:

```ts
'SELECT id, content FROM notes'
```

to:

```ts
'SELECT id, content FROM notes WHERE deleted_at IS NULL'
```

Update the existing trash-related regression test to assert the deleted note stays unchanged.

- [ ] **Step 4: Re-run the focused desktop tests**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm --filter @zettelkasten/desktop exec vitest run src/lib/note-workflow.test.ts src/components/workspace/NoteWorkspace.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/lib/note-workflow.ts apps/desktop/src/components/workspace/NoteWorkspace.tsx apps/desktop/src/lib/note-workflow.test.ts apps/desktop/src/components/workspace/NoteWorkspace.test.tsx
git commit -m "Enforce unique active note titles and protect trash contents"
```

---

### Task 6: Fix Desktop Build Wiring and Bundle Metadata

**Files:**
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/src-tauri/tauri.conf.json`

- [ ] **Step 1: Add the frontend build script**

Update `apps/desktop/package.json` scripts:

```json
"scripts": {
  "dev": "tauri dev",
  "build": "tauri build",
  "build:web": "vite build",
  "preview": "vite preview",
  "typecheck": "tsc --noEmit",
  "test": "vitest run"
}
```

- [ ] **Step 2: Wire `beforeBuildCommand` and fix the bundle identifier**

Update `apps/desktop/src-tauri/tauri.conf.json`:

```json
"identifier": "com.zettelkasten.desktop",
"build": {
  "beforeDevCommand": "pnpm exec vite",
  "beforeBuildCommand": "pnpm run build:web",
  "frontendDist": "../dist",
  "devUrl": "http://localhost:1420"
}
```

- [ ] **Step 3: Verify desktop build works from a clean command path**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm --filter @zettelkasten/desktop build
```

Expected: Tauri no longer fails immediately due to missing `frontendDist`, and the `.app` identifier warning is gone.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/package.json apps/desktop/src-tauri/tauri.conf.json
git commit -m "Wire desktop frontend builds into Tauri packaging"
```

---

### Task 7: Keep the Wikilink Picker Anchored Under Scroll and Resize

**Files:**
- Modify: `apps/desktop/src/components/MarkdownEditor.tsx`
- Modify: `apps/desktop/src/components/MarkdownEditor.test.tsx`

- [ ] **Step 1: Add a failing picker-position refresh test**

Add a test that opens the picker, simulates a `resize` event, and asserts the picker position refresh callback runs instead of leaving stale coordinates.

- [ ] **Step 2: Extract and reuse picker-position calculation**

In `MarkdownEditor.tsx`, pull the caret coordinate logic into a helper:

```ts
function updatePickerPosition(view: EditorView, query: ActiveWikilinkQuery | null) {
  if (!query) {
    setPickerPos(null)
    return
  }
  const coords = view.coordsAtPos(query.from)
  if (coords) {
    setPickerPos({ left: coords.left, top: coords.bottom })
  }
}
```

Use it from the update listener, and add a `useEffect` that listens for `resize` and re-runs the positioning logic while a picker is open.

- [ ] **Step 3: Re-run the MarkdownEditor tests**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm --filter @zettelkasten/desktop exec vitest run src/components/MarkdownEditor.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/MarkdownEditor.tsx apps/desktop/src/components/MarkdownEditor.test.tsx
git commit -m "Refresh wikilink picker position on resize"
```

---

### Task 8: Final Verification and Push

- [ ] **Step 1: Run full verification**

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm test && pnpm typecheck
```

Expected: all tests and typecheck pass.

- [ ] **Step 2: Push the branch**

```bash
git push
```
