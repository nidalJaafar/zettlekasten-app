# React Native Mobile Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React Native mobile app (iOS + Android) that replicates the desktop Tauri app, sharing all business logic through an elevated `@zettelkasten/core` package.

**Architecture:** Three phases — first promote sources CRUD and wikilink helpers into the shared core package, then scaffold the Expo mobile app with DB adapter and routing, then build all six screens with Liquid Glass design. Each phase produces working, testable software independently.

**Tech Stack:** Expo SDK 52+, Expo Router v4, expo-sqlite, Zustand, react-native-svg, d3-force, `@zettelkasten/core` (workspace reference)

---

## File Structure

### Phase 1: Core Elevation

- Create: `packages/core/src/sources.ts` — Source CRUD module
- Create: `packages/core/tests/sources.test.ts` — Source CRUD tests
- Create: `packages/core/src/wikilinks.ts` — Pure wikilink helpers
- Create: `packages/core/tests/wikilinks.test.ts` — Wikilink tests
- Modify: `packages/core/src/index.ts` — Export new modules
- Modify: `apps/desktop/src/lib/wikilinks.ts` — Re-export from core, keep DOM-specific helpers
- Modify: `apps/desktop/src/lib/note-workflow.ts` — Import from core instead of local
- Modify: `apps/desktop/src/components/SourcePicker.tsx` — Use core source functions

### Phase 2: Mobile Scaffold

- Create: `apps/mobile/` — Full Expo project
- Create: `apps/mobile/src/db.ts` — expo-sqlite adapter
- Create: `apps/mobile/src/store.ts` — Zustand store
- Create: `apps/mobile/src/theme.ts` — Design tokens as StyleSheet
- Create: `apps/mobile/app/_layout.tsx` — Root layout
- Create: `apps/mobile/app/(tabs)/_layout.tsx` — Tab navigator
- Create: `apps/mobile/app/(tabs)/index.tsx` — Placeholder tabs

### Phase 3: Mobile Screens

- Create: `apps/mobile/app/(tabs)/inbox.tsx` — Inbox screen
- Create: `apps/mobile/app/(tabs)/workspace.tsx` — Universal note editor
- Create: `apps/mobile/app/(tabs)/library.tsx` — Processed literature list
- Create: `apps/mobile/app/(tabs)/graph.tsx` — Force-directed graph
- Create: `apps/mobile/app/trash.tsx` — Trash screen
- Create: `apps/mobile/app/note/[id].tsx` — Deep-linked note view
- Create: `apps/mobile/src/components/NoteCard.tsx` — Note list item
- Create: `apps/mobile/src/components/MarkdownInput.tsx` — TextInput + preview
- Create: `apps/mobile/src/components/LinkPicker.tsx` — Permanent note picker (bottom sheet)
- Create: `apps/mobile/src/components/SourcePicker.tsx` — Source picker (bottom sheet)
- Create: `apps/mobile/src/components/GraphCanvas.tsx` — SVG force graph
- Create: `apps/mobile/src/lib/note-workflow.ts` — Workflow orchestration
- Create: `apps/mobile/src/lib/graph.ts` — Neighborhood BFS

---

## Phase 1: Core Elevation

### Task 1: Add Source CRUD Module to Core

**Files:**
- Create: `packages/core/src/sources.ts`
- Create: `packages/core/tests/sources.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing source CRUD tests**

Create `packages/core/tests/sources.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createMigratedDb } from './helpers/db'
import {
  createSource,
  getSourceById,
  getAllSources,
  updateSource,
  deleteSource,
  countNotesBySource,
} from '../src/sources'

