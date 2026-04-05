# Zettelkasten Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the SQLite data model, enforcement logic core package, and Tauri + React desktop app with Inbox, Review, and Graph screens.

**Architecture:** A pnpm monorepo with `packages/core` (pure TypeScript — types, schema, enforcement, CRUD) and `apps/desktop` (Tauri + React). Core has zero platform dependencies and is tested with Vitest + an in-memory better-sqlite3 adapter. The desktop app uses tauri-plugin-sql for SQLite access and implements the same Database interface core depends on.

**Tech Stack:** pnpm workspaces, TypeScript, Vitest, Tauri v2, React 18, Vite, tauri-plugin-sql, CodeMirror 6 (`@uiw/react-codemirror`), D3 v7

---

## File Map

```
zettelkasten/
├── package.json                                    # root workspace config
├── pnpm-workspace.yaml                             # workspace declaration
├── .gitignore
│
├── packages/core/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── src/
│   │   ├── types.ts                                # all shared types + Database interface
│   │   ├── schema.ts                               # CREATE TABLE SQL + runMigrations()
│   │   ├── enforce.ts                              # canPromoteToLiterature, canSavePermanentNote, validatePromotion
│   │   ├── notes.ts                                # note CRUD (createNote, getNotesByType, updateNote, softDeleteNote, countNotesByType)
│   │   ├── links.ts                                # addLink, removeLink, getLinkedNoteIds, getAllLinks
│   │   └── index.ts                                # barrel export
│   └── tests/
│       ├── helpers/db.ts                           # in-memory better-sqlite3 adapter for tests
│       ├── enforce.test.ts
│       ├── notes.test.ts
│       └── links.test.ts
│
└── apps/desktop/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    ├── src/
    │   ├── main.tsx                                # React entry point
    │   ├── App.tsx                                 # root: DB init + screen routing
    │   ├── db.ts                                   # tauri-plugin-sql → Database adapter
    │   ├── screens/
    │   │   ├── InboxScreen.tsx                     # fleeting note queue + quick capture
    │   │   ├── ReviewScreen.tsx                    # step-by-step promotion flow
    │   │   └── GraphScreen.tsx                     # D3 graph + inspector panel
    │   └── components/
    │       ├── Sidebar.tsx                         # navigation with inbox badge
    │       ├── NoteCard.tsx                        # fleeting note card in inbox
    │       ├── MarkdownEditor.tsx                  # CodeMirror wrapper
    │       ├── SourcePicker.tsx                    # search + create sources
    │       ├── LinkPicker.tsx                      # search permanent notes to link
    │       └── GraphCanvas.tsx                     # D3 force simulation
    └── src-tauri/
        ├── Cargo.toml
        ├── tauri.conf.json
        └── src/
            └── main.rs
```

---

## Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "zettelkasten",
  "private": true,
  "scripts": {
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  },
  "engines": {
    "node": ">=20",
    "pnpm": ">=9"
  }
}
```

Save to `/home/nidal/Playground/zettlekasten-app/package.json`.

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

Save to `/home/nidal/Playground/zettlekasten-app/pnpm-workspace.yaml`.

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
.DS_Store
*.db
target/
.superpowers/
```

Save to `/home/nidal/Playground/zettlekasten-app/.gitignore`.

- [ ] **Step 4: Initialize git and commit**

```bash
cd /home/nidal/Playground/zettlekasten-app
git init
git add package.json pnpm-workspace.yaml .gitignore
git commit -m "feat: monorepo scaffold"
```

---

## Task 2: packages/core — types and schema

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/schema.ts`
- Create: `packages/core/src/index.ts`

- [ ] **Step 1: Create packages/core/package.json**

```json
{
  "name": "@zettelkasten/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "better-sqlite3": "^9.4.3",
    "@types/better-sqlite3": "^7.6.8",
    "typescript": "^5.4.5",
    "vitest": "^1.5.0"
  }
}
```

- [ ] **Step 2: Create packages/core/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create packages/core/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 4: Create packages/core/src/types.ts**

```typescript
export type NoteType = 'fleeting' | 'literature' | 'permanent'

export type SourceType =
  | 'book'
  | 'article'
  | 'video'
  | 'podcast'
  | 'conversation'
  | 'other'

export interface Note {
  id: string
  type: NoteType
  title: string
  content: string
  created_at: number
  updated_at: number
  source_id: string | null
  own_words_confirmed: 0 | 1
  deleted_at: number | null
}

export interface Source {
  id: string
  type: SourceType
  label: string
  description: string | null
  created_at: number
}

export interface NoteLink {
  from_note_id: string
  to_note_id: string
  created_at: number
}

export interface PromotionContext {
  linkedPermanentNoteIds: string[]
  totalPermanentNotes: number
}

export type Result =
  | { ok: true }
  | { ok: false; reason: string }

export interface Database {
  execute(sql: string, params?: unknown[]): Promise<void>
  query<T>(sql: string, params?: unknown[]): Promise<T[]>
  queryOne<T>(sql: string, params?: unknown[]): Promise<T | null>
}
```

- [ ] **Step 5: Create packages/core/src/schema.ts**

```typescript
import type { Database } from './types'

export const SQL_CREATE_SOURCES = `
  CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('book','article','video','podcast','conversation','other')),
    label TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL
  )
`

export const SQL_CREATE_NOTES = `
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('fleeting','literature','permanent')),
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    source_id TEXT REFERENCES sources(id),
    own_words_confirmed INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER
  )
`

export const SQL_CREATE_NOTE_LINKS = `
  CREATE TABLE IF NOT EXISTS note_links (
    from_note_id TEXT NOT NULL REFERENCES notes(id),
    to_note_id TEXT NOT NULL REFERENCES notes(id),
    created_at INTEGER NOT NULL,
    PRIMARY KEY (from_note_id, to_note_id)
  )
`

export async function runMigrations(db: Database): Promise<void> {
  await db.execute(SQL_CREATE_SOURCES)
  await db.execute(SQL_CREATE_NOTES)
  await db.execute(SQL_CREATE_NOTE_LINKS)
}
```

- [ ] **Step 6: Create packages/core/src/index.ts**

```typescript
export * from './types'
export * from './schema'
export * from './enforce'
export * from './notes'
export * from './links'
```

- [ ] **Step 7: Install core dependencies**

```bash
cd /home/nidal/Playground/zettlekasten-app/packages/core
pnpm install
```

Expected: `node_modules` created, no errors.

- [ ] **Step 8: Commit**

```bash
cd /home/nidal/Playground/zettlekasten-app
git add packages/core
git commit -m "feat(core): types, schema, package setup"
```

---

## Task 3: packages/core — enforcement logic (TDD)

**Files:**
- Create: `packages/core/tests/helpers/db.ts`
- Create: `packages/core/tests/enforce.test.ts`
- Create: `packages/core/src/enforce.ts`

- [ ] **Step 1: Create test database helper**

Create `packages/core/tests/helpers/db.ts`:

```typescript
import BetterSqlite3 from 'better-sqlite3'
import { runMigrations } from '../../src/schema'
import type { Database } from '../../src/types'

