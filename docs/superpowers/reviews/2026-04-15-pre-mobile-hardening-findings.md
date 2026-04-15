# Pre-Mobile Hardening Findings

Date: 2026-04-15

## Verification Baseline

- `pnpm test`: passed
- `pnpm typecheck`: passed
- Desktop runtime verification: pending

## Findings

### Critical

None yet.

### Important

- `packages/core/src/notes.ts:16-76` — Core note mutations can bypass the documented lifecycle
  - Evidence: `createNote()` allows direct `type: 'permanent'` inserts, and `updateNote()` only enforces "literature notes require a source" before writing `type`, so it can still move a note from `fleeting` straight to `permanent` or regress a note back to an earlier stage without calling `validatePromotion()` or `canSavePermanentNote()`.
  - Risk: mobile adds another client on top of the shared core package, so lifecycle enforcement that only exists in app-side orchestration can be bypassed and persisted as invalid note state.
  - Recommendation: add a core-level promotion API or enforce the existing promotion checks inside the mutation path that changes note types / creates permanent notes.

- `packages/core/src/schema.ts:37-48`, `packages/core/tests/notes.test.ts:1-244`, `packages/core/tests/links.test.ts:1-96` — Schema migrations have no regression coverage for existing databases
  - Evidence: the core test files in `packages/core/tests` cover notes, links, and pure enforcement helpers, but none exercise `runMigrations()` against a legacy `notes` table or rerun the migration on an already-upgraded schema.
  - Risk: mobile rollout increases the chance of opening older local databases, and an additive-migration regression would only surface after users upgrade.
  - Recommendation: add migration tests that cover both idempotent re-runs on the current schema and upgrade from a pre-`processed_at` notes table.

- `packages/core/tests/enforce.test.ts:18-95`, `packages/core/tests/notes.test.ts:114-180` — Tests never cover lifecycle-violating mutation paths
  - Evidence: `enforce.test.ts` only unit-tests the helper functions in isolation, while `notes.test.ts` never attempts the mutation paths that currently remain possible in `notes.ts`, such as skipping `fleeting -> permanent`, regressing `literature -> fleeting`, or directly creating a permanent note outside the literature workflow.
  - Risk: the current suite can stay green while shared clients still persist note states that violate the documented fleeting -> literature -> permanent flow.
  - Recommendation: add integration-style core tests around the public mutation API for rejected skip/regressive transitions and permanent-note creation semantics.

### Minor

None yet.

## Deferred / Not In Scope

None yet.

## Recommended Next Actions

- Current post-core-review next actions:
- add core-level enforcement for note-type transitions and permanent-note creation so shared clients cannot persist invalid lifecycle states
- add migration tests covering both legacy-schema upgrade and idempotent reruns of `runMigrations()`
- add core mutation tests for rejected skip/regressive transitions and permanent-note creation semantics