describe('sources', () => {
  it('creates a source and retrieves it', async () => {
    const db = await createMigratedDb()
    const source = await createSource(db, {
      type: 'book',
      label: 'Thinking, Fast and Slow',
      description: 'Daniel Kahneman',
    })
    expect(source.type).toBe('book')
    expect(source.label).toBe('Thinking, Fast and Slow')
    expect(source.description).toBe('Daniel Kahneman')
    expect(source.id).toBeTruthy()

    const retrieved = await getSourceById(db, source.id)
    expect(retrieved).toEqual(source)
  })

  it('creates a source without description', async () => {
    const db = await createMigratedDb()
    const source = await createSource(db, { type: 'article', label: 'Minimal Source' })
    expect(source.description).toBeNull()
  })

  it('lists all sources ordered by label', async () => {
    const db = await createMigratedDb()
    await createSource(db, { type: 'book', label: 'Zen' })
    await createSource(db, { type: 'book', label: 'Alpha' })
    await createSource(db, { type: 'book', label: 'Middle' })

    const sources = await getAllSources(db)
    expect(sources.map((s) => s.label)).toEqual(['Alpha', 'Middle', 'Zen'])
  })

  it('updates a source label and description', async () => {
    const db = await createMigratedDb()
    const source = await createSource(db, { type: 'book', label: 'Old Label' })
    await updateSource(db, source.id, { label: 'New Label', description: 'Added desc' })

    const updated = await getSourceById(db, source.id)
    expect(updated!.label).toBe('New Label')
    expect(updated!.description).toBe('Added desc')
  })

  it('deletes a source when no notes reference it', async () => {
    const db = await createMigratedDb()
    const source = await createSource(db, { type: 'book', label: 'Deletable' })
    await deleteSource(db, source.id)
    const retrieved = await getSourceById(db, source.id)
    expect(retrieved).toBeNull()
  })

  it('refuses to delete a source when notes reference it', async () => {
    const db = await createMigratedDb()
    const source = await createSource(db, { type: 'book', label: 'Referenced' })
    const { createNote } = await import('../src/notes')
    await createNote(db, { type: 'literature', title: 'Lit', source_id: source.id })

    await expect(deleteSource(db, source.id)).rejects.toThrow(/in use/i)
  })

  it('counts notes by source', async () => {
    const db = await createMigratedDb()
    const source = await createSource(db, { type: 'book', label: 'Counted' })
    const { createNote } = await import('../src/notes')
    expect(await countNotesBySource(db, source.id)).toBe(0)
    await createNote(db, { type: 'literature', title: 'One', source_id: source.id })
    await createNote(db, { type: 'literature', title: 'Two', source_id: source.id })
    expect(await countNotesBySource(db, source.id)).toBe(2)
  })

  it('counts zero for nonexistent source', async () => {
    const db = await createMigratedDb()
    expect(await countNotesBySource(db, 'no-such-id')).toBe(0)
  })
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm --filter @zettelkasten/core exec vitest run tests/sources.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the sources module**

Create `packages/core/src/sources.ts`:

```ts
import type { Database, Source, SourceType } from './types'

export interface CreateSourceInput {
  type: SourceType
  label: string
  description?: string
}

export async function createSource(db: Database, input: CreateSourceInput): Promise<Source> {
  const source: Source = {
    id: globalThis.crypto.randomUUID(),
    type: input.type,
    label: input.label.trim(),
    description: input.description?.trim() ?? null,
    created_at: Date.now(),
  }
  await db.execute(
    `INSERT INTO sources (id, type, label, description, created_at) VALUES (?, ?, ?, ?, ?)`,
    [source.id, source.type, source.label, source.description, source.created_at]
  )
  return source
}

export async function getSourceById(db: Database, id: string): Promise<Source | null> {
  return db.queryOne<Source>(`SELECT * FROM sources WHERE id = ?`, [id])
}

export async function getAllSources(db: Database): Promise<Source[]> {
  return db.query<Source>(`SELECT * FROM sources ORDER BY label ASC`)
}

export async function updateSource(
  db: Database,
  id: string,
  updates: Partial<Pick<Source, 'label' | 'description'>>
): Promise<void> {
  const entries = Object.entries(updates).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return
  const fields = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = [...entries.map(([, v]) => v), id]
  await db.execute(`UPDATE sources SET ${fields} WHERE id = ?`, values)
}

export async function countNotesBySource(db: Database, sourceId: string): Promise<number> {
  const row = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM notes WHERE source_id = ? AND deleted_at IS NULL`,
    [sourceId]
  )
  return row?.count ?? 0
}

export async function deleteSource(db: Database, id: string): Promise<void> {
  const count = await countNotesBySource(db, id)
  if (count > 0) {
    throw new Error(`Cannot delete source: ${count} note(s) still reference it.`)
  }
  await db.execute(`DELETE FROM sources WHERE id = ?`, [id])
}
```

- [ ] **Step 4: Export from `packages/core/src/index.ts`**

Add to `packages/core/src/index.ts`:

```ts
export * from './sources'
```

- [ ] **Step 5: Run the tests and verify they pass**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm --filter @zettelkasten/core exec vitest run tests/sources.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run full test suite and typecheck**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm test && pnpm typecheck
```

Expected: all tests pass, typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/sources.ts packages/core/tests/sources.test.ts packages/core/src/index.ts
git commit -m "Add source CRUD module to shared core"
```

---

### Task 2: Add Wikilink Helpers to Core

**Files:**
- Create: `packages/core/src/wikilinks.ts`
- Create: `packages/core/tests/wikilinks.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing wikilink helper tests**