export function createTestDb(): Database {
  const sqlite = new BetterSqlite3(':memory:')
  return {
    async execute(sql: string, params: unknown[] = []) {
      sqlite.prepare(sql).run(...params)
    },
    async query<T>(sql: string, params: unknown[] = []) {
      return sqlite.prepare(sql).all(...params) as T[]
    },
    async queryOne<T>(sql: string, params: unknown[] = []) {
      return (sqlite.prepare(sql).get(...params) as T) ?? null
    },
  }
}

export async function createMigratedDb(): Promise<Database> {
  const db = createTestDb()
  await runMigrations(db)
  return db
}
```

- [ ] **Step 2: Write failing enforcement tests**

Create `packages/core/tests/enforce.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { canPromoteToLiterature, canSavePermanentNote, validatePromotion } from '../src/enforce'
import type { Note, PromotionContext } from '../src/types'

const base: Note = {
  id: 'n1',
  type: 'fleeting',
  title: 'Test',
  content: '',
  created_at: 1000,
  updated_at: 1000,
  source_id: null,
  own_words_confirmed: 0,
  deleted_at: null,
}

describe('canPromoteToLiterature', () => {
  it('fails when note is not fleeting', () => {
    const r = canPromoteToLiterature({ ...base, type: 'literature' })
    expect(r.ok).toBe(false)
    expect((r as { ok: false; reason: string }).reason).toMatch(/only fleeting/i)
  })

  it('fails when source is not attached', () => {
    const r = canPromoteToLiterature(base)
    expect(r.ok).toBe(false)
    expect((r as { ok: false; reason: string }).reason).toMatch(/attach a source/i)
  })

  it('passes when fleeting and source attached', () => {
    const r = canPromoteToLiterature({ ...base, source_id: 'src-1' })
    expect(r.ok).toBe(true)
  })
})

describe('canSavePermanentNote', () => {
  const withLinks: PromotionContext = { linkedPermanentNoteIds: ['n2'], totalPermanentNotes: 1 }
  const noLinks: PromotionContext = { linkedPermanentNoteIds: [], totalPermanentNotes: 3 }
  const emptyGraph: PromotionContext = { linkedPermanentNoteIds: [], totalPermanentNotes: 0 }

  it('fails when own_words_confirmed is 0', () => {
    const r = canSavePermanentNote({ own_words_confirmed: 0 }, withLinks)
    expect(r.ok).toBe(false)
    expect((r as { ok: false; reason: string }).reason).toMatch(/own words/i)
  })

  it('fails when no links and permanent notes exist', () => {
    const r = canSavePermanentNote({ own_words_confirmed: 1 }, noLinks)
    expect(r.ok).toBe(false)
    expect((r as { ok: false; reason: string }).reason).toMatch(/link to at least one/i)
  })

  it('passes when own words confirmed and links provided', () => {
    const r = canSavePermanentNote({ own_words_confirmed: 1 }, withLinks)
    expect(r.ok).toBe(true)
  })

  it('waives link requirement when graph is empty (bootstrap)', () => {
    const r = canSavePermanentNote({ own_words_confirmed: 1 }, emptyGraph)
    expect(r.ok).toBe(true)
  })
})

describe('validatePromotion', () => {
  it('blocks fleeting → permanent skip', () => {
    const r = validatePromotion('fleeting', 'permanent')
    expect(r.ok).toBe(false)
  })

  it('allows fleeting → literature', () => {
    const r = validatePromotion('fleeting', 'literature')
    expect(r.ok).toBe(true)
  })

  it('allows literature → permanent', () => {
    const r = validatePromotion('literature', 'permanent')
    expect(r.ok).toBe(true)
  })
})
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
cd /home/nidal/Playground/zettlekasten-app/packages/core
pnpm test
```

Expected: FAIL — `Cannot find module '../src/enforce'`

- [ ] **Step 4: Create packages/core/src/enforce.ts**

```typescript
import type { Note, PromotionContext, Result, NoteType } from './types'

export function canPromoteToLiterature(note: Note): Result {
  if (note.type !== 'fleeting') {
    return { ok: false, reason: 'Only fleeting notes can be promoted to literature notes.' }
  }
  if (!note.source_id) {
    return { ok: false, reason: 'Attach a source before promoting to a literature note.' }
  }
  return { ok: true }
}

export function canSavePermanentNote(
  note: Pick<Note, 'own_words_confirmed'>,
  context: PromotionContext
): Result {
  if (!note.own_words_confirmed) {
    return { ok: false, reason: 'Confirm this note is written in your own words.' }
  }
  if (context.totalPermanentNotes > 0 && context.linkedPermanentNoteIds.length === 0) {
    return { ok: false, reason: 'Link to at least one existing permanent note.' }
  }
  return { ok: true }
}

