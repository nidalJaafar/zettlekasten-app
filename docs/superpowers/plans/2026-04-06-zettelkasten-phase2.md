# Zettelkasten Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix seven Phase 1 issues — process button navigation, SourcePicker form order, graph note modal, Library screen for processed literature notes, graph physics tuning, and visual overhaul.

**Architecture:** Core gets a `processed_at` field on `Note` (schema migration + type update). The desktop app gains a Library screen, a NoteModal overlay, and prop-based note passing between App.tsx and ReviewScreen. All UI changes are in `apps/desktop`; no new packages.

**Tech Stack:** TypeScript, React 18, Tauri v2, D3 v7, sql.js (tests), Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/core/src/types.ts` | Modify | Add `processed_at: number \| null` to Note |
| `packages/core/src/schema.ts` | Modify | Add column to CREATE TABLE + safe ALTER TABLE migration |
| `packages/core/src/notes.ts` | Modify | Include `processed_at` in createNote INSERT + updateNote pick |
| `packages/core/tests/notes.test.ts` | Modify | Tests for processed_at field |
| `apps/desktop/src/App.tsx` | Modify | pendingReviewNote, openNote state; all event handlers; Library routing; NoteModal render |
| `apps/desktop/src/components/NoteModal.tsx` | Create | Centered overlay modal for permanent note content |
| `apps/desktop/src/components/Sidebar.tsx` | Modify | Add Library nav item between Review and Graph |
| `apps/desktop/src/components/SourcePicker.tsx` | Modify | Reorder creation form: label → type → description |
| `apps/desktop/src/components/GraphCanvas.tsx` | Modify | Tune D3 force parameters |
| `apps/desktop/src/screens/ReviewScreen.tsx` | Modify | pendingNote prop; filter processed literature from queue; mark processed on save |
| `apps/desktop/src/screens/LibraryScreen.tsx` | Create | Processed literature notes with expand-to-read |

---

## Task 1: Core — add processed_at field

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/schema.ts`
- Modify: `packages/core/src/notes.ts`
- Modify: `packages/core/tests/notes.test.ts`

- [ ] **Step 1: Add processed_at to Note type**

Replace `packages/core/src/types.ts` with:

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
  processed_at: number | null
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

- [ ] **Step 2: Update schema with processed_at column and safe migration**