Create `packages/core/tests/wikilinks.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  extractWikilinkTitles,
  rewriteTitleBasedWikilinks,
  getActiveWikilinkQuery,
  insertWikilinkSelection,
  getWikilinkText,
} from '../src/wikilinks'

describe('extractWikilinkTitles', () => {
  it('extracts simple wikilinks', () => {
    expect(extractWikilinkTitles('See [[Alpha]] and [[Beta]]')).toEqual(['Alpha', 'Beta'])
  })

  it('extracts wikilinks with aliases', () => {
    expect(extractWikilinkTitles('[[Alpha|display text]]')).toEqual(['Alpha'])
  })

  it('returns empty array when no wikilinks', () => {
    expect(extractWikilinkTitles('No links here')).toEqual([])
  })

  it('handles multiple identical titles', () => {
    expect(extractWikilinkTitles('[[Foo]] and [[Foo]] again')).toEqual(['Foo', 'Foo'])
  })
})

describe('rewriteTitleBasedWikilinks', () => {
  it('renames matching wikilinks', () => {
    expect(rewriteTitleBasedWikilinks('See [[Old Title]] here', 'Old Title', 'New Title'))
      .toBe('See [[New Title]] here')
  })

  it('preserves aliases when renaming', () => {
    expect(rewriteTitleBasedWikilinks('[[Old|display]]', 'Old', 'New'))
      .toBe('[[New|display]]')
  })

  it('does not rename non-matching wikilinks', () => {
    expect(rewriteTitleBasedWikilinks('[[Other]] and [[Old]]', 'Old', 'New'))
      .toBe('[[Other]] and [[New]]')
  })

  it('returns unchanged when old equals new', () => {
    expect(rewriteTitleBasedWikilinks('[[Same]]', 'Same', 'Same')).toBe('[[Same]]')
  })

  it('returns unchanged when old title is empty', () => {
    expect(rewriteTitleBasedWikilinks('[[Foo]]', '', 'Bar')).toBe('[[Foo]]')
  })
})

describe('getActiveWikilinkQuery', () => {
  it('detects open wikilink at cursor', () => {
    const result = getActiveWikilinkQuery('See [[Al', 8)
    expect(result).toEqual({ from: 4, to: 8, query: 'Al' })
  })

  it('returns null when no open wikilink', () => {
    expect(getActiveWikilinkQuery('No link', 7)).toBeNull()
  })

  it('returns null when wikilink is already closed', () => {
    expect(getActiveWikilinkQuery('See [[Alpha]] done', 14)).toBeNull()
  })

  it('returns null when query spans multiple lines', () => {
    expect(getActiveWikilinkQuery('See [[\nline', 10)).toBeNull()
  })

  it('finds the nearest open bracket', () => {
    const result = getActiveWikilinkQuery('[[Alpha]] and [[Bet', 20)
    expect(result).toEqual({ from: 14, to: 20, query: 'Bet' })
  })
})

describe('insertWikilinkSelection', () => {
  it('replaces open wikilink with completed one', () => {
    const query = getActiveWikilinkQuery('See [[Al', 8)!
    const result = insertWikilinkSelection('See [[Al', query, 'Alpha Note')
    expect(result.value).toBe('See [[Alpha Note]]')
    expect(result.cursor).toBe(18)
  })

  it('preserves text after the replaced portion', () => {
    const query = getActiveWikilinkQuery('[[Al more text', 4)!
    const result = insertWikilinkSelection('[[Al more text', query, 'Alpha')
    expect(result.value).toBe('[[Alpha]]more text')
  })
})

describe('getWikilinkText', () => {
  it('returns the text before the pipe', () => {
    expect(getWikilinkText('Alpha|display')).toBe('Alpha')
  })

  it('returns the full text when no pipe', () => {
    expect(getWikilinkText('Alpha')).toBe('Alpha')
  })

  it('trims whitespace', () => {
    expect(getWikilinkText(' Alpha ')).toBe('Alpha')
  })
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm --filter @zettelkasten/core exec vitest run tests/wikilinks.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the wikilinks module**

Create `packages/core/src/wikilinks.ts`:

```ts
const WIKILINK_EXTRACT_RE = /\[\[([^\]\|]+)(?:\|[^\]]*)?\]\]/g

export function extractWikilinkTitles(content: string): string[] {
  const titles: string[] = []
  let match: RegExpExecArray | null
  WIKILINK_EXTRACT_RE.lastIndex = 0
  while ((match = WIKILINK_EXTRACT_RE.exec(content)) !== null) {
    titles.push(match[1].trim())
  }
  return titles
}

export function rewriteTitleBasedWikilinks(content: string, oldTitle: string, newTitle: string): string {
  if (oldTitle === newTitle || oldTitle.trim() === '' || newTitle.trim() === '') {
    return content
  }

  return content.replace(/\[\[([^\[\]\|]+)(\|[^\[\]]*)?\]\]/g, (match, target: string, alias?: string) => {
    if (target !== oldTitle) {
      return match
    }
    return `[[${newTitle}${alias ?? ''}]]`
  })
}

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

  return { from: openIndex, to: cursor, query }
}

export function insertWikilinkSelection(
  value: string,
  activeQuery: ActiveWikilinkQuery,
  title: string,
): { value: string; cursor: number } {
  const replacement = `[[${title}]]`
  const nextValue = value.slice(0, activeQuery.from) + replacement + value.slice(activeQuery.to)
  return { value: nextValue, cursor: activeQuery.from + replacement.length }
}

