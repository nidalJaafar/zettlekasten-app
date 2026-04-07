# Foreign Key Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SQLite actually enforce the schema's foreign-key relationships in tests and the desktop app, and add regression coverage that proves invalid references are rejected.

**Architecture:** Keep the change at the database boundary instead of adding ad hoc validation to note and link helpers. Enable `PRAGMA foreign_keys = ON` in each concrete connection implementation, then update tests so they only create valid referenced rows and add regression tests for invalid inserts.

**Tech Stack:** TypeScript, Vitest, sql.js, Tauri SQL plugin, SQLite

---

## File Map

- Modify: `packages/core/tests/helpers/db.ts`
  Responsibility: initialize the sql.js test connection and enable SQLite FK enforcement before migrations run.
- Modify: `packages/core/tests/notes.test.ts`
  Responsibility: use valid source fixtures for literature-note tests and add a regression test for invalid `source_id`.
- Modify: `packages/core/tests/links.test.ts`
  Responsibility: add a regression test proving links to missing notes are rejected once FK enforcement is enabled.
- Modify: `apps/desktop/src/db.ts`
  Responsibility: enable SQLite FK enforcement for the Tauri desktop connection before the app uses the database.

### Task 1: Enforce Foreign Keys In The Test Database

**Files:**
- Modify: `packages/core/tests/helpers/db.ts`
- Test: `packages/core/tests/notes.test.ts`

- [ ] **Step 1: Write the failing regression test for invalid note source references**

Add this test and local fixture helper to `packages/core/tests/notes.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  createNote,
  getNoteById,
  getNotesByType,
  updateNote,
  softDeleteNote,
  countNotesByType,
} from '../src/notes'
import { createMigratedDb } from './helpers/db'
import type { Database } from '../src/types'

let db: Database

async function insertSource(id = 'src-1') {
  await db.execute(
    `INSERT INTO sources (id, type, label, description, created_at) VALUES (?, ?, ?, ?, ?)`,
    [id, 'book', 'Thinking, Fast and Slow', null, Date.now()]
  )
  return id
}

beforeEach(async () => {
  db = await createMigratedDb()
})

describe('createNote', () => {
  it('inserts a literature note with a source', async () => {
    const sourceId = await insertSource()
    const note = await createNote(db, {
      type: 'literature',
      title: 'Notes on Kahneman',
      source_id: sourceId,
    })
    expect(note.source_id).toBe(sourceId)
  })

  it('rejects a literature note whose source does not exist', async () => {
    await expect(
      createNote(db, {
        type: 'literature',
        title: 'Broken reference',
        source_id: 'missing-source',
      })
    ).rejects.toThrow(/foreign key/i)
  })
})
```

- [ ] **Step 2: Run the focused test to verify it fails for the right reason**

Run: `pnpm --filter @zettelkasten/core exec vitest run tests/notes.test.ts`

Expected: the new regression test fails because the insert succeeds unexpectedly, proving FK enforcement is currently off.

- [ ] **Step 3: Enable foreign-key enforcement in the sql.js test connection**

Update `packages/core/tests/helpers/db.ts`:

```ts
import initSqlJs from 'sql.js'
import { runMigrations } from '../../src/schema'
import type { Database } from '../../src/types'

function rowsToObjects<T>(result: ReturnType<Awaited<ReturnType<typeof initSqlJs>>['Database']['prototype']['exec']>): T[] {
  if (result.length === 0) return []
  const { columns, values } = result[0]
  return values.map((row) => {
    const obj: Record<string, unknown> = {}
    columns.forEach((col, i) => { obj[col] = row[i] })
    return obj as T
  })
}

export async function createTestDb(): Promise<Database> {
  const SQL = await initSqlJs()
  const sqlite = new SQL.Database()
  sqlite.exec('PRAGMA foreign_keys = ON')

  return {
    async execute(sql: string, params: unknown[] = []) {
      const stmt = sqlite.prepare(sql)
      stmt.run(params)
      stmt.free()
    },
    async query<T>(sql: string, params: unknown[] = []) {
      const result = sqlite.exec(sql, params)
      return rowsToObjects<T>(result)
    },
    async queryOne<T>(sql: string, params: unknown[] = []) {
      const result = sqlite.exec(sql, params)
      const rows = rowsToObjects<T>(result)
      return rows[0] ?? null
    },
  }
}
```

- [ ] **Step 4: Run the focused notes test to verify it passes**

Run: `pnpm --filter @zettelkasten/core exec vitest run tests/notes.test.ts`

Expected: PASS, including the new foreign-key rejection test.

- [ ] **Step 5: Commit the test-DB foreign-key change**

```bash
git add packages/core/tests/helpers/db.ts packages/core/tests/notes.test.ts
git commit -m "fix: enforce sqlite foreign keys in core tests"
```

### Task 2: Add Link-Level Foreign Key Regression Coverage

**Files:**
- Modify: `packages/core/tests/links.test.ts`
- Test: `packages/core/tests/links.test.ts`