Replace `packages/core/src/schema.ts` with:

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
    deleted_at INTEGER,
    processed_at INTEGER
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
  // Safe migration: add processed_at to existing tables that predate this column
  const cols = await db.query<{ name: string }>(`PRAGMA table_info(notes)`)
  if (!cols.find((c) => c.name === 'processed_at')) {
    await db.execute(`ALTER TABLE notes ADD COLUMN processed_at INTEGER`)
  }
}
```

- [ ] **Step 3: Update notes.ts to include processed_at**

Replace `packages/core/src/notes.ts` with:

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
    processed_at: null,
  }
  await db.execute(
    `INSERT INTO notes (id, type, title, content, created_at, updated_at, source_id, own_words_confirmed, deleted_at, processed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [note.id, note.type, note.title, note.content, note.created_at, note.updated_at,
     note.source_id, note.own_words_confirmed, note.deleted_at, note.processed_at]
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
  updates: Partial<Pick<Note, 'title' | 'content' | 'type' | 'source_id' | 'own_words_confirmed' | 'processed_at'>>
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

- [ ] **Step 4: Add tests for processed_at**

In `packages/core/tests/notes.test.ts`, add these two test cases — one inside the existing `describe('createNote')` block and one inside `describe('updateNote')`:

```typescript
// Inside describe('createNote'):
it('sets processed_at to null by default', async () => {
  const note = await createNote(db, { type: 'fleeting', title: 'Unprocessed' })
  expect(note.processed_at).toBeNull()
})

// Inside describe('updateNote'):
it('can set processed_at', async () => {
  const note = await createNote(db, { type: 'literature', title: 'To process' })
  const ts = Date.now()
  await updateNote(db, note.id, { processed_at: ts })
  const updated = await getNoteById(db, note.id)
  expect(updated?.processed_at).toBe(ts)
})
```

- [ ] **Step 5: Run tests**

```bash
pnpm test
```

Expected output:
```
Test Files  3 passed (3)
      Tests  27 passed (27)
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/schema.ts packages/core/src/notes.ts packages/core/tests/notes.test.ts
git commit -m "feat(core): add processed_at to Note type, schema migration, and CRUD"
```

---

## Task 2: ReviewScreen — filter queue + mark processed

**Files:**
- Modify: `apps/desktop/src/screens/ReviewScreen.tsx`

Two changes: (1) literature notes with `processed_at` set are excluded from the review queue, (2) after creating a permanent note, the source literature note is marked processed.

- [ ] **Step 1: Update loadQueue to filter out processed literature notes**

In `ReviewScreen.tsx`, replace the `loadQueue` callback:

```typescript
const loadQueue = useCallback(async () => {
  const fleeting = await getNotesByType(db, 'fleeting')
  const literature = await db.query<Note>(
    `SELECT * FROM notes WHERE type = 'literature' AND processed_at IS NULL AND deleted_at IS NULL ORDER BY created_at ASC`
  )
  setQueue([...fleeting, ...literature])
}, [db])
```

- [ ] **Step 2: Mark literature note as processed after saving permanent**

In `handleSavePermanent`, after the `addLink` loop and before `setCurrent(null)`, add:

```typescript
// Mark the literature note as processed — it moves to Library
await updateNote(db, current.id, { processed_at: Date.now() })
```

The final shape of `handleSavePermanent`:

```typescript
async function handleSavePermanent() {
  if (!current) return
  const totalPermanent = await countNotesByType(db, 'permanent')
  const check = canSavePermanentNote(
    { own_words_confirmed: ownWords ? 1 : 0 },
    { linkedPermanentNoteIds: linkedIds, totalPermanentNotes: totalPermanent }
  )
  if (!check.ok) { setBlockReason(check.reason); return }

  const permanent = await createNote(db, { type: 'permanent', title, content })
  await updateNote(db, permanent.id, { own_words_confirmed: 1 })
  for (const id of linkedIds) {
    await addLink(db, permanent.id, id)
  }
  await updateNote(db, current.id, { processed_at: Date.now() })
  setCurrent(null)
  setBlockReason(null)
  await loadQueue()
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @zettelkasten/desktop typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/screens/ReviewScreen.tsx
git commit -m "feat(desktop): filter processed literature from review queue, mark on permanent save"
```

---

## Task 3: Fix process button — pendingReviewNote prop flow

**Root cause:** `InboxScreen` fires `zettel:review` but `ReviewScreen` is not yet mounted (user is on Inbox), so its event listener never fires.

**Fix:** `App.tsx` owns a `pendingReviewNote` state. It listens to `zettel:review`, stores the note, navigates to Review. `ReviewScreen` receives `pendingNote` and `onNoteConsumed` props, and calls `selectNote` on mount when they arrive.

**Files:**
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/screens/ReviewScreen.tsx`

- [ ] **Step 1: Update App.tsx**

Replace `apps/desktop/src/App.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import { getDb } from './db'
import { runMigrations } from '@zettelkasten/core'
import type { Database, Note } from '@zettelkasten/core'
import Sidebar from './components/Sidebar'
import InboxScreen from './screens/InboxScreen'
import ReviewScreen from './screens/ReviewScreen'
import GraphScreen from './screens/GraphScreen'

export type Screen = 'inbox' | 'review' | 'library' | 'graph'

export default function App() {
  const [db, setDb] = useState<Database | null>(null)
  const [dbError, setDbError] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>('inbox')
  const [inboxCount, setInboxCount] = useState(0)
  const [pendingReviewNote, setPendingReviewNote] = useState<Note | null>(null)

  useEffect(() => {
    getDb().then(async (database) => {
      await runMigrations(database)
      setDb(database)
    }).catch((err) => {
      setDbError(String(err))
    })
  }, [])

  useEffect(() => {
    const handleReview = (e: Event) => {
      const note = (e as CustomEvent<Note>).detail
      setPendingReviewNote(note)
      setScreen('review')
    }
    const handleNewLiterature = () => setScreen('review')
    const handleNewPermanent = () => setScreen('review')
    window.addEventListener('zettel:review', handleReview)
    window.addEventListener('zettel:new-literature', handleNewLiterature)
    window.addEventListener('zettel:new-permanent', handleNewPermanent)
    return () => {
      window.removeEventListener('zettel:review', handleReview)
      window.removeEventListener('zettel:new-literature', handleNewLiterature)
      window.removeEventListener('zettel:new-permanent', handleNewPermanent)
    }
  }, [])

  if (dbError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#ff6b81', fontSize: 13, padding: 24, textAlign: 'center' }}>
        Database error: {dbError}
      </div>
    )
  }

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
        {screen === 'review' && (
          <ReviewScreen
            db={db}
            pendingNote={pendingReviewNote}
            onNoteConsumed={() => setPendingReviewNote(null)}
          />
        )}
        {screen === 'graph' && <GraphScreen db={db} />}
      </main>
    </div>
  )
}
```

Note: `library` is in the `Screen` type already — the route and import will be added in Task 4.

- [ ] **Step 2: Add pendingNote props to ReviewScreen**

Add the two props to the `Props` interface and add a `useEffect` that watches `pendingNote`:

```typescript
interface Props {
  db: Database
  pendingNote?: Note | null
  onNoteConsumed?: () => void
}

