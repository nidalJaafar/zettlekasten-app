# React Native Mobile Client Design

## Goal

Build a mobile app (iOS + Android) that is a full replica of the desktop Tauri app, sharing all business logic through `@zettelkasten/core` and a promoted shared layer. The mobile app targets feature parity with desktop: all note types, lifecycle transitions, wikilink editing, source management, graph visualization, and trash flows.

## Tech Stack

- Expo SDK 52+ (managed workflow)
- Expo Router v4 (file-based routing)
- expo-sqlite (implements `Database` interface)
- Zustand (global state)
- react-native-svg + d3-force (graph)
- react-native-markdown-display (preview rendering)
- `@zettelkasten/core` via workspace reference

## Strategy: Three Phases

1. **Core elevation** — Promote sources CRUD and wikilink helpers into `packages/core` so both desktop and mobile import the same business logic.
2. **Mobile scaffold** — Create `apps/mobile` with Expo, wire up expo-sqlite adapter, Zustand store, Expo Router, and theme.
3. **Mobile screens** — Build all six screens with full functional parity to desktop.

---

## Phase 1: Core Elevation

### Sources Module (`packages/core/src/sources.ts`)

Full CRUD module promoted from desktop's raw SQL in SourcePicker:

- `createSource(db, { type, label, description? })` — generates UUID, validates type against `SourceType`
- `getSourceById(db, id)`
- `getAllSources(db)` — ordered by label ASC
- `updateSource(db, id, { label?, description? })`
- `deleteSource(db, id)` — only if no notes reference it (checked via `countNotesBySource`)
- `countNotesBySource(db, sourceId)` — helper for delete guard

### Wikilink Module (`packages/core/src/wikilinks.ts`)

Pure function module with no DB dependency:

- `extractWikilinkTitles(content)` — regex extraction of `[[title]]` patterns
- `rewriteTitleBasedWikilinks(content, oldTitle, newTitle)` — title rename propagation across all wikilinks in content
- `getActiveWikilinkQuery(text, cursorPos)` — autocomplete query parsing (detects open `[[` at cursor)
- `insertWikilinkSelection(value, query, selection)` — replaces the open wikilink with a completed `[[selection]]`
- `renderMarkdownToHtml(content, noteResolver?)` — markdown rendering with wikilink-to-link conversion

### What Stays Desktop-Only