export function getWikilinkText(value: string): string {
  return value.split('|')[0].trim()
}
```

- [ ] **Step 4: Export from `packages/core/src/index.ts`**

Add to `packages/core/src/index.ts`:

```ts
export * from './wikilinks'
```

- [ ] **Step 5: Run the tests and verify they pass**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm --filter @zettelkasten/core exec vitest run tests/wikilinks.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run full test suite and typecheck**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm test && pnpm typecheck
```

Expected: all tests pass, typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/wikilinks.ts packages/core/tests/wikilinks.test.ts packages/core/src/index.ts
git commit -m "Add wikilink helpers to shared core"
```

---

### Task 3: Update Desktop to Use Core Exports

**Files:**
- Modify: `apps/desktop/src/lib/wikilinks.ts`
- Modify: `apps/desktop/src/lib/note-workflow.ts`
- Modify: `apps/desktop/src/components/SourcePicker.tsx`

- [ ] **Step 1: Update desktop wikilinks.ts to re-export from core**

Replace the body of `apps/desktop/src/lib/wikilinks.ts` with re-exports from core plus the DOM-specific helpers that stay desktop-only:

```ts
import { marked } from 'marked'
import {
  getActiveWikilinkQuery,
  getWikilinkText,
  insertWikilinkSelection,
  type ActiveWikilinkQuery,
} from '@zettelkasten/core'

export { getActiveWikilinkQuery, getWikilinkText, insertWikilinkSelection }
export type { ActiveWikilinkQuery }

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function getWikilinkTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Node)) return null
  const element = target instanceof Element ? target : target.parentElement
  if (!element) return null
  const link = element.closest<HTMLElement>('[data-wikilink]')
  return link?.dataset.wikilink?.trim() || null
}

export function renderMarkdownPreview(content: string): string {
  const withRenderedWikilinks = content.replaceAll(WIKILINK_RE, (_match, rawTarget: string) => {
    const text = getWikilinkText(rawTarget)
    const escapedText = escapeHtml(text)
    return `<a href="#" class="rendered-wikilink" data-wikilink="${escapedText}" title="Ctrl+click to open: ${escapedText}">${escapedText}</a>`
  })
  return marked.parse(withRenderedWikilinks, { async: false }) as string
}
```

- [ ] **Step 2: Update desktop note-workflow.ts to import from core**

In `apps/desktop/src/lib/note-workflow.ts`, change imports to use core's wikilink functions:

```ts
import {
  addLink,
  canPromoteToLiterature,
  canSavePermanentNote,
  countNotesByType,
  createNote,
  extractWikilinkTitles,
  getLinkedNoteIds,
  removeLink,
  rewriteTitleBasedWikilinks,
  updateNote,
  type Database,
  type Note,
} from '@zettelkasten/core'
```

Remove the local `extractWikilinkTitles` function and the local `WIKILINK_EXTRACT_RE` constant (now imported from core). Remove the local `rewriteTitleBasedWikilinks` function (now imported from core).

- [ ] **Step 3: Update desktop SourcePicker.tsx to use core source functions**

In `apps/desktop/src/components/SourcePicker.tsx`:

Add imports:

```ts
import { createSource, deleteSource, getAllSources, countNotesBySource } from '@zettelkasten/core'
```

Replace the `useEffect` that loads sources:

```ts
useEffect(() => {
  getAllSources(db).then(setSources)
}, [db])
```

Replace `handleDelete`:

```ts
async function handleDelete(sourceId: string) {
  try {
    await deleteSource(db, sourceId)
  } catch (err) {
    window.alert(err instanceof Error ? err.message : 'Cannot delete source.')
    return
  }
  setSources((prev) => prev.filter((s) => s.id !== sourceId))
}
```

Replace `handleCreate`:

```ts
async function handleCreate() {
  if (!newLabel.trim()) return
  let source
  try {
    source = await createSource(db, {
      type: newType,
      label: newLabel.trim(),
      description: newDesc.trim() || undefined,
    })
  } catch (err) {
    console.error('Failed to create source:', err)
    return
  }
  setSources((prev) => [source, ...prev])
  onSelect(source.id)
  setCreating(false)
  setNewLabel('')
  setNewDesc('')
}
```

- [ ] **Step 4: Run full test suite and typecheck**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm test && pnpm typecheck
```

Expected: all tests pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/lib/wikilinks.ts apps/desktop/src/lib/note-workflow.ts apps/desktop/src/components/SourcePicker.tsx
git commit -m "Update desktop to use core source and wikilink exports"
```

---

## Phase 2: Mobile Scaffold

### Task 4: Initialize Expo Mobile App

**Files:**
- Create: `apps/mobile/` (full Expo project)

- [ ] **Step 1: Create the Expo project**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && npx create-expo-app@latest apps/mobile --template blank-typescript
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app/apps/mobile && npx expo install expo-router expo-sqlite expo-linking expo-constants expo-status-bar react-native-safe-area-context react-native-screens react-native-gesture-handler react-native-svg zustand @types/d3 d3-force
```

- [ ] **Step 3: Add core workspace dependency**

Add to `apps/mobile/package.json` dependencies:

```json
"@zettelkasten/core": "workspace:*"
```

Then run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm install
```

- [ ] **Step 4: Configure Expo Router**

Update `apps/mobile/app.json` to set the scheme and plugin:

```json
{
  "expo": {
    "name": "Zettelkasten",
    "slug": "zettelkasten",
    "scheme": "zettelkasten",
    "version": "0.1.0",
    "orientation": "default",
    "platforms": ["ios", "android"],
    "plugins": ["expo-router", "expo-sqlite"]
  }
}
```

- [ ] **Step 5: Verify the app boots**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app/apps/mobile && npx expo start --no-dev --minify 2>&1 | head -5
```

Expected: Expo starts without errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/
git commit -m "Initialize Expo mobile app with router and SQLite"
```

---

### Task 5: Create Mobile DB Adapter, Store, and Theme

**Files:**
- Create: `apps/mobile/src/db.ts`
- Create: `apps/mobile/src/store.ts`
- Create: `apps/mobile/src/theme.ts`
- Modify: `apps/mobile/package.json` (typecheck script)

- [ ] **Step 1: Create the expo-sqlite adapter**

Create `apps/mobile/src/db.ts`:

```ts
import * as SQLite from 'expo-sqlite'
import { runMigrations } from '@zettelkasten/core'
import type { Database } from '@zettelkasten/core'

let _db: SQLite.SQLiteDatabase | null = null

async function openDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync('zettelkasten.db')
    await _db.execAsync('PRAGMA foreign_keys = ON')
    await _db.withTransactionAsync(async () => {
      await runMigrations(adapter)
    })
  }
  return _db
}

const adapter: Database & {
  transaction<T>(work: (db: Database) => Promise<T>): Promise<T>
} = {
  async execute(sql: string, params: unknown[] = []) {
    const db = await openDb()
    if (params.length > 0) {
      await db.runAsync(sql, params as SQLite.SQLiteBindValues)
    } else {
      await db.execAsync(sql)
    }
  },
  async query<T>(sql: string, params: unknown[] = []) {
    const db = await openDb()
    return db.getAllAsync<T>(sql, params as SQLite.SQLiteBindValues)
  },
  async queryOne<T>(sql: string, params: unknown[] = []) {
    const db = await openDb()
    return db.getFirstAsync<T>(sql, params as SQLite.SQLiteBindValues) ?? null
  },
  async transaction<T>(work: (db: Database) => Promise<T>) {
    const db = await openDb()
    return db.withTransactionAsync(async () => {
      return work(adapter)
    })
  },
}

export async function getDb(): Promise<typeof adapter> {
  await openDb()
  return adapter
}
```

- [ ] **Step 2: Create the Zustand store**

Create `apps/mobile/src/store.ts`:

```ts
import { create } from 'zustand'
import type { Database, Note } from '@zettelkasten/core'
import { getDb } from './db'

interface AppState {
  db: Database | null
  activeNote: Note | null
  initialized: boolean
  initDb: () => Promise<void>
  setActiveNote: (note: Note | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  db: null,
  activeNote: null,
  initialized: false,
  initDb: async () => {
    const db = await getDb()
    set({ db, initialized: true })
  },
  setActiveNote: (note) => set({ activeNote: note }),
}))
```

- [ ] **Step 3: Create the theme**

Create `apps/mobile/src/theme.ts`:

```ts
import { StyleSheet } from 'react-native'

export const BG = {
  base: '#111318',
  panel: '#171a20',
  raised: '#1d2128',
  canvas: '#0d0f13',
  hover: '#222730',
} as const

export const BORDER = {
  faint: '#232831',
  base: '#2b313c',
  strong: '#3a4350',
} as const

export const TEXT = {
  primary: '#e7e0d1',
  secondary: '#b4ab99',
  muted: '#7f7a70',
  faint: '#5e5b55',
} as const

export const ACCENT = {
  ink: '#8f98a8',
  inkSoft: 'rgba(143,152,168,0.14)',
  fleeting: '#9a7a5a',
  literature: '#6d8394',
  permanent: '#8d879f',
  success: '#6d8e7a',
  danger: '#b06c68',
} as const

export const FONT = {
  display: 'System',
  ui: 'System',
  mono: 'Menlo',
} as const

export function typeColor(type: string): string {
  if (type === 'fleeting') return ACCENT.fleeting
  if (type === 'literature') return ACCENT.literature
  return ACCENT.permanent
}

export const glassStyle = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(23, 26, 32, 0.85)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER.base,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: 'rgba(23, 26, 32, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: BORDER.faint,
  },
  pill: {
    backgroundColor: 'rgba(29, 33, 40, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: BORDER.base,
  },
  tabBar: {
    backgroundColor: 'rgba(17, 19, 24, 0.9)',
    borderTopWidth: 1,
    borderTopColor: BORDER.faint,
  },
})
```

- [ ] **Step 4: Verify typecheck passes**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm --filter @zettelkasten/mobile typecheck
```

