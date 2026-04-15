# Pre-Mobile Hardening Findings

Date: 2026-04-15

## Verification Baseline

- `pnpm test`: passed
- `pnpm typecheck`: passed
- Desktop runtime verification: manual UI verification was not completed in this environment; `pnpm --filter @zettelkasten/desktop dev` compiled and launched `target/debug/zettelkasten`, and `pnpm --filter @zettelkasten/desktop build` still failed because the frontend assets were not built first

## Findings

### Critical

No Critical findings identified.

### Important

#### Core invariants and test coverage

- `packages/core/src/notes.ts:16-76` — Core note mutations permit lifecycle flows that are stricter in the documented model than in the shipped UI
  - Severity: Important
  - Evidence: `createNote()` allows direct `type: 'permanent'` inserts, and `updateNote()` only enforces "literature notes require a source" before writing `type`, so it can still move a note from `fleeting` straight to `permanent` or regress a note back to an earlier stage without calling `validatePromotion()` or `canSavePermanentNote()`. That differs from the documented `fleeting -> literature -> permanent` lifecycle in core docs, but it matches the currently shipped desktop workflow, which still exposes direct permanent-note creation as an intentional path.
  - Risk: mobile adds another client on top of the shared core package, so product policy is currently ambiguous across layers: shared APIs permit broader transitions than the documented lifecycle describes, and future clients can make inconsistent choices about which flows are valid.
  - Recommendation: explicitly decide whether direct permanent creation and regressive transitions are supported product behavior, then align the shared core API, enforcement, and lifecycle documentation around that policy.

- `packages/core/src/schema.ts:37-48`, `packages/core/tests/notes.test.ts:1-244`, `packages/core/tests/links.test.ts:1-96` — Schema migrations have no regression coverage for existing databases
  - Severity: Important
  - Evidence: the core test files in `packages/core/tests` cover notes, links, and pure enforcement helpers, but none exercise `runMigrations()` against a legacy `notes` table or rerun the migration on an already-upgraded schema.
  - Risk: mobile rollout increases the chance of opening older local databases, and an additive-migration regression would only surface after users upgrade.
  - Recommendation: add migration tests that cover both idempotent re-runs on the current schema and upgrade from a pre-`processed_at` notes table.

- `packages/core/tests/enforce.test.ts:18-95`, `packages/core/tests/notes.test.ts:114-180` — Tests never cover lifecycle edge cases where shared mutation APIs and documented workflow diverge
  - Severity: Important
  - Evidence: `enforce.test.ts` only unit-tests the helper functions in isolation, while `notes.test.ts` never attempts the mutation paths that currently remain possible in `notes.ts`, such as skipping `fleeting -> permanent`, regressing `literature -> fleeting`, or directly creating a permanent note outside the literature review flow.
  - Risk: the current suite can stay green while shared clients still rely on undocumented or inconsistently enforced lifecycle behavior, leaving the actual supported note-type transitions unclear.
  - Recommendation: add integration-style core tests around the public mutation API that pin down the intended semantics for skip/regressive transitions and direct permanent-note creation.

#### Desktop workflow and persistence correctness

- `apps/desktop/src/lib/note-workflow.ts:14-16`, `apps/desktop/src/lib/note-workflow.ts:55-63`, `apps/desktop/src/lib/note-workflow.ts:82-89`, `apps/desktop/src/lib/note-workflow.ts:185-202` — Desktop "transactions" are no-ops, so multi-step note writes can partially persist
  - Severity: Important
  - Evidence: `runInTransaction()` just calls `work()` and never issues `BEGIN` / `COMMIT` / `ROLLBACK`, but the workflow helpers use it around multi-write sequences: permanent-note creation plus link creation plus literature processing, draft permanent creation plus links, and persisted note saves plus title/link propagation.
  - Risk: any mid-sequence failure from the Tauri SQL plugin or a future mobile adapter can leave the database in split-brain state, such as a renamed note without synchronized backlinks, or a processed literature note without its intended permanent-note/link set.
  - Recommendation: make the desktop database adapter expose real transaction support and require the workflow helpers to use it for every multi-write save/promotion path.

- `apps/desktop/src/components/workspace/NoteWorkspace.tsx:205-289`, `apps/desktop/src/components/workspace/NoteWorkspace.tsx:329-357`, `apps/desktop/src/lib/note-workflow.ts:38-63`, `apps/desktop/src/components/workspace/NoteWorkspace.test.tsx:808-1217` — Saving a literature note as permanent can process a stale literature snapshot while autosave is still pending
  - Severity: Important
  - Evidence: autosave is debounced for 450 ms in `NoteWorkspace`, but `handleSaveAsPermanent()` immediately calls `saveLiteratureAsPermanent()` with the current draft for the new permanent note and the stale `loadedNote` object for the source literature note. Inside `saveLiteratureAsPermanent()`, the literature note is only updated with `processed_at`, so any unsaved title/content/source edits on the literature note are skipped if the user clicks "Save As Permanent" before autosave flushes.
  - Risk: the permanent note can contain the latest synthesis while the preserved literature note remains in its older persisted state, which breaks the documented "preserve the literature note" workflow and creates stale reads that will be harder to reason about on mobile.
  - Recommendation: flush or inline-persist pending literature-note edits before marking it processed, and add a regression test that clicks "Save As Permanent" during the autosave debounce window.