- `apps/desktop/src/lib/note-workflow.ts` orchestration (uses desktop's `transaction()`)
- `apps/desktop/src/lib/graph.ts` (D3 layout — mobile uses its own)
- `apps/desktop/src/lib/layout.ts` (desktop pane sizing)

### What Gets Duplicated in Mobile

- `note-workflow.ts` — thin orchestration over core primitives using each platform's `transaction()` adapter. Contains: `promoteFleetingToLiterature`, `saveLiteratureAsPermanent`, `createPermanentDraft`, `savePersistedNote`, `syncNoteLinks`, `ensureUniqueActiveTitle`, `syncWikilinksToLinks`, `syncTitleBasedWikilinks`.
- `graph.ts` — platform-specific layout using d3-force with platform-specific rendering.

### Testing

- New `packages/core/tests/sources.test.ts` — full CRUD coverage with sql.js
- New `packages/core/tests/wikilinks.test.ts` — parsing, insertion, rendering coverage (ported from desktop's `wikilinks.test.ts`)
- Desktop's `wikilinks.test.ts` and SourcePicker tests updated to use core exports
- No mobile tests (same policy as desktop: verified by typecheck only)

---

## Phase 2: Mobile Scaffold

### Directory Structure

```
apps/mobile/
├── app/                        # Expo Router file-based routes
│   ├── _layout.tsx             # Root layout (providers, DB init)
│   ├── (tabs)/
│   │   ├── _layout.tsx         # Bottom tab navigator
│   │   ├── inbox.tsx           # Inbox screen
│   │   ├── workspace.tsx       # Note editor (universal)
│   │   ├── library.tsx         # Processed literature notes
│   │   └── graph.tsx           # Force-directed graph
│   ├── trash.tsx               # Trash (modal or separate route)
│   └── note/[id].tsx           # Deep-linked note view
├── src/
│   ├── db.ts                   # expo-sqlite adapter implementing Database
│   ├── store.ts                # Zustand store (activeNote, db instance)
│   ├── theme.ts                # Same tokens as desktop, RN StyleSheet
│   ├── components/
│   │   ├── NoteCard.tsx
│   │   ├── MarkdownInput.tsx   # TextInput + preview toggle
│   │   ├── LinkPicker.tsx      # Permanent note selection (bottom sheet)
│   │   ├── SourcePicker.tsx    # Source list + create (bottom sheet)
│   │   └── GraphCanvas.tsx     # SVG force graph
│   └── lib/
│       └── note-workflow.ts    # Same orchestration as desktop
├── app.json
├── package.json
└── tsconfig.json
```

### DB Adapter (`src/db.ts`)

Wraps expo-sqlite's `useSQLiteContext`:

- Implements `Database` interface (`execute`, `query`, `queryOne`)
- Implements `transaction()` using `withTransactionAsync`
- On init: `runMigrations()` + `PRAGMA foreign_keys = ON`
- Singleton via Zustand store

### Zustand Store (`src/store.ts`)

```typescript
{
  db: Database | null
  activeNote: Note | null
  activeTab: string
  initDb: () => Promise<void>
  loadNote: (id: string) => Promise<void>
  clearActiveNote: () => void
}
```

### Navigation Model

- **Bottom tabs:** Inbox, Workspace, Library, Graph
- **Trash:** accessible from tab bar overflow or settings header
- **Workspace** is the universal editor — handles fleeting capture, literature review, permanent drafting, and note editing
- Opening a note from any screen navigates to workspace with that note loaded
- Deep link `note/[id]` opens workspace with the specified note

### Theme (`src/theme.ts`)

Same token values as desktop (`BG`, `TEXT`, `ACCENT`, `FONT`, `BORDER`) but exported as `StyleSheet.create()` objects. No hover states — use press/active opacity instead.

---

## Phase 3: Mobile Screens — Liquid Glass Design

### Design Language

- **iOS:** Apple Liquid Glass — translucent materials, backdrop blur, floating pill-shaped buttons, depth layers, frosted-glass tab bar
- **Android:** Material You equivalents — surface tonal elevation, rounded shapes, blur where supported, fallback to solid surfaces on older devices
- Same color tokens as desktop rendered through translucent layers with blur

### Inbox (tab)

- Translucent header: "Inbox" title + fleeting note count badge (glass pill)
- Quick capture card (frosted glass panel): title input + body textarea (full parity with desktop) + "Capture" button
- Scrollable list of fleeting NoteCards with glass-material background (title, content preview, relative time)
- Swipe right on card: "Process" action (navigates to workspace with that note)
- Floating action button (glass pill, bottom-right): "+ New" dropdown for literature / permanent note

### Workspace (tab)

- Full parity with desktop workspace — same fields, same actions, same flow
- Title input + body TextInput
- Edit / markdown preview toggle in header
- Source picker as bottom sheet (replaces desktop context pane)
- Link picker as bottom sheet (replaces desktop context pane)
- "Own words" checkbox + link summary inline
- Action buttons at bottom: "Promote to Literature" / "Save as Permanent" — glass pill buttons
- Recent notes accessible via back gesture or header back button

### Library (tab)

- Translucent search bar at top
- List of processed literature notes on frosted glass cards (title, source label, processed date)
- Tap opens note in workspace

### Graph (tab)

- Full-screen SVG force-directed graph of permanent notes (same logic as desktop)
- Translucent search overlay at top
- Selected node detail: glass card overlay at bottom (title, type badge, link count, "Open" button)
- Pinch to zoom, drag to pan, tap node to select

### Trash

- Glass-material list of soft-deleted notes (title, deletion date)
- Swipe actions: "Restore" / "Delete Permanently"
- Confirmation alert before permanent delete

### Note Deep Link (`note/[id]`)

- Opens workspace with the specified note loaded
- Used when navigating from graph, library, or external links

---

## Functional Parity with Desktop

All functions identical between mobile and desktop:

- All note types (fleeting, literature, permanent) and lifecycle transitions
- Wikilink autocomplete in editor (`[[` trigger, picker, insertion)
- Unique title enforcement on all create/save paths
- Autosave with 450ms debounce + in-flight save coordination
- Trash soft-delete / restore / permanent delete
- Source CRUD with usage guard on delete
- Link management (add/remove permanent note links)
- Graph neighborhood exploration
- Title-based wikilink propagation on rename
- Markdown preview rendering with wikilink resolution

## Error Handling

- Unique title violations: inline error below title input
- Lifecycle validation errors: inline error near the action button
- Transaction failures: silent rollback, surface "Save failed" status
- DB init failure: error screen with retry button
- Source delete when in use: alert explaining notes reference it

## Testing

- `packages/core`: tested with sql.js (sources + wikilink tests added during elevation)
- `apps/mobile`: no tests, verified by typecheck only (same policy as desktop)
- `pnpm typecheck` runs across the whole monorepo