Expected: PASS (may need to add `"typecheck": "tsc --noEmit"` to mobile's package.json scripts first).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/
git commit -m "Add mobile DB adapter, Zustand store, and theme"
```

---

### Task 6: Wire Up Expo Router Layouts

**Files:**
- Create: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/app/(tabs)/index.tsx` (inbox placeholder)
- Create: `apps/mobile/app/(tabs)/workspace.tsx`
- Create: `apps/mobile/app/(tabs)/library.tsx`
- Create: `apps/mobile/app/(tabs)/graph.tsx`
- Create: `apps/mobile/app/trash.tsx`
- Create: `apps/mobile/app/note/[id].tsx`

- [ ] **Step 1: Create root layout with DB initialization**

Create `apps/mobile/app/_layout.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { View, ActivityIndicator, Text } from 'react-native'
import { useAppStore } from '../src/store'
import { BG, TEXT, FONT } from '../src/theme'

export default function RootLayout() {
  const { initialized, initDb } = useAppStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    initDb().catch((err) => setError(err instanceof Error ? err.message : 'DB init failed'))
  }, [])

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG.base }}>
        <Text style={{ color: TEXT.danger, fontFamily: FONT.ui }}>{error}</Text>
      </View>
    )
  }

  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG.base }}>
        <ActivityIndicator color={TEXT.primary} />
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: BG.base } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="trash" options={{ presentation: 'modal', headerShown: true, headerTitle: 'Trash', headerTintColor: TEXT.primary, headerStyle: { backgroundColor: BG.panel } }} />
      <Stack.Screen name="note/[id]" options={{ headerShown: true, headerTitle: 'Note', headerTintColor: TEXT.primary, headerStyle: { backgroundColor: BG.panel } }} />
    </Stack>
  )
}
```

- [ ] **Step 2: Create tab navigator layout**

Create `apps/mobile/app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from 'expo-router'
import { BG, TEXT, BORDER, FONT, ACCENT, glassStyle } from '../../src/theme'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: TEXT.primary,
        tabBarInactiveTintColor: TEXT.muted,
        tabBarLabelStyle: { fontFamily: FONT.ui, fontSize: 11 },
        tabBarStyle: [glassStyle.tabBar, { position: 'absolute' }],
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inbox', tabBarIcon: () => null }} />
      <Tabs.Screen name="workspace" options={{ title: 'Editor', tabBarIcon: () => null }} />
      <Tabs.Screen name="library" options={{ title: 'Library', tabBarIcon: () => null }} />
      <Tabs.Screen name="graph" options={{ title: 'Graph', tabBarIcon: () => null }} />
    </Tabs>
  )
}
```

- [ ] **Step 3: Create placeholder screens**

Create `apps/mobile/app/(tabs)/index.tsx`:

```tsx
import { View, Text } from 'react-native'
import { BG, TEXT, FONT } from '../../src/theme'

export default function InboxScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG.base }}>
      <Text style={{ color: TEXT.primary, fontFamily: FONT.ui, fontSize: 20 }}>Inbox</Text>
    </View>
  )
}
```

Create `apps/mobile/app/(tabs)/workspace.tsx`:

```tsx
import { View, Text } from 'react-native'
import { BG, TEXT, FONT } from '../../src/theme'

export default function WorkspaceScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG.base }}>
      <Text style={{ color: TEXT.primary, fontFamily: FONT.ui, fontSize: 20 }}>Workspace</Text>
    </View>
  )
}
```

Create `apps/mobile/app/(tabs)/library.tsx`:

```tsx
import { View, Text } from 'react-native'
import { BG, TEXT, FONT } from '../../src/theme'

export default function LibraryScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG.base }}>
      <Text style={{ color: TEXT.primary, fontFamily: FONT.ui, fontSize: 20 }}>Library</Text>
    </View>
  )
}
```

Create `apps/mobile/app/(tabs)/graph.tsx`:

```tsx
import { View, Text } from 'react-native'
import { BG, TEXT, FONT } from '../../src/theme'

export default function GraphScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG.base }}>
      <Text style={{ color: TEXT.primary, fontFamily: FONT.ui, fontSize: 20 }}>Graph</Text>
    </View>
  )
}
```

Create `apps/mobile/app/trash.tsx`:

```tsx
import { View, Text } from 'react-native'
import { BG, TEXT, FONT } from '../src/theme'

export default function TrashScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG.base }}>
      <Text style={{ color: TEXT.primary, fontFamily: FONT.ui, fontSize: 20 }}>Trash</Text>
    </View>
  )
}
```

Create `apps/mobile/app/note/[id].tsx`:

```tsx
import { View, Text } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { BG, TEXT, FONT } from '../../src/theme'

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG.base }}>
      <Text style={{ color: TEXT.primary, fontFamily: FONT.ui, fontSize: 20 }}>Note: {id}</Text>
    </View>
  )
}
```

- [ ] **Step 4: Verify typecheck**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/
git commit -m "Wire up Expo Router layouts with placeholder screens"
```

---

## Phase 3: Mobile Screens

### Task 7: Mobile Note Workflow Library

**Files:**
- Create: `apps/mobile/src/lib/note-workflow.ts`
- Create: `apps/mobile/src/lib/graph.ts`

- [ ] **Step 1: Create the note-workflow library**

Create `apps/mobile/src/lib/note-workflow.ts` — copy from desktop's `apps/desktop/src/lib/note-workflow.ts` with the same imports from `@zettelkasten/core`. The file is identical in structure since both platforms implement the `Database` + `transaction()` interface.

- [ ] **Step 2: Create the graph neighborhood helper**

Create `apps/mobile/src/lib/graph.ts` — copy from desktop's `apps/desktop/src/lib/graph.ts`:

```ts
import type { Note, NoteLink } from '@zettelkasten/core'

export interface GraphNode {
  id: string
  title: string
  type: string
}

export interface GraphEdge {
  source: string
  target: string
}

export function buildNeighborhood(
  focusNoteId: string | null,
  notes: Note[],
  links: NoteLink[],
  maxDepth: number = 2,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (!focusNoteId || notes.length === 0) {
    return {
      nodes: notes.map((n) => ({ id: n.id, title: n.title, type: n.type })),
      edges: [],
    }
  }

  const adjacency = new Map<string, Set<string>>()
  for (const link of links) {
    let neighbors = adjacency.get(link.from_note_id)
    if (!neighbors) {
      neighbors = new Set()
      adjacency.set(link.from_note_id, neighbors)
    }
    neighbors.add(link.to_note_id)

    let reverseNeighbors = adjacency.get(link.to_note_id)
    if (!reverseNeighbors) {
      reverseNeighbors = new Set()
      adjacency.set(link.to_note_id, reverseNeighbors)
    }
    reverseNeighbors.add(link.from_note_id)
  }

  const visited = new Set<string>()
  const queue: Array<{ id: string; depth: number }> = [{ id: focusNoteId, depth: 0 }]
  visited.add(focusNoteId)

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    if (depth >= maxDepth) continue

    const neighbors = adjacency.get(id)
    if (!neighbors) continue

    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId)
        queue.push({ id: neighborId, depth: depth + 1 })
      }
    }
  }

  const noteMap = new Map(notes.map((n) => [n.id, n]))
  const nodes: GraphNode[] = []
  for (const id of visited) {
    const note = noteMap.get(id)
    if (note) nodes.push({ id: note.id, title: note.title, type: note.type })
  }

  const edges: GraphEdge[] = []
  for (const link of links) {
    if (visited.has(link.from_note_id) && visited.has(link.to_note_id)) {
      edges.push({ source: link.from_note_id, target: link.to_note_id })
    }
  }

  return { nodes, edges }
}
```

- [ ] **Step 3: Verify typecheck**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/
git commit -m "Add mobile note-workflow and graph helpers"
```

