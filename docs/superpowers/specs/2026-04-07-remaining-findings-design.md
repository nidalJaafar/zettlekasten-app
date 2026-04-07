# Remaining Findings Design

**Date:** 2026-04-07  
**Scope:** Resolve the remaining audited findings after foreign-key enforcement, including the adjacent literature-source invariant gap discovered during implementation.  
**Out of scope:** New features unrelated to the audit, visual redesign, and broad architectural refactors beyond what is needed to make the audited behavior correct and verifiable.

## Problem

The first audit pass surfaced a mix of correctness bugs, inconsistent UI behavior, and release-readiness gaps across core logic, desktop runtime behavior, and repository configuration.

The foreign-key enforcement work is now isolated in its own worktree, but the remaining issues still leave the app with:

- stale links after soft deletion
- note-type transitions that do not match the documented state machine
- a gap where core still permits literature notes without a source when callers bypass the review flow
- graph rendering risk when filtered nodes and unfiltered links diverge
- non-atomic literature-to-permanent saves
- stale inbox badge updates
- direct-create actions that do not actually create drafts
- misleading bootstrap save-button state
- repo-level verification and hygiene issues (`pnpm typecheck`, `.gitignore`, CSP, missing README)

## Goals

- Make the documented note lifecycle rules true in core behavior, not just in UI flow.
- Remove correctness bugs in graph rendering and review/save flows.
- Align visible desktop UI state with actual business rules.
- Restore practical release hygiene for verification, local-data ignores, desktop security defaults, and onboarding docs.
- Keep each change narrow and independently verifiable.

## Non-Goals

- Redesigning the app event model beyond what is needed for the audited fixes.
- Introducing a full persistence abstraction rewrite or a large transaction framework.
- Changing note concepts or the overall Zettelkasten workflow.

## Design

### Track A: Core Integrity And Lifecycle Rules

#### A1. Hide links for deleted notes

`getLinkedNoteIds()` and `getAllLinks()` should only return edges whose endpoints are still active notes (`deleted_at IS NULL`).

Design choice:
- join `note_links` back to `notes` instead of returning raw rows
- require both endpoints to exist and be undeleted

This keeps deleted notes from leaking into graph consumers or link pickers without physically deleting link rows.

#### A2. Enforce the documented note-type state machine

`validatePromotion()` should allow only:

- `fleeting -> literature`
- `literature -> permanent`

and reject backward, skip, or no-op transitions that do not belong to promotion.

This matches the architecture doc and prevents callers from treating `validatePromotion()` as stronger than it currently is.

#### A3. Require a source for literature notes at the core boundary

The review flow already requires a source, but `createNote()` and `updateNote()` still permit literature notes with `source_id = null`.

Design choice:
- enforce this invariant in core note write paths, not only in UI
- rejection should happen before invalid data is inserted or updated
- tests should cover both create and update paths

This is separate from foreign-key existence enforcement: a null source is not an invalid reference, but it is still invalid business data for literature notes.

### Track B: Desktop Runtime And UX Correctness

#### B1. Filter graph links to the visible node set

When search filters the graph, the rendered link set should be derived from the visible notes. D3 should only receive edges whose endpoints both exist in the node array being rendered.

This avoids missing-node link resolution failures and keeps connection counts aligned with what the user sees.

#### B2. Make literature-to-permanent save atomic

The permanent-note creation flow currently performs multiple writes in sequence without a transaction.

Design choice:
- wrap the create-permanent, confirm-own-words, add-links, and mark-processed steps in one DB transaction at the desktop call site
- fail the entire operation if any step fails

This preserves a consistent DB state and prevents partial promotion artifacts.

#### B3. Keep inbox badge state current

The app-level `inboxCount` should refresh whenever review actions change the fleeting-note queue, not only when the Inbox screen mounts.

Design choice:
- centralize a small count refresh path in `App.tsx` and invoke it from both Inbox and Review flows
- keep the existing event-bus ownership model intact

#### B4. Make direct-create actions real

`New literature note` and `New permanent note` should open a valid draft path rather than just navigating to Review.

Design choice:
- direct-create actions should create the needed draft note up front, then route the user into the correct editor state
- literature drafts must satisfy the source invariant before save, while permanent drafts must still satisfy own-words and link rules

The implementation may use explicit draft records or a local draft mode, but it must result in a real editable path rather than a no-op.

#### B5. Align bootstrap button state with the actual permanent-note rule

When there are zero permanent notes, the literature-to-permanent save button should visually appear active once own-words confirmation is satisfied, even with no selected links.

This is a UI-state fix only; the underlying business rule already allows bootstrap creation.

### Track C: Repo And Runtime Hygiene

#### C1. Fix root typecheck

`packages/core/tsconfig.json` currently includes `tests` while constraining `rootDir` to `src`, which breaks `pnpm typecheck` with `TS6059`.

Design choice:
- make the config consistent so repo-level typecheck works without changing the intended package layout

#### C2. Expand `.gitignore`

The repo should ignore:

- `.env*` except any intentional examples
- SQLite sidecar files such as `*.db-wal` and `*.db-shm`

This lowers the risk of accidentally committing secrets or local DB state.

#### C3. Restore a real Tauri CSP

`apps/desktop/src-tauri/tauri.conf.json` should no longer set `security.csp` to `null`.

Design choice:
- restore a minimal CSP compatible with the current Tauri + Vite app
- prefer the narrowest policy that still supports the existing runtime

#### C4. Add a top-level README

The repository should document:

- what the project is
- how to install dependencies
- how to run tests and typechecks
- how to run the desktop app
- any notable environment or workspace requirements

## Testing Strategy

- Core rule changes use TDD with focused Vitest coverage first.
- Desktop behavior changes use focused verification through existing typecheck and any core tests that cover the affected logic.
- Repo-hygiene changes are verified by the commands they unblock or the config diffs they produce.

Final verification target:

- `pnpm test`
- `pnpm --filter @zettelkasten/desktop typecheck`
- `pnpm typecheck`

## Sequencing

Recommended implementation order:

1. Core invariants and link filtering at the data layer
2. Desktop graph and review-flow correctness fixes
3. Direct-create UX and badge-state fixes
4. Repo hygiene and release-readiness fixes

This order reduces compounding bugs by making the underlying rules correct before adjusting UI flows that depend on them.

## Risks

- Tightening core invariants may expose existing callers that relied on under-validated note writes.
- Adding transaction handling in the desktop flow depends on what SQL transaction support is available through the current database wrapper.
- Restoring CSP may reveal current asset or style assumptions that were masked by `null`.

## Chosen Approach

Implement the remaining findings as one coordinated batch spec with several isolated tasks, each verified independently in the same worktree.