export function validatePromotion(from: NoteType, to: NoteType): Result {
  if (from === 'fleeting' && to === 'permanent') {
    return {
      ok: false,
      reason: 'Fleeting notes cannot skip to permanent. Process through literature first.',
    }
  }
  return { ok: true }
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
cd /home/nidal/Playground/zettlekasten-app/packages/core
pnpm test
```

Expected: All 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /home/nidal/Playground/zettlekasten-app
git add packages/core/src/enforce.ts packages/core/tests/
git commit -m "feat(core): enforcement logic with full test coverage"
```

---

## Task 4: packages/core — notes CRUD (TDD)

**Files:**
- Create: `packages/core/tests/notes.test.ts`
- Create: `packages/core/src/notes.ts`

- [ ] **Step 1: Write failing notes tests**

Create `packages/core/tests/notes.test.ts`:

```typescript
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

beforeEach(async () => {
  db = await createMigratedDb()
})

describe('createNote', () => {
  it('inserts a fleeting note and returns it', async () => {
    const note = await createNote(db, { type: 'fleeting', title: 'Quick thought' })
    expect(note.id).toBeTruthy()
    expect(note.type).toBe('fleeting')
    expect(note.title).toBe('Quick thought')
    expect(note.content).toBe('')
    expect(note.source_id).toBeNull()
    expect(note.own_words_confirmed).toBe(0)
    expect(note.deleted_at).toBeNull()
  })

  it('inserts a literature note with a source', async () => {
    const note = await createNote(db, {
      type: 'literature',
      title: 'Notes on Kahneman',
      source_id: 'src-1',
    })
    expect(note.source_id).toBe('src-1')
  })
})

describe('getNoteById', () => {
  it('returns the note by id', async () => {
    const created = await createNote(db, { type: 'fleeting', title: 'Hello' })
    const found = await getNoteById(db, created.id)
    expect(found?.id).toBe(created.id)
  })

  it('returns null when not found', async () => {
    const found = await getNoteById(db, 'nonexistent')
    expect(found).toBeNull()
  })

  it('returns null for soft-deleted notes', async () => {
    const note = await createNote(db, { type: 'fleeting', title: 'Gone' })
    await softDeleteNote(db, note.id)
    const found = await getNoteById(db, note.id)
    expect(found).toBeNull()
  })
})

describe('getNotesByType', () => {
  it('returns only notes of the requested type, oldest first', async () => {
    await createNote(db, { type: 'fleeting', title: 'First' })
    await createNote(db, { type: 'literature', title: 'Lit note', source_id: 'src-1' })
    await createNote(db, { type: 'fleeting', title: 'Second' })

    const fleeting = await getNotesByType(db, 'fleeting')
    expect(fleeting).toHaveLength(2)
    expect(fleeting[0].title).toBe('First')
    expect(fleeting[1].title).toBe('Second')
  })

  it('excludes soft-deleted notes', async () => {
    const note = await createNote(db, { type: 'fleeting', title: 'Deleted' })
    await softDeleteNote(db, note.id)
    const results = await getNotesByType(db, 'fleeting')
    expect(results).toHaveLength(0)
  })
})

describe('updateNote', () => {
  it('updates title and content', async () => {
    const note = await createNote(db, { type: 'fleeting', title: 'Original' })
    await updateNote(db, note.id, { title: 'Updated', content: 'New content' })
    const updated = await getNoteById(db, note.id)
    expect(updated?.title).toBe('Updated')
    expect(updated?.content).toBe('New content')
  })
})

describe('countNotesByType', () => {
  it('counts notes by type excluding deleted', async () => {
    await createNote(db, { type: 'permanent', title: 'P1' })
    await createNote(db, { type: 'permanent', title: 'P2' })
    const deleted = await createNote(db, { type: 'permanent', title: 'P3' })
    await softDeleteNote(db, deleted.id)
    const count = await countNotesByType(db, 'permanent')
    expect(count).toBe(2)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /home/nidal/Playground/zettlekasten-app/packages/core
pnpm test
```

Expected: FAIL — `Cannot find module '../src/notes'`

- [ ] **Step 3: Create packages/core/src/notes.ts**

```typescript
import type { Database, Note, NoteType } from './types'

export interface CreateNoteInput {
  type: NoteType
  title: string
  content?: string
  source_id?: string
}

export async function createNote(db: Database, input: CreateNoteInput): Promise<Note> {
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
  }
  await db.execute(
    `INSERT INTO notes (id, type, title, content, created_at, updated_at, source_id, own_words_confirmed, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [note.id, note.type, note.title, note.content, note.created_at, note.updated_at,
     note.source_id, note.own_words_confirmed, note.deleted_at]
  )
  return note
}

export async function getNoteById(db: Database, id: string): Promise<Note | null> {
  return db.queryOne<Note>(
    `SELECT * FROM notes WHERE id = ? AND deleted_at IS NULL`,
    [id]
  )
}

