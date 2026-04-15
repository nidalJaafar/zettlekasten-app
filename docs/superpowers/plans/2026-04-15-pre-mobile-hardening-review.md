# Pre-Mobile Hardening Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a prioritized, evidence-backed hardening backlog for the existing desktop/core codebase before mobile work begins.

**Architecture:** This plan intentionally covers the review and triage half of the hardening spec first. The work is decomposed into repository review, runtime verification, and findings documentation so that later fix plans are based on confirmed issues rather than speculative cleanup. The output of this plan is a findings document plus a clear set of high-priority fix candidates.

**Tech Stack:** TypeScript, React, Tauri v2, Rust, Vitest, pnpm, markdown docs

---

## File Structure

- Create: `docs/superpowers/reviews/2026-04-15-pre-mobile-hardening-findings.md`
  - Single source of truth for the review output: findings ordered by severity, evidence, impact, and recommended next action
- Read heavily: `packages/core/src/**/*.ts`, `packages/core/tests/**/*.ts`, `apps/desktop/src/**/*.ts(x)`, `apps/desktop/src-tauri/src/**/*.rs`, `apps/desktop/src-tauri/tauri.conf.json`
  - These are the review targets; no edits are expected in this plan outside the findings document unless a tiny documentation correction is required

---

### Task 1: Establish Baseline Verification State

**Files:**
- Create: `docs/superpowers/reviews/2026-04-15-pre-mobile-hardening-findings.md`

- [ ] **Step 1: Create the findings document skeleton**

Create `docs/superpowers/reviews/2026-04-15-pre-mobile-hardening-findings.md` with this exact content:

```md
# Pre-Mobile Hardening Findings

Date: 2026-04-15

## Verification Baseline

- `pnpm test`: not run yet
- `pnpm typecheck`: not run yet
- Desktop runtime verification: not run yet

## Findings

### Critical

None yet.

### Important

None yet.

### Minor

None yet.

## Deferred / Not In Scope

None yet.

## Recommended Next Actions

None yet.
```

- [ ] **Step 2: Run the full test suite**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm test
```

Expected: all core and desktop test files pass. If anything fails, record the exact failure text under `## Verification Baseline` before proceeding.

- [ ] **Step 3: Run full typecheck**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm typecheck
```

Expected: both packages complete with no type errors. Record the result under `## Verification Baseline`.

- [ ] **Step 4: Update the findings document with actual baseline results**

Replace the placeholder baseline lines in `docs/superpowers/reviews/2026-04-15-pre-mobile-hardening-findings.md` with the actual command results. Use this exact format, changing only the status text as needed:

```md
## Verification Baseline

- `pnpm test`: passed
- `pnpm typecheck`: passed
- Desktop runtime verification: pending
```

- [ ] **Step 5: Commit**

```bash
cd /home/nidal/Playground/zettlekasten-app && git add docs/superpowers/reviews/2026-04-15-pre-mobile-hardening-findings.md && git commit -m "Add baseline verification for pre-mobile hardening review"
```

---

### Task 2: Review `packages/core` for Correctness and Test Gaps

**Files:**
- Read: `packages/core/src/types.ts`
- Read: `packages/core/src/schema.ts`
- Read: `packages/core/src/enforce.ts`
- Read: `packages/core/src/notes.ts`
- Read: `packages/core/src/links.ts`
- Read: `packages/core/tests/enforce.test.ts`
- Read: `packages/core/tests/notes.test.ts`
- Read: `packages/core/tests/links.test.ts`
- Modify: `docs/superpowers/reviews/2026-04-15-pre-mobile-hardening-findings.md`

- [ ] **Step 1: Review core types, schema, and invariants**

Read the core source files and inspect them against the repo guidance in `AGENTS.md`. Focus on:

- whether migrations are additive and idempotent
- whether note lifecycle invariants match the documented fleeting -> literature -> permanent flow
- whether link creation/removal and source handling preserve integrity

