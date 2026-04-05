# Zettelkasten App — Phase 1 Design Spec

**Date:** 2026-04-06  
**Scope:** Phase 1 — SQLite data model, enforcement logic, Tauri + React desktop app  
**Out of scope:** Mobile (React Native + Expo), PocketBase sync, visual design (colors, typography)

---

## 1. Project Overview

An opinionated, open-source Zettelkasten note-taking app. The core philosophy: the UX guides users toward correct Zettelkasten practice without blocking them entirely. The default path enforces the methodology; escape hatches exist but are not advertised.

Unlike Obsidian, the app has a first-class processing queue and enforced gates on permanent note creation. It is not a freeform editor.

---

## 2. Architecture

### Monorepo with pnpm workspaces

```
zettelkasten/
├── packages/
│   └── core/                   # Pure TypeScript — zero platform dependencies
│       ├── src/
│       │   ├── schema.ts        # SQLite table definitions + migration runner
│       │   ├── notes.ts         # CRUD operations
│       │   ├── links.ts         # Link management + graph queries
│       │   └── enforce.ts       # Promotion gate rules
│       └── package.json
├── apps/
│   └── desktop/                 # Tauri + React + TypeScript
│       ├── src/                 # React UI (screens, components)
│       ├── src-tauri/           # Tauri shell
│       └── package.json
├── pnpm-workspace.yaml
└── package.json
```

`packages/core` has no platform dependencies — pure logic and types. The Tauri app imports from `@zettelkasten/core`. When mobile arrives (Phase 2), it imports the same package identically.

SQLite access goes through **tauri-plugin-sql** on desktop. Core defines schema and queries as SQL strings with typed wrappers; the platform layer executes them.

---

## 3. Data Model

### 3.1 `notes` table

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `type` | TEXT | `fleeting` \| `literature` \| `permanent` |
| `title` | TEXT | Required |
| `content` | TEXT | Markdown body |
| `created_at` | INTEGER | Unix ms |
| `updated_at` | INTEGER | Unix ms |
| `source_id` | TEXT FK | → `sources.id`, nullable (required for literature) |
| `own_words_confirmed` | INTEGER | 0/1 boolean, relevant for permanent notes |
| `deleted_at` | INTEGER | Nullable — soft delete only, never hard delete |

### 3.2 `sources` table

Reusable across multiple literature notes. No enforced structure beyond type.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `type` | TEXT | `book` \| `article` \| `video` \| `podcast` \| `conversation` \| `other` |
| `label` | TEXT | Short display name — user writes whatever makes sense |
| `description` | TEXT | Nullable free text — any additional context |
| `created_at` | INTEGER | Unix ms |

Examples: label `"Thinking, Fast and Slow"`, label `"Chat with Sarah — Mar 2024"`, label `"3Blue1Brown — Linear Algebra Ep. 4"`.

### 3.3 `note_links` table

Links between permanent notes only. Undirected — inserting a link always writes both directions `(A→B)` and `(B→A)`.

| Column | Type | Notes |
|---|---|---|
| `from_note_id` | TEXT FK | → `notes.id` |
| `to_note_id` | TEXT FK | → `notes.id` |
| `created_at` | INTEGER | Unix ms |

Primary key: `(from_note_id, to_note_id)`.

Graph queries are adjacency list lookups on this table. SQLite recursive CTEs handle multi-hop traversal. No graph database needed at this scale.

### 3.4 Design decisions

- **Soft deletes only** — `deleted_at` timestamp, never `DELETE FROM`. Simplifies future PocketBase sync.
- **No `derived_from_note_id`** — permanent notes may synthesize from multiple literature notes. No one-to-one lineage tracking. A permanent note is an independent object.
- **Sources are separate** — the same source can be referenced by many literature notes without duplicating metadata.

---

## 4. Enforcement Logic

`packages/core/src/enforce.ts` exports pure functions. Nothing writes to the database without passing them. All functions return a discriminated union: `{ ok: true }` or `{ ok: false, reason: string }`. The UI displays `reason` verbatim — never a generic error.

```typescript
canPromoteToLiterature(note: Note): Result
// note.type must be 'fleeting'
// source must be attached (source_id not null)

canSavePermanentNote(note: Partial<Note>, context: PromotionContext): Result
// note.own_words_confirmed must be true
// context.linkedPermanentNoteIds.length >= 1
//   OR context.totalPermanentNotes === 0  (bootstrap exception)
// Called for both: Review flow promotion AND direct permanent note creation

validateNoteType(from: NoteType, to: NoteType): Result
// Blocks any skip: fleeting cannot jump to permanent
```