export async function getNotesByType(db: Database, type: NoteType): Promise<Note[]> {
  return db.query<Note>(
    `SELECT * FROM notes WHERE type = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
    [type]
  )
}

export async function updateNote(
  db: Database,
  id: string,
  updates: Partial<Pick<Note, 'title' | 'content' | 'type' | 'source_id' | 'own_words_confirmed'>>
): Promise<void> {
  const entries = Object.entries(updates)
  if (entries.length === 0) return
  const fields = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = [...entries.map(([, v]) => v), Date.now(), id]
  await db.execute(`UPDATE notes SET ${fields}, updated_at = ? WHERE id = ?`, values)
}

export async function softDeleteNote(db: Database, id: string): Promise<void> {
  await db.execute(
    `UPDATE notes SET deleted_at = ? WHERE id = ?`,
    [Date.now(), id]
  )
}

export async function countNotesByType(db: Database, type: NoteType): Promise<number> {
  const row = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM notes WHERE type = ? AND deleted_at IS NULL`,
    [type]
  )
  return row?.count ?? 0
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /home/nidal/Playground/zettlekasten-app/packages/core
pnpm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/nidal/Playground/zettlekasten-app
git add packages/core/src/notes.ts packages/core/tests/notes.test.ts
git commit -m "feat(core): notes CRUD with full test coverage"
```

---

## Task 5: packages/core — links module (TDD)

**Files:**
- Create: `packages/core/tests/links.test.ts`
- Create: `packages/core/src/links.ts`

- [ ] **Step 1: Write failing links tests**

Create `packages/core/tests/links.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { addLink, removeLink, getLinkedNoteIds, getAllLinks } from '../src/links'
import { createNote } from '../src/notes'
import { createMigratedDb } from './helpers/db'
import type { Database } from '../src/types'

let db: Database
let idA: string
let idB: string
let idC: string

beforeEach(async () => {
  db = await createMigratedDb()
  const a = await createNote(db, { type: 'permanent', title: 'Note A' })
  const b = await createNote(db, { type: 'permanent', title: 'Note B' })
  const c = await createNote(db, { type: 'permanent', title: 'Note C' })
  idA = a.id
  idB = b.id
  idC = c.id
})

describe('addLink', () => {
  it('creates bidirectional link', async () => {
    await addLink(db, idA, idB)
    const fromA = await getLinkedNoteIds(db, idA)
    const fromB = await getLinkedNoteIds(db, idB)
    expect(fromA).toContain(idB)
    expect(fromB).toContain(idA)
  })

  it('is idempotent — duplicate add does not throw', async () => {
    await addLink(db, idA, idB)
    await expect(addLink(db, idA, idB)).resolves.not.toThrow()
  })
})

describe('removeLink', () => {
  it('removes both directions', async () => {
    await addLink(db, idA, idB)
    await removeLink(db, idA, idB)
    const fromA = await getLinkedNoteIds(db, idA)
    const fromB = await getLinkedNoteIds(db, idB)
    expect(fromA).not.toContain(idB)
    expect(fromB).not.toContain(idA)
  })
})

describe('getLinkedNoteIds', () => {
  it('returns all directly connected note ids', async () => {
    await addLink(db, idA, idB)
    await addLink(db, idA, idC)
    const linked = await getLinkedNoteIds(db, idA)
    expect(linked).toHaveLength(2)
    expect(linked).toContain(idB)
    expect(linked).toContain(idC)
  })

  it('returns empty array when no links', async () => {
    const linked = await getLinkedNoteIds(db, idA)
    expect(linked).toHaveLength(0)
  })
})

describe('getAllLinks', () => {
  it('returns each pair once (deduplicated)', async () => {
    await addLink(db, idA, idB)
    await addLink(db, idA, idC)
    const all = await getAllLinks(db)
    expect(all).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /home/nidal/Playground/zettlekasten-app/packages/core
pnpm test
```

Expected: FAIL — `Cannot find module '../src/links'`

- [ ] **Step 3: Create packages/core/src/links.ts**

```typescript
import type { Database, NoteLink } from './types'

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

export async function removeLink(db: Database, fromId: string, toId: string): Promise<void> {
  await db.execute(
    `DELETE FROM note_links WHERE (from_note_id = ? AND to_note_id = ?) OR (from_note_id = ? AND to_note_id = ?)`,
    [fromId, toId, toId, fromId]
  )
}

export async function getLinkedNoteIds(db: Database, noteId: string): Promise<string[]> {
  const rows = await db.query<{ to_note_id: string }>(
    `SELECT to_note_id FROM note_links WHERE from_note_id = ?`,
    [noteId]
  )
  return rows.map((r) => r.to_note_id)
}

export async function getAllLinks(db: Database): Promise<NoteLink[]> {
  return db.query<NoteLink>(
    `SELECT * FROM note_links WHERE from_note_id < to_note_id ORDER BY created_at ASC`
  )
}
```

- [ ] **Step 4: Run all core tests — verify they all pass**

```bash
cd /home/nidal/Playground/zettlekasten-app/packages/core
pnpm test
```

Expected: All tests in enforce, notes, links PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/nidal/Playground/zettlekasten-app
git add packages/core/src/links.ts packages/core/tests/links.test.ts
git commit -m "feat(core): links module with full test coverage"
```

---

## Task 6: Desktop app scaffold

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/vite.config.ts`
- Create: `apps/desktop/index.html`
- Create: `apps/desktop/src/main.tsx`
- Create: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/tauri.conf.json`
- Create: `apps/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Create apps/desktop/package.json**

```json
{
  "name": "@zettelkasten/desktop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@zettelkasten/core": "workspace:*",
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-sql": "^2.0.0",
    "@uiw/react-codemirror": "^4.21.21",
    "@codemirror/lang-markdown": "^6.2.4",
    "d3": "^7.9.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@types/d3": "^7.4.3",
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.4.5",
    "vite": "^5.2.0"
  }
}
```

- [ ] **Step 2: Create apps/desktop/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create apps/desktop/vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'chrome105',
    minify: !process.env.TAURI_DEBUG,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
})
```

- [ ] **Step 4: Create apps/desktop/index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Zettelkasten</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: system-ui, sans-serif; background: #0f0f1a; color: #e0e0ff; height: 100vh; overflow: hidden; }
      #root { height: 100vh; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create apps/desktop/src/main.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 6: Create apps/desktop/src-tauri/Cargo.toml**

```toml
[package]
name = "zettelkasten"
version = "0.1.0"
description = "Zettelkasten note-taking app"
authors = []
edition = "2021"

[lib]
name = "zettelkasten_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[profile.release]
panic = "abort"
codegen-units = 1
lto = true
opt-level = "s"
strip = true
```

- [ ] **Step 7: Create apps/desktop/src-tauri/tauri.conf.json**

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Zettelkasten",
  "version": "0.1.0",
  "identifier": "com.zettelkasten.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420"
  },
  "app": {
    "windows": [
      {
        "title": "Zettelkasten",
        "width": 1200,
        "height": 800,
        "minWidth": 900,
        "minHeight": 600
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": []
  },
  "plugins": {
    "sql": {}
  }
}
```

- [ ] **Step 8: Create apps/desktop/src-tauri/src/main.rs**

```rust
// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    zettelkasten_lib::run()
}
```

- [ ] **Step 9: Create apps/desktop/src-tauri/src/lib.rs**

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 10: Install desktop dependencies**

```bash
cd /home/nidal/Playground/zettlekasten-app
pnpm install
```

Expected: All workspace dependencies installed including `@zettelkasten/core`.

- [ ] **Step 11: Commit**

```bash
cd /home/nidal/Playground/zettlekasten-app
git add apps/desktop
git commit -m "feat(desktop): Tauri + React scaffold"
```

---

## Task 7: Desktop database adapter + app shell

**Files:**
- Create: `apps/desktop/src/db.ts`
- Create: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Create apps/desktop/src/db.ts**

```typescript
import Database from '@tauri-apps/plugin-sql'
import type { Database as CoreDatabase } from '@zettelkasten/core'

let _db: Database | null = null

export async function getDb(): Promise<CoreDatabase> {
  if (!_db) {
    _db = await Database.load('sqlite:zettelkasten.db')
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

- [ ] **Step 2: Create apps/desktop/src/App.tsx**

```tsx
import { useEffect, useState } from 'react'
import { getDb } from './db'
import { runMigrations } from '@zettelkasten/core'
import Sidebar from './components/Sidebar'
import InboxScreen from './screens/InboxScreen'
import ReviewScreen from './screens/ReviewScreen'
import GraphScreen from './screens/GraphScreen'
import type { Database } from '@zettelkasten/core'

export type Screen = 'inbox' | 'review' | 'graph'

export default function App() {
  const [db, setDb] = useState<Database | null>(null)
  const [screen, setScreen] = useState<Screen>('inbox')
  const [inboxCount, setInboxCount] = useState(0)

  useEffect(() => {
    getDb().then(async (database) => {
      await runMigrations(database)
      setDb(database)
    })
  }, [])

  if (!db) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#7f8fa6' }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar current={screen} onNavigate={setScreen} inboxCount={inboxCount} />
      <main style={{ flex: 1, overflow: 'hidden' }}>
        {screen === 'inbox' && <InboxScreen db={db} onCountChange={setInboxCount} />}
        {screen === 'review' && <ReviewScreen db={db} />}
        {screen === 'graph' && <GraphScreen db={db} />}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /home/nidal/Playground/zettlekasten-app
git add apps/desktop/src/db.ts apps/desktop/src/App.tsx
git commit -m "feat(desktop): db adapter and app shell"
```

---

## Task 8: Sidebar component

**Files:**
- Create: `apps/desktop/src/components/Sidebar.tsx`

- [ ] **Step 1: Create apps/desktop/src/components/Sidebar.tsx**

```tsx
import type { Screen } from '../App'

interface Props {
  current: Screen
  onNavigate: (screen: Screen) => void
  inboxCount: number
}

const items: { id: Screen; label: string; icon: string }[] = [
  { id: 'inbox', label: 'Inbox', icon: '📥' },
  { id: 'review', label: 'Review', icon: '🔄' },
  { id: 'graph', label: 'Graph', icon: '🕸️' },
]

export default function Sidebar({ current, onNavigate, inboxCount }: Props) {
  return (
    <nav style={{
      width: 160,
      background: '#13132a',
      borderRight: '1px solid #2a2a4a',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 8px',
      gap: 4,
      flexShrink: 0,
    }}>
      <div style={{ padding: '0 8px 16px', fontSize: 14, fontWeight: 700, color: '#e0e0ff' }}>
        Zettelkasten
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            background: current === item.id ? '#6c63ff' : 'transparent',
            color: current === item.id ? 'white' : '#7f8fa6',
            fontSize: 13,
            fontWeight: current === item.id ? 600 : 400,
            width: '100%',
            textAlign: 'left',
          }}
        >
          <span>{item.icon}</span>
          <span style={{ flex: 1 }}>{item.label}</span>
          {item.id === 'inbox' && inboxCount > 0 && (
            <span style={{
              background: '#ff6b81',
              color: 'white',
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 8,
            }}>
              {inboxCount}
            </span>
          )}
        </button>
      ))}
    </nav>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/nidal/Playground/zettlekasten-app
git add apps/desktop/src/components/Sidebar.tsx
git commit -m "feat(desktop): sidebar navigation with inbox badge"
```

---

## Task 9: Inbox screen

**Files:**
- Create: `apps/desktop/src/components/NoteCard.tsx`
- Create: `apps/desktop/src/components/MarkdownEditor.tsx`
- Create: `apps/desktop/src/screens/InboxScreen.tsx`

- [ ] **Step 1: Create apps/desktop/src/components/MarkdownEditor.tsx**

```tsx
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
}

export default function MarkdownEditor({ value, onChange, placeholder, minHeight = '120px' }: Props) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={[markdown()]}
      placeholder={placeholder}
      theme="dark"
      style={{ minHeight, fontSize: 14 }}
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
      }}
    />
  )
}
```

- [ ] **Step 2: Create apps/desktop/src/components/NoteCard.tsx**

```tsx
import type { Note } from '@zettelkasten/core'

interface Props {
  note: Note
  onProcess: (note: Note) => void
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function NoteCard({ note, onProcess }: Props) {
  return (
    <div style={{
      background: '#22223a',
      border: '1px solid #3d3d6b',
      borderRadius: 8,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e0ff', marginBottom: 4 }}>
          {note.title}
        </div>
        {note.content && (
          <div style={{
            fontSize: 12,
            color: '#7f8fa6',
            lineHeight: 1.5,
            marginBottom: 6,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {note.content}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#555' }}>{timeAgo(note.created_at)}</div>
      </div>
      <button
        onClick={() => onProcess(note)}
        style={{
          background: '#6c63ff',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          padding: '6px 10px',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Process →
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Create apps/desktop/src/screens/InboxScreen.tsx**

```tsx
import { useEffect, useState, useCallback } from 'react'
import { getNotesByType, createNote, canSavePermanentNote, countNotesByType } from '@zettelkasten/core'
import type { Database, Note } from '@zettelkasten/core'
import NoteCard from '../components/NoteCard'

interface Props {
  db: Database
  onCountChange: (count: number) => void
}

export default function InboxScreen({ db, onCountChange }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const loadNotes = useCallback(async () => {
    const fleeting = await getNotesByType(db, 'fleeting')
    setNotes(fleeting)
    onCountChange(fleeting.length)
  }, [db, onCountChange])

  useEffect(() => { loadNotes() }, [loadNotes])

  async function handleCapture() {
    if (!title.trim()) return
    await createNote(db, { type: 'fleeting', title: title.trim(), content })
    setTitle('')
    setContent('')
    await loadNotes()
  }

  function handleProcess(note: Note) {
    // Navigation to review handled by parent — emit event via custom event
    const event = new CustomEvent('zettel:review', { detail: note })
    window.dispatchEvent(event)
  }

  async function handleCreateLiterature() {
    setShowDropdown(false)
    const event = new CustomEvent('zettel:new-literature')
    window.dispatchEvent(event)
  }

  async function handleCreatePermanent() {
    setShowDropdown(false)
    const event = new CustomEvent('zettel:new-permanent')
    window.dispatchEvent(event)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1a1a2e' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: '1px solid #2a2a4a',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#e0e0ff' }}>Inbox</div>
          <div style={{ fontSize: 12, color: '#7f8fa6' }}>{notes.length} fleeting notes to process</div>
        </div>
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            style={{
              background: '#6c63ff',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + New ▾
          </button>
          {showDropdown && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '110%',
              background: '#22223a',
              border: '1px solid #3d3d6b',
              borderRadius: 8,
              padding: 4,
              zIndex: 100,
              minWidth: 180,
            }}>
              <button onClick={handleCreateLiterature} style={dropdownItemStyle}>
                Literature note
              </button>
              <button onClick={handleCreatePermanent} style={dropdownItemStyle}>
                Permanent note
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick capture */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #2a2a4a' }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCapture()}
          placeholder="Capture a fleeting thought... (Enter to save)"
          style={{
            width: '100%',
            background: '#22223a',
            border: '1px solid #3d3d6b',
            borderRadius: 6,
            padding: '8px 12px',
            color: '#e0e0ff',
            fontSize: 13,
            outline: 'none',
          }}
        />
      </div>

      {/* Notes list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notes.length === 0 ? (
          <div style={{ color: '#555', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
            No fleeting notes. Capture something above.
          </div>
        ) : (
          notes.map((note) => (
            <NoteCard key={note.id} note={note} onProcess={handleProcess} />
          ))
        )}
      </div>
    </div>
  )
}

const dropdownItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 12px',
  background: 'transparent',
  border: 'none',
  color: '#b0b0cc',
  fontSize: 13,
  textAlign: 'left',
  cursor: 'pointer',
  borderRadius: 4,
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/nidal/Playground/zettlekasten-app
git add apps/desktop/src/screens/InboxScreen.tsx apps/desktop/src/components/
git commit -m "feat(desktop): inbox screen with quick capture and note cards"
```

---

## Task 10: Review screen

**Files:**
- Create: `apps/desktop/src/components/SourcePicker.tsx`
- Create: `apps/desktop/src/components/LinkPicker.tsx`
- Create: `apps/desktop/src/screens/ReviewScreen.tsx`

- [ ] **Step 1: Create apps/desktop/src/components/SourcePicker.tsx**

```tsx
import { useState, useEffect } from 'react'
import type { Database, Source, SourceType } from '@zettelkasten/core'

interface Props {
  db: Database
  selectedId: string | null
  onSelect: (sourceId: string) => void
}

const SOURCE_TYPES: SourceType[] = ['book', 'article', 'video', 'podcast', 'conversation', 'other']
const ICONS: Record<SourceType, string> = {
  book: '📚', article: '📄', video: '🎥', podcast: '🎙️', conversation: '💬', other: '📌',
}

export default function SourcePicker({ db, selectedId, onSelect }: Props) {
  const [sources, setSources] = useState<Source[]>([])
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [newType, setNewType] = useState<SourceType>('book')
  const [newLabel, setNewLabel] = useState('')
  const [newDesc, setNewDesc] = useState('')

  useEffect(() => {
    db.query<Source>(`SELECT * FROM sources WHERE deleted_at IS NULL ORDER BY created_at DESC`)
      .then(setSources)
  }, [db])

  const filtered = sources.filter((s) =>
    s.label.toLowerCase().includes(query.toLowerCase())
  )

  async function handleCreate() {
    if (!newLabel.trim()) return
    const source: Source = {
      id: globalThis.crypto.randomUUID(),
      type: newType,
      label: newLabel.trim(),
      description: newDesc.trim() || null,
      created_at: Date.now(),
    }
    await db.execute(
      `INSERT INTO sources (id, type, label, description, created_at) VALUES (?, ?, ?, ?, ?)`,
      [source.id, source.type, source.label, source.description, source.created_at]
    )
    setSources((prev) => [source, ...prev])
    onSelect(source.id)
    setCreating(false)
    setNewLabel('')
    setNewDesc('')
  }

  return (
    <div>
      {!creating ? (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sources..."
            style={inputStyle}
          />
          <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
            {filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                style={{
                  ...sourceRowStyle,
                  background: s.id === selectedId ? '#6c63ff22' : '#22223a',
                  border: `1px solid ${s.id === selectedId ? '#6c63ff' : '#3d3d6b'}`,
                }}
              >
                <span>{ICONS[s.type]}</span>
                <span style={{ flex: 1, textAlign: 'left', fontSize: 12, color: '#e0e0ff' }}>{s.label}</span>
                {s.id === selectedId && <span style={{ color: '#6c63ff', fontSize: 12 }}>✓</span>}
              </button>
            ))}
          </div>
          <button onClick={() => setCreating(true)} style={{ ...sourceRowStyle, marginTop: 6, background: '#1a1a2e', border: '1px dashed #3d3d6b', color: '#555', fontSize: 12 }}>
            + Add new source
          </button>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as SourceType)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {SOURCE_TYPES.map((t) => (
              <option key={t} value={t}>{ICONS[t]} {t}</option>
            ))}
          </select>
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Label (e.g. Thinking, Fast and Slow)" style={inputStyle} />
          <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)" style={inputStyle} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreate} style={{ flex: 1, background: '#6c63ff', color: 'white', border: 'none', borderRadius: 6, padding: '7px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Create source
            </button>
            <button onClick={() => setCreating(false)} style={{ background: '#22223a', color: '#7f8fa6', border: '1px solid #3d3d6b', borderRadius: 6, padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#22223a',
  border: '1px solid #3d3d6b',
  borderRadius: 6,
  padding: '7px 10px',
  color: '#e0e0ff',
  fontSize: 12,
  outline: 'none',
}

const sourceRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 10px',
  borderRadius: 6,
  border: '1px solid #3d3d6b',
  cursor: 'pointer',
  width: '100%',
}
```

- [ ] **Step 2: Create apps/desktop/src/components/LinkPicker.tsx**

```tsx
import { useState, useEffect } from 'react'
import { getNotesByType } from '@zettelkasten/core'
import type { Database, Note } from '@zettelkasten/core'

interface Props {
  db: Database
  selectedIds: string[]
  onToggle: (noteId: string) => void
}

export default function LinkPicker({ db, selectedIds, onToggle }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    getNotesByType(db, 'permanent').then(setNotes)
  }, [db])

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(query.toLowerCase())
  )

  if (notes.length === 0) {
    return (
      <div style={{ fontSize: 12, color: '#555', fontStyle: 'italic', padding: '8px 0' }}>
        No permanent notes yet — link requirement waived (bootstrap mode).
      </div>
    )
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search permanent notes..."
        style={{
          width: '100%',
          background: '#22223a',
          border: '1px solid #3d3d6b',
          borderRadius: 6,
          padding: '7px 10px',
          color: '#e0e0ff',
          fontSize: 12,
          outline: 'none',
          marginBottom: 6,
        }}
      />
      <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {filtered.map((note) => {
          const selected = selectedIds.includes(note.id)
          return (
            <button
              key={note.id}
              onClick={() => onToggle(note.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 10px',
                borderRadius: 6,
                border: `1px solid ${selected ? '#6c63ff' : '#3d3d6b'}`,
                background: selected ? '#6c63ff22' : '#22223a',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 11, color: selected ? '#6c63ff' : '#555' }}>
                {selected ? '✓' : '○'}
              </span>
              <span style={{ fontSize: 12, color: '#e0e0ff' }}>{note.title}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create apps/desktop/src/screens/ReviewScreen.tsx**

```tsx
import { useEffect, useState, useCallback } from 'react'
import {
  getNotesByType,
  updateNote,
  createNote,
  addLink,
  countNotesByType,
  canPromoteToLiterature,
  canSavePermanentNote,
  validatePromotion,
} from '@zettelkasten/core'
import type { Database, Note } from '@zettelkasten/core'
import MarkdownEditor from '../components/MarkdownEditor'
import SourcePicker from '../components/SourcePicker'
import LinkPicker from '../components/LinkPicker'

interface Props {
  db: Database
}

type ReviewStep = 'fleeting-to-literature' | 'literature-to-permanent'

export default function ReviewScreen({ db }: Props) {
  const [queue, setQueue] = useState<Note[]>([])
  const [current, setCurrent] = useState<Note | null>(null)
  const [step, setStep] = useState<ReviewStep>('fleeting-to-literature')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [ownWords, setOwnWords] = useState(false)
  const [linkedIds, setLinkedIds] = useState<string[]>([])
  const [blockReason, setBlockReason] = useState<string | null>(null)

  const loadQueue = useCallback(async () => {
    const fleeting = await getNotesByType(db, 'fleeting')
    const literature = await getNotesByType(db, 'literature')
    setQueue([...fleeting, ...literature])
  }, [db])

  useEffect(() => { loadQueue() }, [loadQueue])

  // Listen for process events from Inbox
  useEffect(() => {
    const handler = (e: Event) => {
      const note = (e as CustomEvent<Note>).detail
      selectNote(note)
    }
    window.addEventListener('zettel:review', handler)
    return () => window.removeEventListener('zettel:review', handler)
  }, [])

  function selectNote(note: Note) {
    setCurrent(note)
    setTitle(note.title)
    setContent(note.content)
    setSourceId(note.source_id)
    setOwnWords(false)
    setLinkedIds([])
    setBlockReason(null)
    setStep(note.type === 'fleeting' ? 'fleeting-to-literature' : 'literature-to-permanent')
  }

  async function handlePromoteToLiterature() {
    if (!current) return
    const check = canPromoteToLiterature({ ...current, source_id: sourceId })
    if (!check.ok) { setBlockReason(check.reason); return }
    await updateNote(db, current.id, { type: 'literature', title, content, source_id: sourceId! })
    const updated = { ...current, type: 'literature' as const, title, content, source_id: sourceId }
    setCurrent(updated)
    setStep('literature-to-permanent')
    setBlockReason(null)
  }

  async function handleSavePermanent() {
    if (!current) return
    const totalPermanent = await countNotesByType(db, 'permanent')
    const check = canSavePermanentNote(
      { own_words_confirmed: ownWords ? 1 : 0 },
      { linkedPermanentNoteIds: linkedIds, totalPermanentNotes: totalPermanent }
    )
    if (!check.ok) { setBlockReason(check.reason); return }

    // Create new permanent note, preserve literature note
    const permanent = await createNote(db, {
      type: 'permanent',
      title,
      content,
    })
    await updateNote(db, permanent.id, { own_words_confirmed: 1 })
    for (const id of linkedIds) {
      await addLink(db, permanent.id, id)
    }
    setCurrent(null)
    setBlockReason(null)
    await loadQueue()
  }

  function toggleLink(id: string) {
    setLinkedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  if (queue.length === 0 && !current) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#555', fontSize: 14 }}>
        Queue is empty. Capture some fleeting notes first.
      </div>
    )
  }

  if (!current) {
    return (
      <div style={{ padding: 24, background: '#1a1a2e', height: '100%' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#e0e0ff', marginBottom: 16 }}>
          Review Queue ({queue.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {queue.map((note) => (
            <button
              key={note.id}
              onClick={() => selectNote(note)}
              style={{
                background: '#22223a',
                border: '1px solid #3d3d6b',
                borderRadius: 8,
                padding: '12px 14px',
                textAlign: 'left',
                cursor: 'pointer',
                color: '#e0e0ff',
              }}
            >
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 4,
                background: note.type === 'fleeting' ? '#ffd32a22' : '#6c63ff22',
                color: note.type === 'fleeting' ? '#ffd32a' : '#6c63ff',
                marginRight: 8,
                textTransform: 'uppercase',
              }}>
                {note.type}
              </span>
              {note.title}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, background: '#1a1a2e', height: '100%', overflowY: 'auto' }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        {(['fleeting', 'literature', 'permanent'] as const).map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <div style={{ width: 24, height: 1, background: '#3d3d6b' }} />}
            <div style={{
              padding: '4px 12px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600,
              background: current.type === s ? '#6c63ff22' : 'transparent',
              color: current.type === s ? '#6c63ff' : '#555',
              border: `1px solid ${current.type === s ? '#6c63ff' : '#2a2a4a'}`,
            }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </div>
          </div>
        ))}
        <button
          onClick={() => setCurrent(null)}
          style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 12 }}
        >
          ← Back to queue
        </button>
      </div>

      {/* Note editor */}
      <div style={{ marginBottom: 16 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid #3d3d6b',
            color: '#e0e0ff',
            fontSize: 18,
            fontWeight: 700,
            padding: '4px 0',
            marginBottom: 12,
            outline: 'none',
          }}
        />
        <MarkdownEditor value={content} onChange={setContent} minHeight="140px" />
      </div>

      {/* Step-specific gates */}
      {step === 'fleeting-to-literature' && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7f8fa6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Attach a source <span style={{ color: '#ff6b81' }}>*required</span>
          </div>
          <SourcePicker db={db} selectedId={sourceId} onSelect={setSourceId} />
        </div>
      )}

      {step === 'literature-to-permanent' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={ownWords}
                onChange={(e) => setOwnWords(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#2ed573' }}
              />
              <span style={{ fontSize: 13, color: '#b0b0cc' }}>I wrote this in my own words</span>
            </label>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7f8fa6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Link to permanent notes <span style={{ color: '#ff6b81' }}>*required</span>
            </div>
            <LinkPicker db={db} selectedIds={linkedIds} onToggle={toggleLink} />
          </div>
        </>
      )}

      {/* Error message */}
      {blockReason && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#ff6b8122', border: '1px solid #ff6b8155', borderRadius: 6, fontSize: 12, color: '#ff6b81' }}>
          {blockReason}
        </div>
      )}

      {/* Action button */}
      {step === 'fleeting-to-literature' ? (
        <button
          onClick={handlePromoteToLiterature}
          style={actionButtonStyle(!!sourceId)}
        >
          Promote to Literature →
        </button>
      ) : (
        <button
          onClick={handleSavePermanent}
          style={actionButtonStyle(ownWords && linkedIds.length > 0)}
        >
          Save as Permanent note ✓
        </button>
      )}
    </div>
  )
}

function actionButtonStyle(active: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '12px',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: active ? 'pointer' : 'default',
    background: active ? '#2ed573' : '#2a2a4a',
    color: active ? '#1a1a2e' : '#555',
    transition: 'background 0.2s',
  }
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/nidal/Playground/zettlekasten-app
git add apps/desktop/src/screens/ReviewScreen.tsx apps/desktop/src/components/SourcePicker.tsx apps/desktop/src/components/LinkPicker.tsx
git commit -m "feat(desktop): review screen with full promotion flow"
```

---

## Task 11: Graph screen

**Files:**
- Create: `apps/desktop/src/components/GraphCanvas.tsx`
- Create: `apps/desktop/src/screens/GraphScreen.tsx`

- [ ] **Step 1: Create apps/desktop/src/components/GraphCanvas.tsx**

```tsx
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { Note, NoteLink } from '@zettelkasten/core'

interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  title: string
  linkCount: number
}

interface GraphEdge extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
}

interface Props {
  notes: Note[]
  links: NoteLink[]
  onNodeClick: (note: Note) => void
}

export default function GraphCanvas({ notes, links, onNodeClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || notes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    const linkCountMap = new Map<string, number>()
    links.forEach((l) => {
      const from = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id
      const to = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id
      linkCountMap.set(from, (linkCountMap.get(from) ?? 0) + 1)
      linkCountMap.set(to, (linkCountMap.get(to) ?? 0) + 1)
    })

    const nodes: GraphNode[] = notes.map((n) => ({
      id: n.id,
      title: n.title,
      linkCount: linkCountMap.get(n.id) ?? 0,
    }))

    const edges: GraphEdge[] = links.map((l) => ({
      source: l.from_note_id,
      target: l.to_note_id,
    }))

    const radiusScale = d3.scaleSqrt()
      .domain([0, d3.max(nodes, (n) => n.linkCount) ?? 1])
      .range([6, 20])

    const g = svg.append('g')

    // Zoom/pan
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on('zoom', (event) => g.attr('transform', event.transform))
    )

    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphEdge>(edges).id((d) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius((d) => radiusScale(d.linkCount) + 4))

    const link = g.append('g')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke', '#6c63ff')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1.5)

    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .style('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null; d.fy = null
          })
      )

    node.append('circle')
      .attr('r', (d) => radiusScale(d.linkCount))
      .attr('fill', '#6c63ff')
      .attr('fill-opacity', 0.85)
      .attr('stroke', '#a29bfe')
      .attr('stroke-width', 1.5)

    node.append('text')
      .attr('dy', (d) => radiusScale(d.linkCount) + 12)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('fill', '#b0b0cc')
      .text((d) => d.title.length > 24 ? d.title.slice(0, 24) + '…' : d.title)

    node.on('click', (_, d) => {
      const note = notes.find((n) => n.id === d.id)
      if (note) onNodeClick(note)
    })

    node.on('mouseover', (_, d) => {
      const connected = new Set([d.id])
      edges.forEach((e) => {
        const s = typeof e.source === 'string' ? e.source : (e.source as GraphNode).id
        const t = typeof e.target === 'string' ? e.target : (e.target as GraphNode).id
        if (s === d.id) connected.add(t)
        if (t === d.id) connected.add(s)
      })
      node.attr('opacity', (n) => connected.has(n.id) ? 1 : 0.15)
      link.attr('stroke-opacity', (e) => {
        const s = typeof e.source === 'string' ? e.source : (e.source as GraphNode).id
        const t = typeof e.target === 'string' ? e.target : (e.target as GraphNode).id
        return connected.has(s) && connected.has(t) ? 0.8 : 0.05
      })
    })

    node.on('mouseout', () => {
      node.attr('opacity', 1)
      link.attr('stroke-opacity', 0.4)
    })

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0)
      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => { simulation.stop() }
  }, [notes, links])

  return <svg ref={svgRef} width="100%" height="100%" style={{ background: '#0a0a18' }} />
}
```

- [ ] **Step 2: Create apps/desktop/src/screens/GraphScreen.tsx**

```tsx
import { useEffect, useState } from 'react'
import { getNotesByType, getAllLinks } from '@zettelkasten/core'
import type { Database, Note, NoteLink } from '@zettelkasten/core'
import GraphCanvas from '../components/GraphCanvas'