export default function ReviewScreen({ db, pendingNote, onNoteConsumed }: Props) {
  // ... existing state declarations unchanged ...

  // Add this effect after the existing zettel:review useEffect:
  useEffect(() => {
    if (pendingNote) {
      selectNote(pendingNote)
      onNoteConsumed?.()
    }
  }, [pendingNote, selectNote, onNoteConsumed])

  // ... rest of component unchanged ...
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @zettelkasten/desktop typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/App.tsx apps/desktop/src/screens/ReviewScreen.tsx
git commit -m "fix(desktop): process button navigation via pendingReviewNote prop"
```

---

## Task 4: Library screen + Sidebar

**Files:**
- Create: `apps/desktop/src/screens/LibraryScreen.tsx`
- Modify: `apps/desktop/src/components/Sidebar.tsx`
- Modify: `apps/desktop/src/App.tsx` (add import + route)

- [ ] **Step 1: Create LibraryScreen.tsx**

Create `apps/desktop/src/screens/LibraryScreen.tsx`:

```tsx
import { useEffect, useState } from 'react'
import type { Database, Note } from '@zettelkasten/core'

interface LibraryNote extends Note {
  source_label: string | null
}

interface Props {
  db: Database
}

export default function LibraryScreen({ db }: Props) {
  const [notes, setNotes] = useState<LibraryNote[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    db.query<LibraryNote>(`
      SELECT n.*, s.label as source_label
      FROM notes n
      LEFT JOIN sources s ON n.source_id = s.id
      WHERE n.processed_at IS NOT NULL AND n.deleted_at IS NULL
      ORDER BY n.processed_at DESC
    `).then(setNotes)
  }, [db])

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1a1a2e' }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #2a2a4a' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#e0e0ff' }}>Library</div>
        <div style={{ fontSize: 12, color: '#7f8fa6' }}>{notes.length} processed notes</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notes.length === 0 ? (
          <div style={{ color: '#555', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
            No processed notes yet. Complete a review cycle to see notes here.
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              style={{ background: '#22223a', border: '1px solid #3d3d6b', borderRadius: 8, overflow: 'hidden' }}
            >
              <button
                onClick={() => setExpandedId(expandedId === note.id ? null : note.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 14px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e0ff' }}>{note.title}</div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                    {note.source_label ?? 'No source'} · {formatDate(note.processed_at!)}
                  </div>
                </div>
                <span style={{ color: '#555', fontSize: 11 }}>{expandedId === note.id ? '▲' : '▼'}</span>
              </button>
              {expandedId === note.id && (
                <div style={{
                  padding: '10px 14px 12px',
                  fontSize: 12,
                  color: '#7f8fa6',
                  lineHeight: 1.6,
                  borderTop: '1px solid #2a2a4a',
                  whiteSpace: 'pre-wrap',
                }}>
                  {note.content || <span style={{ fontStyle: 'italic' }}>No content.</span>}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update Sidebar.tsx**

Replace the `items` array to add Library between Review and Graph:

```typescript
import type { Screen } from '../App'

interface Props {
  current: Screen
  onNavigate: (screen: Screen) => void
  inboxCount: number
}

const items: { id: Screen; label: string; icon: string }[] = [
  { id: 'inbox', label: 'Inbox', icon: '📥' },
  { id: 'review', label: 'Review', icon: '🔄' },
  { id: 'library', label: 'Library', icon: '📚' },
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

- [ ] **Step 3: Add Library route to App.tsx**

Add the import and route to `apps/desktop/src/App.tsx`. Add after the existing imports:

```typescript
import LibraryScreen from './screens/LibraryScreen'
```

In the `<main>` block, add the Library route after the review route:

```tsx
{screen === 'library' && <LibraryScreen db={db} />}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @zettelkasten/desktop typecheck
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/screens/LibraryScreen.tsx apps/desktop/src/components/Sidebar.tsx apps/desktop/src/App.tsx
git commit -m "feat(desktop): library screen for processed literature notes"
```

---

## Task 5: NoteModal + fix graph "Open note"

**Root cause:** `App.tsx` handles `zettel:open-note` by navigating to review with no note. Fix: store the note in `openNote` state and render a modal overlay.

**Files:**
- Create: `apps/desktop/src/components/NoteModal.tsx`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Create NoteModal.tsx**

Create `apps/desktop/src/components/NoteModal.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { getAllLinks, getNotesByType } from '@zettelkasten/core'
import type { Database, Note, NoteLink } from '@zettelkasten/core'

interface Props {
  db: Database
  note: Note
  onClose: () => void
}

export default function NoteModal({ db, note, onClose }: Props) {
  const [noteLinks, setNoteLinks] = useState<NoteLink[]>([])
  const [linkedNotes, setLinkedNotes] = useState<Note[]>([])

  useEffect(() => {
    Promise.all([getAllLinks(db), getNotesByType(db, 'permanent')]).then(([allLinks, permanents]) => {
      const connected = allLinks.filter(
        (l) => l.from_note_id === note.id || l.to_note_id === note.id
      )
      const connectedIds = new Set(connected.flatMap((l) => [l.from_note_id, l.to_note_id]))
      connectedIds.delete(note.id)
      setNoteLinks(connected)
      setLinkedNotes(permanents.filter((p) => connectedIds.has(p.id)))
    })
  }, [db, note.id])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1a1a2e',
          border: '1px solid #3d3d6b',
          borderRadius: 12,
          padding: 28,
          width: 520,
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'transparent',
            border: 'none',
            color: '#555',
            fontSize: 18,
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          ✕
        </button>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#6c63ff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          Permanent note
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#e0e0ff', marginBottom: 16, paddingRight: 24 }}>
          {note.title}
        </div>

        {note.content ? (
          <div style={{ fontSize: 13, color: '#b0b0cc', lineHeight: 1.75, marginBottom: 24, whiteSpace: 'pre-wrap' }}>
            {note.content}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#555', fontStyle: 'italic', marginBottom: 24 }}>
            No content.
          </div>
        )}

        <div style={{ borderTop: '1px solid #2a2a4a', paddingTop: 16 }}>
          <div style={{ fontSize: 11, color: '#7f8fa6', marginBottom: 8 }}>
            {noteLinks.length} connection{noteLinks.length !== 1 ? 's' : ''}
          </div>
          {linkedNotes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {linkedNotes.map((n) => (
                <div
                  key={n.id}
                  style={{
                    fontSize: 12,
                    color: '#7f8fa6',
                    padding: '5px 10px',
                    background: '#22223a',
                    borderRadius: 5,
                    border: '1px solid #3d3d6b',
                  }}
                >
                  {n.title}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update App.tsx to use NoteModal**

Add `openNote` state and render `NoteModal`. Also update the `zettel:open-note` handler to store the note instead of navigating.

Add this import to the imports in `App.tsx`:

```typescript
import NoteModal from './components/NoteModal'
```

Add `openNote` state inside the component (alongside existing state):

```typescript
const [openNote, setOpenNote] = useState<Note | null>(null)
```

In the `useEffect` that handles navigation events, replace the `zettel:open-note` handler (currently it just calls `setScreen('review')`) with:

```typescript
const handleOpenNote = (e: Event) => {
  const note = (e as CustomEvent<Note>).detail
  setOpenNote(note)
}
window.addEventListener('zettel:open-note', handleOpenNote)
// add to cleanup:
window.removeEventListener('zettel:open-note', handleOpenNote)
```

Remove the old `zettel:open-note` listener that called `setScreen('review')`.

After the `</div>` closing the main layout, and before the closing of the outer `return`, add:

```tsx
{openNote && (
  <NoteModal db={db} note={openNote} onClose={() => setOpenNote(null)} />
)}
```

The complete updated return block:

```tsx
return (
  <div style={{ display: 'flex', height: '100vh' }}>
    <Sidebar current={screen} onNavigate={setScreen} inboxCount={inboxCount} />
    <main style={{ flex: 1, overflow: 'hidden' }}>
      {screen === 'inbox' && <InboxScreen db={db} onCountChange={setInboxCount} />}
      {screen === 'review' && (
        <ReviewScreen
          db={db}
          pendingNote={pendingReviewNote}
          onNoteConsumed={() => setPendingReviewNote(null)}
        />
      )}
      {screen === 'library' && <LibraryScreen db={db} />}
      {screen === 'graph' && <GraphScreen db={db} />}
    </main>
    {openNote && (
      <NoteModal db={db} note={openNote} onClose={() => setOpenNote(null)} />
    )}
  </div>
)
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @zettelkasten/desktop typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/NoteModal.tsx apps/desktop/src/App.tsx
git commit -m "feat(desktop): note modal overlay for permanent notes from graph"
```

---

## Task 6: SourcePicker form reorder

**File:**
- Modify: `apps/desktop/src/components/SourcePicker.tsx`

**Change:** In the creation form (the `creating === true` branch), reorder the fields to: label first, type select second, description third.

- [ ] **Step 1: Reorder form fields**

Replace the `creating` branch in `SourcePicker.tsx` (the `<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>` block):

```tsx
) : (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <input
      value={newLabel}
      onChange={(e) => setNewLabel(e.target.value)}
      placeholder="Label (e.g. Thinking, Fast and Slow)"
      style={inputStyle}
      autoFocus
    />
    <select
      value={newType}
      onChange={(e) => setNewType(e.target.value as SourceType)}
      style={{ ...inputStyle, cursor: 'pointer' }}
    >
      {SOURCE_TYPES.map((t) => (
        <option key={t} value={t}>{ICONS[t]} {t}</option>
      ))}
    </select>
    <input
      value={newDesc}
      onChange={(e) => setNewDesc(e.target.value)}
      placeholder="Description (optional)"
      style={inputStyle}
    />
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        onClick={handleCreate}
        style={{ flex: 1, background: '#6c63ff', color: 'white', border: 'none', borderRadius: 6, padding: '7px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
      >
        Create source
      </button>
      <button
        onClick={() => setCreating(false)}
        style={{ background: '#22223a', color: '#7f8fa6', border: '1px solid #3d3d6b', borderRadius: 6, padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}
      >
        Cancel
      </button>
    </div>
  </div>
)}
```

Note the `autoFocus` added to the label input — the cursor lands on the name field immediately when the form opens.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @zettelkasten/desktop typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/SourcePicker.tsx
git commit -m "fix(desktop): source picker form order — label first, type second"
```

---

## Task 7: Graph physics tuning

**File:**
- Modify: `apps/desktop/src/components/GraphCanvas.tsx`

**Problem:** Nodes fly apart aggressively on load (`-200` charge), and dragging yanks the whole graph (`alphaTarget(0.3)` too high).

- [ ] **Step 1: Update D3 force parameters**

Replace the `simulation` declaration in `GraphCanvas.tsx`:

```typescript
const simulation = d3.forceSimulation<GraphNode>(nodes)
  .force('link', d3.forceLink<GraphNode, GraphEdge>(edges).id((d) => d.id).distance(80))
  .force('charge', d3.forceManyBody().strength(-80))
  .force('center', d3.forceCenter(width / 2, height / 2))
  .force('collision', d3.forceCollide<GraphNode>().radius((d) => radiusScale(d.linkCount) + 4))
  .alphaDecay(0.04)
  .velocityDecay(0.5)
```

Replace the drag `start` handler's `alphaTarget`:

```typescript
.on('start', (event, d) => {
  if (!event.active) simulation.alphaTarget(0.1).restart()
  d.fx = d.x; d.fy = d.y
})
```

Summary of changes vs current:

| Parameter | Old | New |
|---|---|---|
| `distance` | 100 | 80 |
| `strength` | -200 | -80 |
| `alphaDecay` | default 0.0228 | 0.04 |
| `velocityDecay` | default 0.4 | 0.5 |
| drag `alphaTarget` | 0.3 | 0.1 |

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @zettelkasten/desktop typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/GraphCanvas.tsx
git commit -m "fix(desktop): graph physics — reduce charge, faster settle, gentler drag"
```

---

## Task 8: Visual overhaul

**Action:** Invoke the `frontend-design` skill to redesign all components and screens. The UX patterns and component responsibilities from Tasks 1–7 are locked in — only the visual layer changes.

**Files in scope for restyling:**
- `apps/desktop/src/components/Sidebar.tsx`
- `apps/desktop/src/components/NoteCard.tsx`
- `apps/desktop/src/components/MarkdownEditor.tsx`
- `apps/desktop/src/components/SourcePicker.tsx`
- `apps/desktop/src/components/LinkPicker.tsx`
- `apps/desktop/src/components/NoteModal.tsx`
- `apps/desktop/src/screens/InboxScreen.tsx`
- `apps/desktop/src/screens/ReviewScreen.tsx`
- `apps/desktop/src/screens/LibraryScreen.tsx`
- `apps/desktop/src/screens/GraphScreen.tsx`
- `apps/desktop/src/components/GraphCanvas.tsx` (node/edge colors only)

- [ ] **Step 1: Invoke frontend-design skill**

```
/frontend-design:frontend-design
```

Brief the skill: redesign all the listed components for a polished, dark-mode desktop app. The app is a Zettelkasten tool. Keep the component structure and prop interfaces unchanged — only style.

- [ ] **Step 2: Commit after skill completes**

```bash
git add apps/desktop/src/
git commit -m "feat(desktop): visual overhaul via frontend-design skill"
```

---

## Self-Review Checklist

- [x] **Spec coverage**
  - Bug 2 (process button) → Task 3
  - Bug 3 (SourcePicker form) → Task 6
  - Bug 6 (Open note modal) → Task 5
  - Library screen → Task 4
  - processed_at marking + queue filter → Tasks 1 + 2
  - Graph physics → Task 7
  - Visual overhaul → Task 8

- [x] **Type consistency**
  - `Note.processed_at: number | null` defined in Task 1, used in Task 2 (`updateNote`), Task 4 (`LibraryNote.processed_at!`)
  - `Screen` type includes `'library'` in Task 3; `Sidebar` items use it in Task 4
  - `pendingNote?: Note | null` and `onNoteConsumed?: () => void` defined in Task 3 (ReviewScreen Props), passed in Task 3 (App.tsx)
  - `LibraryNote extends Note` in Task 4 adds `source_label: string | null`

- [x] **No placeholders** — all steps contain complete code
