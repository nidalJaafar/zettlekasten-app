# AGENTS.md

This file provides guidance to future agents when working with code in this repository.

## Commands

```bash
# Run all tests (core package only — no desktop tests)
pnpm test

# Run tests in watch mode
pnpm --filter @zettelkasten/core test:watch

# Run a single test file
pnpm --filter @zettelkasten/core exec vitest run tests/notes.test.ts

# Typecheck everything
pnpm typecheck

# Typecheck desktop only
pnpm --filter @zettelkasten/desktop typecheck

# Run the desktop app (starts Vite + Tauri)
pnpm --filter @zettelkasten/desktop dev

# Build for production
pnpm --filter @zettelkasten/desktop build
```

## Architecture

### Monorepo structure

- **`packages/core`** — pure TypeScript, zero runtime dependencies, database-agnostic. Contains all domain logic, types, schema, and CRUD. This is what gets tested.
- **`apps/desktop`** — Tauri v2 + React 18 + Vite. No tests; verified by typecheck only. Depends on `@zettelkasten/core` via workspace reference.

### The `Database` interface (core)

`packages/core/src/types.ts` defines a minimal `Database` interface (`execute`, `query<T>`, `queryOne<T>`). All core functions take this interface rather than a concrete driver. This makes them testable with sql.js and runnable with the Tauri SQL plugin without any branching.

- **In tests**: `packages/core/tests/helpers/db.ts` wraps sql.js to implement the interface.
- **In the app**: `apps/desktop/src/db.ts` wraps `@tauri-apps/plugin-sql` to implement the interface. The plugin's `select()` maps to `query/queryOne` and `execute()` maps to `execute`.

**Important**: The Tauri SQL plugin's `select()` does not reliably return named rows for `PRAGMA` statements. Use try-catch to handle migration idempotency instead of PRAGMA checks.

### Zettelkasten note flow

Notes progress through three types, enforced by `packages/core/src/enforce.ts`:

```
fleeting → literature → permanent
```

- **Fleeting → Literature**: requires a `source_id` (`canPromoteToLiterature`). The note is mutated in-place via `updateNote`.
- **Literature → Permanent**: requires `own_words_confirmed = 1` and at least one link to an existing permanent note (`canSavePermanentNote`). The link requirement is **waived** when `totalPermanentNotes === 0` (bootstrap mode). A *new* permanent note is created; the literature note is preserved and marked with `processed_at = Date.now()`.
- `processed_at` distinguishes processed literature notes (shown in Library) from unprocessed ones (shown in Review queue).

### Desktop app event bus

`App.tsx` is the event hub. Screens communicate via `window.dispatchEvent` with custom events rather than prop drilling:

| Event | Fired by | Handled by |
|---|---|---|
| `zettel:review` | `InboxScreen` (Process button) | `App.tsx` → sets `pendingReviewNote` state → navigates to Review |
| `zettel:new-literature` | `InboxScreen` dropdown | `App.tsx` → navigates to Review |
| `zettel:new-permanent` | `InboxScreen` dropdown | `App.tsx` → navigates to Review |
| `zettel:open-note` | `GraphScreen` inspector | `App.tsx` → sets `openNote` state → renders `NoteModal` overlay |

`pendingReviewNote` and `openNote` are owned by `App.tsx` and passed down as props. **Never add `zettel:review` or `zettel:open-note` listeners inside child components** — they may be unmounted when the event fires.

### Desktop app screens

- **Inbox** — capture fleeting notes; "Process →" triggers `zettel:review`
- **Review** — two-step editor: fleeting-to-literature (attach source), then literature-to-permanent (confirm own words + link to permanent notes). Queue filters out notes where `processed_at IS NOT NULL`.
- **Library** — read-only list of processed literature notes (`processed_at IS NOT NULL`), joined with sources
- **Graph** — D3 force-directed graph of permanent notes and their links; click a node to open `NoteModal`

### Design tokens

`apps/desktop/src/theme.ts` exports `BG`, `BORDER`, `TEXT`, `ACCENT`, `FONT`, and `typeColor()`. All inline styles in desktop components must use these tokens rather than hardcoded hex values. Hover states are in `apps/desktop/src/global.css` as CSS classes (e.g. `.nav-item`, `.note-card`, `.process-btn`).

### Schema migrations

`packages/core/src/schema.ts` runs `CREATE TABLE IF NOT EXISTS` for all three tables, then applies additive `ALTER TABLE ADD COLUMN` migrations wrapped in try-catch that ignores `duplicate column name` errors. New columns must follow this pattern.