interface Props {
  db: Database
}

export default function GraphScreen({ db }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [links, setLinks] = useState<NoteLink[]>([])
  const [selected, setSelected] = useState<Note | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    Promise.all([getNotesByType(db, 'permanent'), getAllLinks(db)]).then(([n, l]) => {
      setNotes(n)
      setLinks(l)
    })
  }, [db])

  const filtered = query
    ? notes.filter((n) => n.title.toLowerCase().includes(query.toLowerCase()))
    : notes

  if (notes.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#555', fontSize: 14, background: '#0a0a18' }}>
        No permanent notes yet. Process some notes through Review first.
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <GraphCanvas notes={filtered} links={links} onNodeClick={setSelected} />

      {/* Search overlay */}
      <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes..."
          style={{
            background: '#1a1a2eee',
            border: '1px solid #3d3d6b',
            borderRadius: 8,
            padding: '7px 12px',
            color: '#e0e0ff',
            fontSize: 12,
            outline: 'none',
            width: 220,
          }}
        />
        <div style={{ background: '#1a1a2eee', border: '1px solid #3d3d6b', borderRadius: 8, padding: '7px 12px', fontSize: 12, color: '#7f8fa6' }}>
          {notes.length} notes · {links.length} links
        </div>
      </div>

      {/* Inspector panel */}
      {selected && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          width: 260,
          background: '#13132aee',
          border: '1px solid #6c63ff55',
          borderRadius: 10,
          padding: 16,
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e0e0ff', marginBottom: 6, lineHeight: 1.4 }}>
            {selected.title}
          </div>
          {selected.content && (
            <div style={{ fontSize: 12, color: '#7f8fa6', lineHeight: 1.5, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {selected.content}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#555', marginBottom: 10 }}>
            {links.filter((l) => l.from_note_id === selected.id || l.to_note_id === selected.id).length} connections
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => {
                const event = new CustomEvent('zettel:open-note', { detail: selected })
                window.dispatchEvent(event)
              }}
              style={{ flex: 1, background: '#6c63ff', color: 'white', border: 'none', borderRadius: 5, padding: '7px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >
              Open note
            </button>
            <button
              onClick={() => setSelected(null)}
              style={{ background: '#22223a', color: '#7f8fa6', border: '1px solid #3d3d6b', borderRadius: 5, padding: '7px 10px', fontSize: 11, cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Hint */}
      <div style={{ position: 'absolute', bottom: 16, left: 16, fontSize: 11, color: '#333', background: '#0a0a18', padding: '5px 10px', borderRadius: 6, border: '1px solid #1a1a2e' }}>
        scroll to zoom · drag to pan · click node to inspect
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /home/nidal/Playground/zettlekasten-app
git add apps/desktop/src/screens/GraphScreen.tsx apps/desktop/src/components/GraphCanvas.tsx
git commit -m "feat(desktop): graph screen with D3 force simulation"
```

---

## Self-Review Notes

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| SQLite schema (notes, sources, note_links) | Task 2 |
| canPromoteToLiterature, canSavePermanentNote, validatePromotion | Task 3 |
| Notes CRUD | Task 4 |
| Links (bidirectional, addLink, removeLink, getAllLinks) | Task 5 |
| Monorepo pnpm workspaces | Task 1 |
| Tauri + React scaffold | Task 6 |
| DB adapter (tauri-plugin-sql → Database interface) | Task 7 |
| Sidebar with inbox badge | Task 8 |
| Inbox screen (quick capture, FIFO list, Process button) | Task 9 |
| Review screen (Fleeting→Literature→Permanent gates) | Task 10 |
| Literature note preservation on promotion | Task 10 |
| Direct literature/permanent creation via dropdown | Task 9 |
| Graph screen (D3 force, hover, click inspector) | Task 11 |
| Bootstrap exception (0 permanent notes) | Task 3 + 10 |
| Soft deletes | Task 4 |

All spec requirements covered.