- [ ] **Step 1: Write the failing regression test for invalid note links**

Add this test to `packages/core/tests/links.test.ts`:

```ts
describe('addLink', () => {
  it('rejects links to notes that do not exist', async () => {
    await expect(addLink(db, idA, 'missing-note')).rejects.toThrow(/foreign key/i)
  })
})
```

- [ ] **Step 2: Run the focused link test to verify current behavior**

Run: `pnpm --filter @zettelkasten/core exec vitest run tests/links.test.ts`

Expected: if Task 1 is already complete, this test should fail first and then pass once the regression is implemented. If it passes immediately, confirm the test was added before code changes and keep it as the regression proof.

- [ ] **Step 3: Keep production link code unchanged and rely on DB enforcement**

No change is needed in `packages/core/src/links.ts`. The intended implementation is to keep:

```ts
export async function addLink(db: Database, fromId: string, toId: string): Promise<void> {
  const now = Date.now()
  await db.execute(
    `INSERT OR IGNORE INTO note_links (from_note_id, to_note_id, created_at) VALUES (?, ?, ?)`,
    [fromId, toId, now]
  )
  await db.execute(
    `INSERT OR IGNORE INTO note_links (from_note_id, to_note_id, created_at) VALUES (?, ?, ?)`,
    [toId, fromId, now]
  )
}
```

The point of this task is to prove the database now rejects invalid note IDs without adding duplicate app-side guards.

- [ ] **Step 4: Run the focused link test to verify it passes**

Run: `pnpm --filter @zettelkasten/core exec vitest run tests/links.test.ts`

Expected: PASS, including the invalid-link regression test.

- [ ] **Step 5: Commit the link regression coverage**

```bash
git add packages/core/tests/links.test.ts
git commit -m "test: cover invalid note links"
```

### Task 3: Enforce Foreign Keys In The Desktop App Connection

**Files:**
- Modify: `apps/desktop/src/db.ts`
- Test: `apps/desktop/src/db.ts`

- [ ] **Step 1: Write the code change needed for Tauri connection setup**

Update `apps/desktop/src/db.ts` to enable foreign keys immediately after loading the database:

```ts
import Database from '@tauri-apps/plugin-sql'
import type { Database as CoreDatabase } from '@zettelkasten/core'

let _db: Database | null = null

export async function getDb(): Promise<CoreDatabase> {
  if (!_db) {
    _db = await Database.load('sqlite:zettelkasten.db')
    await _db.execute('PRAGMA foreign_keys = ON')
  }
  return {
    async execute(sql: string, params: unknown[] = []) {
      await _db!.execute(sql, params)
    },
    async query<T>(sql: string, params: unknown[] = []) {
      return _db!.select<T[]>(sql, params)
    },
    async queryOne<T>(sql: string, params: unknown[] = []) {
      const rows = await _db!.select<T[]>(sql, params)
      return rows[0] ?? null
    },
  }
}
```

- [ ] **Step 2: Run desktop typecheck to verify the connection code compiles**

Run: `pnpm --filter @zettelkasten/desktop typecheck`

Expected: PASS.

- [ ] **Step 3: Run the core notes and links tests together to verify end-to-end FK enforcement**

Run: `pnpm --filter @zettelkasten/core exec vitest run tests/notes.test.ts tests/links.test.ts`

Expected: PASS, proving both note-source and note-link foreign keys are enforced in the tested database path.

- [ ] **Step 4: Commit the desktop connection change**

```bash
git add apps/desktop/src/db.ts
git commit -m "fix: enable sqlite foreign keys in desktop app"
```

### Task 4: Final Verification

**Files:**
- Modify: none
- Test: `packages/core/tests/notes.test.ts`, `packages/core/tests/links.test.ts`, `apps/desktop/src/db.ts`

- [ ] **Step 1: Run the full repository test command**

Run: `pnpm test`

Expected: PASS, with the core suite fully green.

- [ ] **Step 2: Run the desktop package typecheck**

Run: `pnpm --filter @zettelkasten/desktop typecheck`

Expected: PASS.

- [ ] **Step 3: Run the root typecheck and record the current known failure**

Run: `pnpm typecheck`

Expected: FAIL with the existing `TS6059` error from `packages/core/tsconfig.json` because that repo-level issue is outside this fix. Confirm there are no new errors introduced by the foreign-key work.

- [ ] **Step 4: Commit the final verification state**

```bash
git status --short
```

Expected: only the intended foreign-key changes remain uncommitted if commits were skipped during execution.

---

## Self-Review

- Spec coverage: the plan covers enabling FK enforcement in both concrete DB connections, updating invalid test fixtures, and proving invalid source/link references fail.
- Placeholder scan: no `TODO`, `TBD`, or implied "figure it out" steps remain.
- Type consistency: file paths, function names, and SQL column names match the current codebase (`source_id`, `from_note_id`, `to_note_id`, `getDb`, `createMigratedDb`).
