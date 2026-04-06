# Zettelkasten Phase 2 Design Spec

**Date:** 2026-04-06
**Scope:** Bug fixes, Library screen, graph improvements, and visual overhaul

---

## Overview

Phase 1 delivered a working Zettelkasten flow. Phase 2 fixes seven identified issues:

1. Styling overhaul (frontend-design skill)
2. Process button navigation bug
3. SourcePicker form order bug
4. Literature notes leave the review queue after processing
5. Graph physics tuning
6. Graph "Open note" shows a modal overlay
7. Permanent notes are viewable from the graph

---

## Bug Fixes

### Bug 2 — Process button does nothing

**Root cause:** `InboxScreen` fires `zettel:review` with the note as detail, but `ReviewScreen` is not mounted at that point (user is on Inbox), so its event listener never fires.

**Fix:** `App.tsx` listens to `zettel:review`. On receipt:
1. Store the note in `pendingReviewNote: Note | null` state
2. Call `setScreen('review')`

`ReviewScreen` receives two new props:
- `pendingNote: Note | null` — the note to pre-select
- `onNoteConsumed: () => void` — called after the note is consumed

A `useEffect` in `ReviewScreen` watches `pendingNote`. When it changes from `null` to a note, call `selectNote(pendingNote)` then `onNoteConsumed()`. `App.tsx`'s `onNoteConsumed` sets `pendingReviewNote` back to `null`.

### Bug 3 — Source name disappears in SourcePicker

**Root cause:** The creation form renders type select *first*, then label input. Users type in the label field, then notice the type select above it and perceive the form as having changed.

**Fix:** Reorder the creation form fields:
1. Label input (first — most important)
2. Type select
3. Description input (optional)

### Bug 6 — "Open note" navigates to review instead of showing the note

**Root cause:** `App.tsx` handles `zettel:open-note` by calling `setScreen('review')` with no note data. ReviewScreen shows the queue list with nothing pre-selected.

**Fix:** `App.tsx` maintains `openNote: Note | null` state. The `zettel:open-note` handler sets `openNote` to the event detail. A `NoteModal` component renders as an overlay when `openNote` is non-null. Clicking the backdrop or the close button sets `openNote` back to `null`.

---

## Library Screen

### Purpose

After a literature note is used to create a permanent note, it should leave the review queue. It moves to the Library — a passive archive of processed notes you can browse but don't need to act on.

### Schema change

Add `processed_at INTEGER` column to the `notes` table:

```sql
ALTER TABLE notes ADD COLUMN processed_at INTEGER;
```

This runs as an additional migration in `schema.ts` at startup. Existing notes get `NULL` for this column (unprocessed).

**Core type changes required:**
- `Note` interface in `types.ts`: add `processed_at: number | null`
- `updateNote` in `notes.ts`: extend the `Partial<Pick<...>>` union to include `processed_at`
- `createNote` in `notes.ts`: include `processed_at: null` in the INSERT statement

### When a note is marked processed

At the end of `handleSavePermanent` in `ReviewScreen`, after the permanent note and links are saved, call:

```ts
await updateNote(db, current.id, { processed_at: Date.now() })
```

This applies to the literature note that was being reviewed (`current`).

### Review queue filter

`ReviewScreen.loadQueue` fetches literature notes via a raw `db.query` call filtering on `processed_at IS NULL`:

```ts
const fleeting = await getNotesByType(db, 'fleeting')  // unchanged
const literature = await db.query<Note>(
  `SELECT * FROM notes WHERE type = 'literature' AND processed_at IS NULL AND deleted_at IS NULL ORDER BY created_at ASC`
)
setQueue([...fleeting, ...literature])
```

`getNotesByType` is not modified — it remains a simple type filter without processed_at awareness.

### LibraryScreen

New file: `apps/desktop/src/screens/LibraryScreen.tsx`

Fetches processed literature notes with their source label in one query:

```sql
SELECT n.*, s.label as source_label
FROM notes n
LEFT JOIN sources s ON n.source_id = s.id
WHERE n.processed_at IS NOT NULL AND n.deleted_at IS NULL
ORDER BY n.processed_at DESC
```

Each card shows: note title, source label (or "No source"), formatted processed date. Clicking a card toggles an expanded section below the card header showing the full note content (read-only plain text). No action buttons — Library is purely read-only.

### Navigation

`Sidebar` gains a fourth nav item: **Library**, positioned between Review and Graph. Uses an archive/stack icon. No badge count needed.

---

## Graph Improvements

### Note modal

When "Open note" is clicked in the graph inspector panel, a centered modal appears over the graph:

- **Content:** full title, full note content (plain text — no markdown rendering in this phase), connection count, list of linked note titles
- **Dismissal:** close button (top-right of modal) or clicking the semi-transparent backdrop
- **Implementation:** `App.tsx` owns `openNote: Note | null`. The `zettel:open-note` event handler sets it. A `NoteModal` component renders conditionally in `App.tsx` above the main layout.
- The modal is not tied to a specific screen — it works from the graph regardless of which nav item is active.

### Physics tuning

Current D3 force simulation parameters cause two problems: nodes fly apart aggressively on load (charge too strong) and dragging one node pulls the entire graph (alpha target too high).

Adjustments to `GraphCanvas.tsx`:

| Parameter | Current | New | Effect |
|---|---|---|---|
| `forceManyBody().strength` | `-200` | `-80` | Less repulsion, calmer initial layout |
| `alphaDecay` | default (0.0228) | `0.04` | Settles ~2× faster |
| `velocityDecay` | default (0.4) | `0.5` | More damping, less oscillation |
| `alphaTarget` on drag start | `0.3` | `0.1` | Gentler drag — connected nodes move less |
| `forceLink().distance` | `100` | `80` | Slightly tighter clusters |

---

## Visual Overhaul

All components and screens receive a visual redesign using the `frontend-design` skill. This is handled as a separate pass after the above features are implemented. The UX patterns, layout structure, and component responsibilities are unchanged — only the visual layer is updated: typography, spacing, color system, component polish, hover/active states, and transitions.

---

## Out of Scope (Phase 2)

- Markdown rendering in note views
- Editing permanent notes
- Deleting notes from Library
- Search across all note types
- AI-suggested links