Record every confirmed issue in the findings doc using this exact template:

```md
### Important

- `path/to/file.ts:12-34` — Short finding title
  - Evidence: what the code currently does
  - Risk: why this matters before mobile
  - Recommendation: smallest safe next step
```

If no issues are found in a category, leave the category as `None yet.` until the end of the task.

- [ ] **Step 2: Review core tests against mutation paths**

Compare the tests to the mutation-heavy code in `notes.ts` and `links.ts`. Check whether the tests cover:

- note creation/update/delete and processed state changes
- bootstrap behavior for first permanent note
- link add/remove semantics and duplicate handling
- migration-sensitive behavior that could break shared clients

Add any missing-test findings to the same findings document using the same template.

- [ ] **Step 3: Normalize the findings document after the core review**

Edit `docs/superpowers/reviews/2026-04-15-pre-mobile-hardening-findings.md` so that:

- empty sections remain only if there are still no findings in that severity band
- findings are ordered most severe to least severe
- each finding has file references, evidence, risk, and recommendation

- [ ] **Step 4: Commit**

```bash
cd /home/nidal/Playground/zettlekasten-app && git add docs/superpowers/reviews/2026-04-15-pre-mobile-hardening-findings.md && git commit -m "Document core-layer hardening findings"
```

---

### Task 3: Review `apps/desktop` Workflows and Editor/Graph Integrations

**Files:**
- Read: `apps/desktop/src/App.tsx`
- Read: `apps/desktop/src/db.ts`
- Read: `apps/desktop/src/lib/note-workflow.ts`
- Read: `apps/desktop/src/lib/wikilinks.ts`
- Read: `apps/desktop/src/components/MarkdownEditor.tsx`
- Read: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`
- Read: `apps/desktop/src/components/workspace/DocumentPane.tsx`
- Read: `apps/desktop/src/components/workspace/NoteContextPane.tsx`
- Read: `apps/desktop/src/screens/InboxScreen.tsx`
- Read: `apps/desktop/src/screens/ReviewScreen.tsx`
- Read: `apps/desktop/src/screens/LibraryScreen.tsx`
- Read: `apps/desktop/src/screens/GraphScreen.tsx`
- Read: `apps/desktop/src/screens/TrashScreen.tsx`
- Read: `apps/desktop/src/**/*.test.ts(x)` relevant to the above
- Modify: `docs/superpowers/reviews/2026-04-15-pre-mobile-hardening-findings.md`

- [ ] **Step 1: Review workflow ownership and event-driven state transitions**

Inspect `App.tsx`, screen components, and workspace components for correctness around:

- `zettel:*` event handling
- note selection/open flows
- autosave behavior and write ordering
- editor state ownership versus persisted state

Add confirmed findings to the findings document using the existing format.

- [ ] **Step 2: Review recent editor and wikilink changes**

Inspect `MarkdownEditor.tsx`, `wikilinks.ts`, `DocumentPane.tsx`, `NoteWorkspace.tsx`, and associated tests for:

- cursor tracking correctness
- picker positioning behavior
- content/link synchronization
- layout assumptions that may differ between jsdom, Chromium, and WebKitGTK

Add confirmed findings with file references and concrete evidence.

- [ ] **Step 3: Review graph, source, and note workflow integrity**

Inspect `note-workflow.ts`, `db.ts`, graph-related code, and source attachment/removal flows for:

- race conditions or stale reads around autosave
- source detachment and deletion safety
- note link graph consistency after edits
- assumptions that will be hard to reuse on mobile

Add confirmed findings with evidence and recommendations.

- [ ] **Step 4: Normalize the findings document after desktop review**

Edit `docs/superpowers/reviews/2026-04-15-pre-mobile-hardening-findings.md` so the findings remain severity-ordered and deduplicated. If the same issue appears across multiple files, merge it into one finding and mention all affected files.

- [ ] **Step 5: Commit**

```bash
cd /home/nidal/Playground/zettlekasten-app && git add docs/superpowers/reviews/2026-04-15-pre-mobile-hardening-findings.md && git commit -m "Document desktop hardening findings"
```

---

### Task 4: Verify Tauri/Linux Runtime Assumptions

**Files:**
- Read: `apps/desktop/src-tauri/src/lib.rs`
- Read: `apps/desktop/src-tauri/src/main.rs`
- Read: `apps/desktop/src-tauri/tauri.conf.json`
- Read: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `docs/superpowers/reviews/2026-04-15-pre-mobile-hardening-findings.md`

- [ ] **Step 1: Run targeted desktop runtime verification**

Run the desktop app and manually verify the recently changed Linux/runtime-sensitive areas:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm --filter @zettelkasten/desktop dev
```