- `apps/desktop/src/lib/note-workflow.ts:146-158`, `apps/desktop/src/components/workspace/NoteWorkspace.tsx:59-65`, `apps/desktop/src/components/workspace/NoteWorkspace.tsx:368-377`, `apps/desktop/src/lib/note-workflow.test.ts:167-273` — Title-based wikilinks still resolve ambiguously across duplicate active note titles
  - Severity: Important
  - Evidence: duplicate active titles are still allowed, `syncWikilinksToLinks()` resolves each `[[Title]]` with `SELECT id FROM notes WHERE title = ? AND deleted_at IS NULL AND id != ? LIMIT 1`, and ctrl/cmd-click navigation uses `findNoteIdByTitle()` to open the most recently updated matching note. The code only rejects ambiguity for rename propagation, not for ordinary link syncing or note opening.
  - Risk: graph links and editor navigation can silently bind to the wrong note whenever two active notes share a title, which makes title-based wikilinks unsafe to reuse as a cross-platform note identity mechanism.
  - Recommendation: either enforce unique active titles, encode stable note ids in wikilinks, or surface ambiguity as an explicit error in both link syncing and link opening paths.

- `apps/desktop/src/lib/note-workflow.ts:108-123`, `apps/desktop/src/lib/note-workflow.test.ts:130-165` — Renaming a note rewrites wikilinks inside deleted notes in trash
  - Severity: Important
  - Evidence: `syncTitleBasedWikilinks()` loads `SELECT id, content FROM notes` without filtering `deleted_at`, and the existing test named "propagates persisted title changes through stored wikilinks on non-deleted notes" currently asserts that a deleted note's `[[Old Title]]` content is rewritten to `[[New Title]]`.
  - Risk: trashed notes are mutated behind the user's back, so restoring a deleted note can resurrect content the user never saw before deletion.
  - Recommendation: skip deleted notes during title propagation unless there is an explicit product decision to mutate trash contents, and rename the regression test to match the intended behavior.

#### Runtime and build hardening

- `apps/desktop/src-tauri/tauri.conf.json:6-10` — Tauri build is not wired to produce the frontend assets it expects
  - Severity: Important
  - Evidence: `pnpm --filter @zettelkasten/desktop build` failed with `Unable to find your web assets... frontendDist is set to "../dist"`, and the Tauri config defines `frontendDist` plus `beforeDevCommand` but no `beforeBuildCommand` to create that `dist` directory before `tauri build` runs.
  - Risk: desktop release/build verification can fail from a clean checkout or review worktree before any runtime-sensitive UI behavior is exercised, which weakens confidence in Linux packaging and startup hardening.
  - Recommendation: add a `beforeBuildCommand` that builds the Vite frontend into the configured `frontendDist`, or point `frontendDist` at the actual output path produced by the existing build workflow.

### Minor

#### UI polish and packaging cleanup

- `apps/desktop/src-tauri/tauri.conf.json:5` — The desktop bundle identifier ends with `.app`
  - Severity: Minor
  - Evidence: `pnpm --filter @zettelkasten/desktop build` emitted Tauri's warning that `com.zettelkasten.app` is not recommended because identifiers ending in `.app` conflict with the macOS application bundle extension.
  - Risk: desktop packaging metadata is already warning during build, which increases the chance of avoidable platform-specific bundle issues later even though the current review focus is Linux.
  - Recommendation: switch to a reverse-DNS identifier that does not end with `.app`, such as a vendor- or org-scoped suffix.

- `apps/desktop/src/components/MarkdownEditor.tsx:94-119`, `apps/desktop/src/components/MarkdownEditor.tsx:175-191`, `apps/desktop/src/components/MarkdownEditor.test.tsx:23-208` — Wikilink picker positioning relies on viewport coordinates and has no coverage for scroll/resize behavior outside jsdom
  - Severity: Minor
  - Evidence: picker placement is derived from `coordsAtPos()` and rendered with `position: 'fixed'`, but the coordinates are only recomputed on document/selection updates; there are no listeners for window resize, editor scroll, or container scroll while the picker stays open. The current tests cover rendering and selection insertion in jsdom, but nothing exercises scroll-sensitive positioning in a real browser engine.
  - Risk: the picker can drift away from the caret in Chromium or WebKitGTK during scroll/resize, which is the kind of desktop-only assumption that tends to break again when reused on mobile.
  - Recommendation: either anchor the picker to the editor container with live scroll/resize updates or add browser-level coverage for picker placement before carrying this interaction forward.

## Deferred / Not In Scope

None yet.

## Recommended Next Actions

1. Decide and document the supported note lifecycle policy across core and desktop, then align shared mutation APIs and integration coverage around the intended skip, regression, and direct-permanent creation semantics.
2. Add migration regression coverage for existing databases, including both legacy-schema upgrade and idempotent `runMigrations()` reruns.
3. Restore transactional safety, or equivalent atomicity guarantees, for multi-write desktop save and promotion flows before reusing them in mobile-facing persistence paths.
4. Eliminate stale literature saves during the autosave debounce race by flushing or inline-persisting pending edits before literature-to-permanent promotion, with a regression test for the debounce window.
5. Resolve ambiguous title-based wikilink identity handling by choosing one safe direction and enforcing it consistently in sync and open-note paths.
6. Stop title propagation from mutating deleted trash notes unless that behavior is explicitly intended and documented, and align the regression test with the intended behavior.
7. Wire desktop release builds to produce frontend assets before Tauri bundling so clean worktrees can build and package without manual frontend setup.
8. Address the lower-priority browser-coverage and packaging cleanup items by improving wikilink picker positioning coverage under scroll/resize and replacing the `.app` bundle identifier suffix.