These functions are pure — they take data, return a result, touch nothing. Fully testable in isolation.

---

## 5. Note Creation Rules

| Note type | Can create directly? | Gate |
|---|---|---|
| Fleeting | Yes — always | None |
| Literature | Yes | Source must be attached at creation |
| Permanent | Yes | `own_words_confirmed` + ≥1 link to existing permanent note (link gate waived when 0 permanent notes exist) |

Permanent notes may also be started from a literature note via a "Draft permanent note" shortcut, which pre-fills the editor with the literature note content. This is a convenience, not a requirement — the user rewrites before saving.

---

## 6. UX Philosophy

**The default path enforces correct Zettelkasten practice. Secondary paths are available but not advertised.**

### Default path (primary CTA)
1. **Capture** → creates a fleeting note → feeds the inbox
2. **Review queue** → step-by-step: Fleeting → Literature → Permanent
3. Inbox badge provides a persistent nudge to process unreviewed notes

### Secondary paths (accessible, not promoted)
- `+` dropdown menu → "New literature note" (for active reading sessions)
- `+` dropdown menu → "New permanent note" (for experienced users)

The app makes the right path frictionless and rewarding. The growing graph is the incentive — users see their knowledge network expand visibly as they follow the process correctly.

---

## 7. Desktop App — Three Screens

### Navigation
**Layout B: Wide sidebar with labels.** Left sidebar (~150px) with icon + label navigation items. Each screen uses full content width. Inbox item shows a badge count of unprocessed fleeting notes.

Navigation items: **Inbox**, **Review**, **Graph**.

Visual design (colors, typography, component styling) is deferred — to be decided separately. The UX patterns described here are what matters.

### 7.1 Inbox Screen

The fleeting note queue. Primary screen for capture and processing triage.

- Quick capture input at the top (title + optional body, saves as fleeting note immediately)
- List of fleeting notes, oldest first (FIFO — process what's been waiting longest)
- Each card shows: title, content preview, timestamp, **"Process →"** button
- "Process →" opens the Review flow for that note
- Secondary: `+` dropdown for direct literature/permanent creation

### 7.2 Review Screen

The step-by-step promotion flow. Focused, one note at a time.

The Review queue contains **all notes pending promotion**: fleeting notes waiting to become literature notes, and literature notes (whether arrived via promotion or created directly) waiting to become permanent notes.

**Step indicator** at the top shows current stage: Fleeting → Literature → Permanent.

**Fleeting → Literature step:**
- Shows the fleeting note content (editable)
- Source picker: search existing sources or create a new one inline
- "Promote to Literature" button activates only when source is attached

**Literature → Permanent step:**
- Shows the literature note content (editable — user rewrites in own words)
- Gate 1: "I wrote this in my own words" checkbox — must be ticked
- Gate 2: Link picker — searchable list of all permanent notes; at least one must be selected (waived if graph is empty)
- Save button is grey with a specific reason message until both gates are satisfied
- Save button turns active (green) when both gates pass
- Saving creates a new permanent note — the literature note is **preserved** as a reading record

### 7.3 Graph Screen

D3 force-directed graph of all permanent notes.

- Nodes = permanent notes; edges = links
- Node size scales with connection count (highly-linked notes are visually larger)
- Hover: highlights connected subgraph, dims unconnected nodes
- Click: opens inspector panel (title snippet, connection count, "Open note" + "Link" buttons)
- Double-click: opens full note editor
- Scroll/drag: zoom and pan
- Search bar overlay for filtering nodes by title
- Stats overlay: total note count, total link count

---

## 8. Markdown Experience

Notes are written in Markdown. The editor uses **CodeMirror** (via `@uiw/react-codemirror`) — lightweight, fast, well-supported in Tauri + React. No WYSIWYG. Rendered preview is a toggle, not the default — the writing surface is the markdown source.

---

## 9. What Is Out of Scope for Phase 1

- Mobile app (React Native + Expo) — Phase 2
- PocketBase sync — Phase 2
- AI-suggested links — Phase 3
- Visual design system (colors, typography, component library) — separate track
- Tags, labels, search across all notes — Phase 2
- Conflict resolution — Phase 2 (requires sync)