---

### Task 8: Inbox Screen

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx`
- Create: `apps/mobile/src/components/NoteCard.tsx`

- [ ] **Step 1: Create the NoteCard component**

Create `apps/mobile/src/components/NoteCard.tsx` with:
- Glass card background
- Title, content preview (first line), relative time
- Swipeable: right swipe reveals "Process" action
- Tap opens note in workspace
- Uses theme tokens

- [ ] **Step 2: Implement the full Inbox screen**

Update `apps/mobile/app/(tabs)/index.tsx` with:
- Translucent header with "Inbox" title + note count badge
- Quick capture card (glass panel): title input + body textarea + "Capture" button (same as desktop)
- Unique title check via `ensureUniqueActiveTitle` before create
- Scrollable list of fleeting NoteCards
- Floating action button ("+ New" glass pill): opens menu for new literature / new permanent
- Pull-to-refresh reloads notes

- [ ] **Step 3: Verify typecheck**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/
git commit -m "Implement Inbox screen with capture and note list"
```

---

### Task 9: Workspace Screen (Universal Editor)

**Files:**
- Modify: `apps/mobile/app/(tabs)/workspace.tsx`
- Create: `apps/mobile/src/components/MarkdownInput.tsx`
- Create: `apps/mobile/src/components/SourcePicker.tsx`
- Create: `apps/mobile/src/components/LinkPicker.tsx`

- [ ] **Step 1: Create MarkdownInput component**

Create `apps/mobile/src/components/MarkdownInput.tsx` with:
- `TextInput` (multiline) for editing
- Toggle button: "Edit" / "Preview"
- Preview mode renders markdown using react-native-markdown-display with wikilink highlighting
- Wikilink autocomplete: when user types `[[`, show a filtered picker above/below the input
- Accepts `value`, `onChange`, `wikilinkOptions` props

- [ ] **Step 2: Create SourcePicker bottom sheet**