Verify these exact behaviors manually:

- window icon appears in dev mode
- right-click context menu is suppressed
- markdown editor gutter/content layout is correct
- opening and editing a note still works

Stop the app after verification and record the result under `## Verification Baseline` in the findings document, replacing `Desktop runtime verification: pending` with either `passed` or a short failure summary.

- [ ] **Step 2: Review Tauri startup/config against observed behavior**

Inspect `lib.rs`, `main.rs`, `tauri.conf.json`, and `Cargo.toml` for mismatches between intended behavior and runtime verification. Add any confirmed findings to the findings document.

- [ ] **Step 3: Re-run verification commands if runtime findings require clarification**

If Step 2 surfaces any uncertainty, run only the minimum extra command needed to clarify it. Use one of these exact command shapes:

```bash
cd /home/nidal/Playground/zettlekasten-app/apps/desktop/src-tauri && cargo check
```

or

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm --filter @zettelkasten/desktop build
```

Record the result in the findings document if it changes the severity or recommendation of a runtime finding.

- [ ] **Step 4: Commit**

```bash
cd /home/nidal/Playground/zettlekasten-app && git add docs/superpowers/reviews/2026-04-15-pre-mobile-hardening-findings.md && git commit -m "Document Tauri and Linux runtime hardening findings"
```

---

### Task 5: Triage Findings into the Pre-Mobile Fix Backlog

**Files:**
- Modify: `docs/superpowers/reviews/2026-04-15-pre-mobile-hardening-findings.md`

- [ ] **Step 1: Rewrite the findings document into final review form**

Edit `docs/superpowers/reviews/2026-04-15-pre-mobile-hardening-findings.md` so that every finding uses this exact structure:

```md
- `path/to/file.ts:12-34` — Finding title
  - Severity: Critical | Important | Minor
  - Evidence: exact behavior or code pattern observed
  - Risk: why it matters before mobile
  - Recommendation: smallest safe fix or next action
```

Keep findings grouped under `### Critical`, `### Important`, and `### Minor`.

- [ ] **Step 2: Add the final next-actions section**

Replace the placeholder `## Recommended Next Actions` section with this structure, filling it from the actual findings:

```md
## Recommended Next Actions

1. Fix all Critical findings before mobile planning begins.
2. Fix Important findings that affect shared core logic, persistence, editor correctness, or platform startup.
3. Defer Minor findings unless they are trivial to include in the same change as a higher-priority fix.
```

If there are no Critical findings, keep line 1 but say `No Critical findings identified.`

- [ ] **Step 3: Final verification**

Run:

```bash
cd /home/nidal/Playground/zettlekasten-app && pnpm test && pnpm typecheck
```

Expected: both commands pass. If they do not, update the findings document to reflect the failing verification state before proceeding.

- [ ] **Step 4: Commit**

```bash
cd /home/nidal/Playground/zettlekasten-app && git add docs/superpowers/reviews/2026-04-15-pre-mobile-hardening-findings.md && git commit -m "Finalize pre-mobile hardening review and backlog"
```

---

### Task 6: Push the Review Work

- [ ] **Step 1: Push review commits**

```bash
cd /home/nidal/Playground/zettlekasten-app && git push
```
