# Design: Pre-Mobile Hardening Pass

Date: 2026-04-15

## Overview

Before starting the mobile app, the existing codebase needs a focused hardening pass.
This is not a broad rewrite and not an open-ended optimization exercise. The goal is to
reduce risk before introducing a second client that will share the same core logic and
data model.

The hardening pass covers three areas:

1. Correctness and bug review across `packages/core`, `apps/desktop`, and Tauri startup/config
2. Fixes for confirmed bugs, correctness risks, and missing high-value tests
3. Small, justified cleanup/performance improvements that directly improve maintainability or remove proven rough edges

This phase ends with a written summary of remaining risks so the mobile work starts from a known baseline.

## Scope

### In scope

- Full code review of `packages/core`
- Full code review of `apps/desktop`
- Review of Tauri startup/config and Linux-specific behaviors already touched in recent work
- Test coverage review for core flows and recent desktop/editor changes
- Fixes for confirmed bugs, edge-case correctness issues, and platform-specific regressions
- Targeted cleanup and performance work where there is a demonstrated reason to change code

### Out of scope

- Large architectural rewrites
- Rebuilding existing screens purely for style or preference
- Creating the mobile app itself
- Adding new user-facing features unless required to fix a correctness gap
- Refactors that do not materially improve correctness, clarity, or pre-mobile readiness

## Why this phase exists

The repo is about to grow from one client to multiple clients. `packages/core` is already intended to be shared by desktop and a future mobile app. If correctness issues, weak tests, or desktop-specific assumptions remain in the codebase, mobile work will either duplicate those problems or force avoidable rewrites later.

This phase therefore focuses on stabilizing the current system first, especially:

- domain invariants in `packages/core`
- persistence and migration behavior
- desktop workflows that exercise shared logic
- editor and graph behaviors that recently changed
- startup/platform integration issues discovered during Linux packaging and runtime work

## Approach

### Approach A: Correctness-first hardening (recommended)

Perform the work in three ordered passes:

1. Review the entire codebase and record findings by severity
2. Fix confirmed bugs and add missing high-value tests
3. Apply a narrow cleanup/performance pass only where the review uncovered concrete issues

This keeps the work evidence-driven and avoids speculative refactors.

### Approach B: Balanced sweep

Review and fix bugs, cleanup, and performance issues in one mixed pass.

This is faster to start, but it increases churn and makes it harder to distinguish required fixes from optional improvements.

### Approach C: Package-by-package hardening

Harden `packages/core` first, then `apps/desktop`, then platform integration.

This is a clean structural approach, but less efficient if the goal is fast readiness for the mobile planning phase.

### Recommendation

Use Approach A.

It keeps the pass disciplined: review first, fix second, optimize only where justified. That is the safest path before starting a new client.

## Review Areas

### 1. Core domain and persistence

Review `packages/core` for:

- schema/migration correctness
- note lifecycle invariants
- source and link integrity
- bootstrap rules and edge cases
- test coverage around data mutations

This is the highest-priority area because mobile will depend on it directly.

### 2. Desktop workflow correctness

Review `apps/desktop` for:

- inbox, review, library, graph, trash, and workspace flows
- autosave and note workflow behavior
- event-driven navigation and state ownership
- editor integration and recent wikilink changes
- source attachment/removal and graph/link synchronization

### 3. Platform/runtime behavior

Review recent Tauri/Linux changes for:

- startup behavior
- window icon behavior in dev and production
- packaging assumptions
- runtime-only regressions not covered by jsdom tests

## Fix Policy

Only implement changes that fit one of these buckets:

- confirmed bug
- correctness risk with a clear reproduction or clear invariant violation
- missing test for important behavior
- cleanup/performance improvement with direct evidence from the review

Do not bundle unrelated cleanups into the same pass.

## Testing and verification

The phase must maintain or improve verification quality.

Required checks during the phase:

- `pnpm test`
- `pnpm typecheck`
- targeted runtime verification for Tauri/Linux issues when applicable

For each confirmed bug fix, prefer adding or improving a test when the behavior is testable in the current setup.

## Deliverables

This phase produces:

1. A prioritized findings list from the full review
2. Code changes fixing confirmed issues
3. Any new or improved tests that lock in corrected behavior
4. A final summary documenting what was fixed, what remains, and any residual risks before mobile work begins

## Exit criteria

The hardening phase is complete when:

- review findings have been triaged
- agreed high-priority findings are fixed
- tests and typecheck pass
- no known severe correctness issues remain in the shared core or major desktop workflows
- residual risks are documented clearly enough to start mobile planning with confidence