Create `apps/mobile/src/components/SourcePicker.tsx` with:
- `@gorhom/bottom-sheet` or Expo's built-in Modal
- Search input filtering sources by label
- Source list using `getAllSources` from core
- "Create New Source" form (type picker + label input + description input) using `createSource` from core
- Delete button with usage guard (`countNotesBySource`)
- Selection callback

- [ ] **Step 3: Create LinkPicker bottom sheet**

Create `apps/mobile/src/components/LinkPicker.tsx` with:
- Bottom sheet listing permanent notes (from `getNotesByType(db, 'permanent')`)
- Search filtering by title
- Multi-select toggle for each note
- Selection callback returning array of selected IDs

- [ ] **Step 4: Implement the full Workspace screen**

Update `apps/mobile/app/(tabs)/workspace.tsx` with:
- Empty state: prompt to select a note or create new
- Title input + MarkdownInput for body
- Source picker button (opens bottom sheet) — shown for literature notes
- "Own words" checkbox — shown for literature notes being promoted
- Link picker button (opens bottom sheet) — shown for permanent note creation
- Action buttons at bottom: "Promote to Literature" / "Save as Permanent" / "Delete" (glass pills)
- Autosave with 450ms debounce (same logic as desktop)
- Wikilink autocomplete using `getActiveWikilinkQuery` from core
- Back gesture shows recent notes list

- [ ] **Step 5: Verify typecheck**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/
git commit -m "Implement Workspace screen with editor, source/link pickers"
```

---

### Task 10: Library Screen

**Files:**
- Modify: `apps/mobile/app/(tabs)/library.tsx`

- [ ] **Step 1: Implement the Library screen**

Update `apps/mobile/app/(tabs)/library.tsx` with:
- Translucent search bar at top
- Query processed literature notes: `SELECT n.*, s.label as source_label FROM notes n LEFT JOIN sources s ON n.source_id = s.id WHERE n.processed_at IS NOT NULL AND n.deleted_at IS NULL ORDER BY n.updated_at DESC`
- Each item: glass card with title, source label, processed date
- Tap navigates to workspace with that note
- Search filters by title
- Pull-to-refresh

- [ ] **Step 2: Verify typecheck**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/
git commit -m "Implement Library screen with search and note list"
```

---

### Task 11: Graph Screen

**Files:**
- Modify: `apps/mobile/app/(tabs)/graph.tsx`
- Create: `apps/mobile/src/components/GraphCanvas.tsx`

- [ ] **Step 1: Create GraphCanvas component**

Create `apps/mobile/src/components/GraphCanvas.tsx` with:
- `react-native-svg` `<Svg>` component filling the screen
- D3-force simulation (`forceLink`, `forceManyBody`, `forceCenter`) driving node positions
- Nodes rendered as `<Circle>` with type-based colors from `typeColor()`
- Edges rendered as `<Line>`
- `GestureHandler` for pinch-to-zoom and drag-to-pan
- Tap on node fires selection callback
- Labels as `<Text>` elements near each node

- [ ] **Step 2: Implement the Graph screen**

Update `apps/mobile/app/(tabs)/graph.tsx` with:
- Full-screen GraphCanvas
- Load permanent notes via `getNotesByType(db, 'permanent')`
- Load links via `getAllLinks(db)`
- Translucent search overlay at top (filters visible nodes)
- Selected node detail: glass card overlay at bottom (title, type badge, link count, "Open" button)
- "Open" navigates to workspace with that note

- [ ] **Step 3: Verify typecheck**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/
git commit -m "Implement Graph screen with SVG force-directed layout"
```

---

### Task 12: Trash Screen

**Files:**
- Modify: `apps/mobile/app/trash.tsx`

- [ ] **Step 1: Implement the Trash screen**

Update `apps/mobile/app/trash.tsx` with:
- Query soft-deleted notes: `SELECT * FROM notes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`
- Each item: glass card with title, type badge, deletion date
- Swipe right: "Restore" (calls `restoreNote`)
- Swipe left: "Delete Permanently" with confirmation Alert (calls `permanentlyDeleteNote`)
- Empty state: "Trash is empty"

- [ ] **Step 2: Verify typecheck**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/
git commit -m "Implement Trash screen with restore and permanent delete"
```

---

### Task 13: Note Deep Link Screen

**Files:**
- Modify: `apps/mobile/app/note/[id].tsx`

- [ ] **Step 1: Implement the note deep link screen**

Update `apps/mobile/app/note/[id].tsx` with:
- Reads `id` from route params
- Loads note via `getNoteById(db, id)`
- Renders inline workspace editor (reuses MarkdownInput, source/link pickers)
- If note not found, shows "Note not found" with back navigation

- [ ] **Step 2: Verify typecheck**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/
git commit -m "Implement note deep link screen"
```

---

### Task 14: Final Verification

- [ ] **Step 1: Run full monorepo typecheck**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm typecheck
```

Expected: all packages typecheck clean.

- [ ] **Step 2: Run full test suite**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm test
```

Expected: all core and desktop tests pass.

- [ ] **Step 3: Push**

```bash
git push
```
