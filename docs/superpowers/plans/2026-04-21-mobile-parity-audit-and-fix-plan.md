# Mobile Parity Audit And Fix Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit the React Native mobile app against the desktop app, then fix parity, runtime, and UI bugs until mobile matches desktop naming and feature coverage.

**Architecture:** Use the desktop app as the product spec and repair the mobile app in small, verified batches. Start with route and naming parity, then fix data-loading and workflow-state bugs, then restore missing feature entry points and screen behavior, verifying after each batch.

**Tech Stack:** pnpm monorepo, TypeScript, Expo Router, React Native, Zustand, expo-sqlite, @zettelkasten/core

---

## File Map

- Modify: `apps/mobile/app/(tabs)/_layout.tsx` - align tab names and route structure with desktop product terminology
- Modify: `apps/mobile/app/(tabs)/index.tsx` - Inbox behavior, entry points, refresh behavior, top-level actions
- Create or modify: `apps/mobile/app/(tabs)/review.tsx` - desktop-aligned Review screen route if mobile keeps processing separate from other note editing
- Modify or rename: `apps/mobile/app/(tabs)/workspace.tsx` - either become desktop-aligned Review flow or become non-tab detail/editor route depending on final parity structure
- Modify: `apps/mobile/app/(tabs)/library.tsx` - refresh/loading parity and note opening behavior
- Modify: `apps/mobile/app/(tabs)/graph.tsx` - refresh/loading parity and graph screen behavior
- Modify: `apps/mobile/app/trash.tsx` - trash state updates and restore/delete behavior
- Modify: `apps/mobile/app/note/[id].tsx` - read-only note presentation parity or removal if desktop has no equivalent direct route
- Modify: `apps/mobile/app/source-picker.tsx` - source picker callback lifecycle and deletion edge cases
- Modify: `apps/mobile/app/link-picker.tsx` - selected-link initialization and callback lifecycle
- Modify: `apps/mobile/src/store.ts` - pending callback lifecycle, active-note lifecycle, mobile-global UI state if needed
- Modify: `apps/mobile/src/lib/note-workflow.ts` - workflow helpers for title uniqueness, link syncing, and save/promotion semantics
- Modify: `apps/mobile/src/components/MarkdownInput.tsx` - read-only/preview behavior if used in note detail
- Modify: `apps/mobile/src/components/GraphCanvas.tsx` - tab UI overlap issues only if rooted here
- Test/verify against: `apps/desktop/src/App.tsx`, `apps/desktop/src/screens/InboxScreen.tsx`, `apps/desktop/src/screens/ReviewScreen.tsx`, `apps/desktop/src/screens/LibraryScreen.tsx`, `apps/desktop/src/screens/GraphScreen.tsx`, `apps/desktop/src/screens/TrashScreen.tsx`

### Task 1: Capture Parity Baseline

**Files:**
- Modify: `docs/superpowers/specs/2026-04-21-mobile-parity-audit-design.md`
- Create: `docs/superpowers/specs/2026-04-21-mobile-parity-findings.md`
- Test/verify against: `apps/desktop/src/App.tsx`, `apps/mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Write the findings document skeleton**

```md
# Mobile Parity Findings

## Severity Legend

- High
- Medium
- Low

## Findings

### High

### Medium

### Low
```

- [ ] **Step 2: Save the findings skeleton**

Use `apply_patch` to create:

`docs/superpowers/specs/2026-04-21-mobile-parity-findings.md`

Expected: file exists and is ready to collect findings.

- [ ] **Step 3: Compare desktop and mobile top-level product structure**

Review these files side-by-side:

```ts
// Desktop reference
apps/desktop/src/App.tsx

// Mobile target
apps/mobile/app/(tabs)/_layout.tsx
apps/mobile/app/_layout.tsx
```

Record at least:

```md
- High - Parity bug - `apps/mobile/app/(tabs)/_layout.tsx`: mobile tab labels differ from desktop product concepts.
- High - UI bug - `apps/mobile/app/(tabs)/_layout.tsx`: tab bar renders only one visible trigger in the reported state.
```

- [ ] **Step 4: Run the current mobile verification baseline**

Run:

```bash
pnpm --filter @zettelkasten/mobile typecheck
```

Expected: PASS.

Run:

```bash
pnpm typecheck
```

Expected: desktop typecheck fails with the known CodeMirror / `@types/react` incompatibility while mobile still passes.

- [ ] **Step 5: Commit the baseline findings snapshot**

```bash
git add docs/superpowers/specs/2026-04-21-mobile-parity-findings.md
git commit -m "docs: capture mobile parity findings baseline"
```

### Task 2: Fix Top-Level Naming And Tab Structure Parity

**Files:**
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`
- Modify: `apps/mobile/app/_layout.tsx`
- Modify: `apps/mobile/app/(tabs)/index.tsx`
- Modify: `apps/mobile/app/(tabs)/workspace.tsx`
- Create or modify: `apps/mobile/app/(tabs)/review.tsx`

- [ ] **Step 1: Write the failing parity expectation in the findings doc**

Add explicit findings like:

```md
- High - Parity bug - `apps/mobile/app/(tabs)/_layout.tsx`: mobile uses `Editor` tab label while desktop uses `Review` as the processing surface.
- High - Parity bug - `apps/mobile/app/(tabs)/workspace.tsx`: mobile collapses review and note editing into a single tab route instead of matching desktop workflow language.
```

- [ ] **Step 2: Change the tab trigger label from `Editor` to `Review`**

Update `apps/mobile/app/(tabs)/_layout.tsx` to this shape:

```tsx
<NativeTabs.Trigger name="review">
  <NativeTabs.Trigger.Label>Review</NativeTabs.Trigger.Label>
</NativeTabs.Trigger>
```

Keep the other product names aligned with desktop:

```tsx
<NativeTabs.Trigger name="index">
  <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
</NativeTabs.Trigger>
<NativeTabs.Trigger name="library">
  <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
</NativeTabs.Trigger>
<NativeTabs.Trigger name="graph">
  <NativeTabs.Trigger.Label>Graph</NativeTabs.Trigger.Label>
</NativeTabs.Trigger>
```

- [ ] **Step 3: Create `apps/mobile/app/(tabs)/review.tsx` as the desktop-aligned processing entry point**

Start with a thin route that renders the current workspace implementation while preserving file-level separation:

```tsx
export { default } from './workspace'
```

This preserves behavior first while fixing product naming and route parity.

- [ ] **Step 4: Remove the old tab entry for `workspace`**

Update `apps/mobile/app/(tabs)/_layout.tsx` so only desktop-aligned product tabs remain visible.

Expected tabs:

```tsx
Inbox
Review
Library
Graph
```

- [ ] **Step 5: Update all mobile navigation calls that target the old tab route**

Replace:

```ts
router.navigate('/(tabs)/workspace')
```

with:

```ts
router.navigate('/(tabs)/review')
```

Apply in:

```ts
apps/mobile/app/(tabs)/index.tsx
apps/mobile/app/(tabs)/library.tsx
apps/mobile/app/(tabs)/graph.tsx
```

- [ ] **Step 6: Run typecheck to verify the route rename**

Run:

```bash
pnpm --filter @zettelkasten/mobile typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit the naming and route parity fix**

```bash
git add apps/mobile/app/(tabs)/_layout.tsx apps/mobile/app/(tabs)/index.tsx apps/mobile/app/(tabs)/library.tsx apps/mobile/app/(tabs)/graph.tsx apps/mobile/app/(tabs)/review.tsx
git commit -m "fix: align mobile tabs and review naming with desktop"
```

### Task 3: Fix Tab Bar UI Rendering Bug

**Files:**
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`
- Modify: `apps/mobile/src/theme.ts`
- Test/verify with: screenshot/device reproduction on iOS simulator or device

- [ ] **Step 1: Reproduce the broken tab state and document it**

Run the mobile app and verify the screenshot symptom:

```bash
pnpm --filter @zettelkasten/mobile start
```

Expected: bottom tab bar shows only the active pill instead of all four tabs in at least one state.

- [ ] **Step 2: Compare the current NativeTabs configuration with Expo Router NativeTabs expectations**

Review `apps/mobile/app/(tabs)/_layout.tsx` and keep the configuration minimal:

```tsx
<NativeTabs
  blurEffect="systemMaterialDark"
  backgroundColor={BG.panel}
  tintColor={TEXT.primary}
>
```

Avoid unsupported or misleading props that can suppress or restyle labels unexpectedly.

- [ ] **Step 3: Remove custom label styling if it interferes with native rendering**

If the issue reproduces with current `labelStyle`, change from:

```tsx
labelStyle={{ color: TEXT.secondary, fontFamily: FONT.ui, fontSize: 11 }}
```

to either no custom label styling or the smallest safe override:

```tsx
<NativeTabs
  blurEffect="systemMaterialDark"
  backgroundColor={BG.panel}
  tintColor={TEXT.primary}
>
```

- [ ] **Step 4: Verify all four tab triggers render visibly**

Expected visible labels:

```text
Inbox
Review
Library
Graph
```

If the bar still renders one item, inspect whether `unstable-native-tabs` requires icons for multi-tab display on the current SDK and add minimal icons only if required by the platform API.

- [ ] **Step 5: Run typecheck after the tab UI fix**

Run:

```bash
pnpm --filter @zettelkasten/mobile typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the tab bar UI fix**

```bash
git add apps/mobile/app/(tabs)/_layout.tsx apps/mobile/src/theme.ts
git commit -m "fix: restore full mobile tab bar rendering"
```

### Task 4: Restore Review Screen State Parity

**Files:**
- Modify: `apps/mobile/app/(tabs)/workspace.tsx`
- Modify: `apps/mobile/src/lib/note-workflow.ts`
- Modify: `apps/mobile/src/store.ts`
- Test/verify against: `apps/desktop/src/screens/ReviewScreen.tsx`

- [ ] **Step 1: Write the failing findings for review-state mismatches**

Add findings like:

```md
- High - Runtime bug - `apps/mobile/app/(tabs)/workspace.tsx:68`: linked note ids are reset to `[]` when a note is opened and are never loaded from persistence.
- High - Parity bug - `apps/mobile/app/(tabs)/workspace.tsx`: Review screen does not preserve the same note-processing state as desktop for existing literature and permanent notes.
```

- [ ] **Step 2: Load persisted linked ids when opening a non-fleeting note**

Update the note initialization path in `apps/mobile/app/(tabs)/workspace.tsx` to follow the desktop pattern:

```tsx
useEffect(() => {
  if (!db || !activeNote) return
  if (activeNote.type === 'fleeting') {
    setLinkedIds([])
    return
  }

  getLinkedNoteIds(db, activeNote.id).then(setLinkedIds)
}, [db, activeNote])
```

Import from core:

```ts
import { getLinkedNoteIds } from '@zettelkasten/core'
```

- [ ] **Step 3: Stop losing source display state when a source is picked**

Change the source-loading effect from using only `activeNote.source_id` to the live draft source value:

```tsx
useEffect(() => {
  if (!db || !sourceId) {
    setSource(null)
    return
  }
  getSourceById(db, sourceId).then(setSource)
}, [db, sourceId])
```

This keeps the chosen source label visible before promotion.

- [ ] **Step 4: Remove duplicate wikilink syncing on autosave**

Current mobile code does both:

```ts
await savePersistedNote(db, activeNote, { title, content })
await syncWikilinksToLinks(db, activeNote.id, content)
```

Keep only the transaction-safe helper:

```ts
await savePersistedNote(db, activeNote, { title, content })
```

because `savePersistedNote` already calls `syncWikilinksToLinks`.

- [ ] **Step 5: Run the mobile typecheck**

Run:

```bash
pnpm --filter @zettelkasten/mobile typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the Review state fix**

```bash
git add apps/mobile/app/(tabs)/workspace.tsx apps/mobile/src/lib/note-workflow.ts apps/mobile/src/store.ts
git commit -m "fix: restore mobile review state parity"
```

### Task 5: Fix Link Picker Data Loss

**Files:**
- Modify: `apps/mobile/app/link-picker.tsx`
- Modify: `apps/mobile/app/(tabs)/workspace.tsx`
- Test/verify against: `apps/desktop/src/components/workspace/NoteWorkspace.tsx`

- [ ] **Step 1: Write the failing findings for link picker behavior**

Add findings like:

```md
- High - Runtime bug - `apps/mobile/app/link-picker.tsx:25`: picker clears all previous linked-note selections when opened, causing silent data loss on Done.
```

- [ ] **Step 2: Pass the current selection into the pending callback setup**

Change the store callback shape in `apps/mobile/app/(tabs)/workspace.tsx` from:

```ts
setPendingLinkCallback((ids) => {
  setLinkedIds(ids)
})
```

to:

```ts
setPendingLinkCallback((ids) => {
  setLinkedIds(ids)
})
router.push({ pathname: '/link-picker', params: { selected: linkedIds.join(',') } })
```

- [ ] **Step 3: Initialize the picker from route params**

In `apps/mobile/app/link-picker.tsx`, read the current selection:

```tsx
const { selected } = useLocalSearchParams<{ selected?: string }>()

useEffect(() => {
  setSelectedIds(selected ? selected.split(',').filter(Boolean) : [])
}, [selected])
```

- [ ] **Step 4: Preserve selection when loading notes**

Keep the effect from resetting `selectedIds` to empty on mount. Replace:

```ts
setSelectedIds([])
```

with no reset, so the incoming route param remains the source of truth.

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm --filter @zettelkasten/mobile typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the link-picker fix**

```bash
git add apps/mobile/app/link-picker.tsx apps/mobile/app/(tabs)/workspace.tsx
git commit -m "fix: preserve mobile link picker selections"
```

### Task 6: Fix Refresh And Re-entry Bugs Across Screens

**Files:**
- Modify: `apps/mobile/app/(tabs)/library.tsx`
- Modify: `apps/mobile/app/(tabs)/graph.tsx`
- Modify: `apps/mobile/app/trash.tsx`
- Modify: `apps/mobile/app/note/[id].tsx`

- [ ] **Step 1: Write the failing findings for stale screen state**

Add findings like:

```md
- Medium - Runtime bug - `apps/mobile/app/(tabs)/library.tsx`: Library only loads on mount and can show stale notes after processing or restore flows.
- Medium - Runtime bug - `apps/mobile/app/(tabs)/graph.tsx`: Graph only loads on mount and can show stale nodes and links after note changes.
- Medium - Runtime bug - `apps/mobile/app/trash.tsx`: Trash only loads on mount and can show stale restore/delete state when revisited.
```

- [ ] **Step 2: Add focus-based reloads to Library**

Use the same pattern already used in Inbox:

```tsx
useFocusEffect(useCallback(() => {
  loadNotes()
}, [loadNotes]))
```

Import:

```ts
import { useFocusEffect } from '@react-navigation/native'
```

- [ ] **Step 3: Add focus-based reloads to Graph and Trash**

Apply the same pattern to:

```tsx
apps/mobile/app/(tabs)/graph.tsx
apps/mobile/app/trash.tsx
```

so navigation back to those screens refreshes persisted state.

- [ ] **Step 4: Fix note detail loading deadlock when `db` or `id` is missing initially**

In `apps/mobile/app/note/[id].tsx`, replace:

```tsx
if (!db || !id) return
```

with:

```tsx
if (!db || !id) {
  setLoading(false)
  setNote(null)
  return
}
```

and reset loading before a real fetch:

```tsx
setLoading(true)
getNoteById(db, id).then((n) => {
  setNote(n ?? null)
  setLoading(false)
})
```

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm --filter @zettelkasten/mobile typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the screen refresh fixes**

```bash
git add apps/mobile/app/(tabs)/library.tsx apps/mobile/app/(tabs)/graph.tsx apps/mobile/app/trash.tsx apps/mobile/app/note/[id].tsx
git commit -m "fix: refresh mobile screens on re-entry"
```

### Task 7: Fix Source Picker Edge Cases

**Files:**
- Modify: `apps/mobile/app/source-picker.tsx`
- Modify: `apps/mobile/app/(tabs)/workspace.tsx`

- [ ] **Step 1: Write the failing findings for source picker parity**

Add findings like:

```md
- Medium - Runtime bug - `apps/mobile/app/source-picker.tsx`: pending source callback is never cleared and can leak stale selection behavior across future opens.
- Medium - Parity bug - `apps/mobile/app/(tabs)/workspace.tsx`: chosen source label can lag behind the draft source state.
```

- [ ] **Step 2: Clear the pending source callback after selection**

In `apps/mobile/app/source-picker.tsx`, update selection flow to:

```tsx
const { db, pendingSourceCallback, setPendingSourceCallback } = useAppStore()

const handleSelect = useCallback((id: string) => {
  pendingSourceCallback?.(id)
  setPendingSourceCallback(null)
  router.back()
}, [pendingSourceCallback, setPendingSourceCallback, router])
```

- [ ] **Step 3: Clear the pending source callback when dismissing without selection**

Add cleanup:

```tsx
useEffect(() => {
  return () => setPendingSourceCallback(null)
}, [setPendingSourceCallback])
```

- [ ] **Step 4: Verify deletion still blocks in-use sources and refreshes list state**

Expected runtime behavior:

```text
Delete in-use source -> Alert with core error message
Delete unused source -> source disappears from list
```

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm --filter @zettelkasten/mobile typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the source picker fix**

```bash
git add apps/mobile/app/source-picker.tsx apps/mobile/app/(tabs)/workspace.tsx apps/mobile/src/store.ts
git commit -m "fix: tighten mobile source picker state"
```

### Task 8: Align Review Header And Empty-State Terminology

**Files:**
- Modify: `apps/mobile/app/(tabs)/workspace.tsx`
- Modify: `apps/mobile/app/(tabs)/review.tsx`
- Test/verify against: `apps/desktop/src/screens/ReviewScreen.tsx`

- [ ] **Step 1: Write the failing parity findings for screen copy**

Add findings like:

```md
- Medium - Parity bug - `apps/mobile/app/(tabs)/workspace.tsx`: screen title and empty-state copy use `Workspace` language instead of desktop `Review` language.
```

- [ ] **Step 2: Update header and empty-state labels to desktop terminology**

Replace mobile copy such as:

```tsx
<Text style={styles.headerTitle}>Workspace</Text>
<Text style={styles.emptyMessage}>Select a note from Inbox or create a new one</Text>
```

with desktop-aligned copy:

```tsx
<Text style={styles.headerTitle}>Review</Text>
<Text style={styles.emptyMessage}>Select a note from Inbox to review</Text>
```

- [ ] **Step 3: Ensure the active-note title does not replace the screen concept label in the main header**

Keep product naming stable:

```tsx
<Text style={styles.headerTitle}>Review</Text>
```

If needed, move the note title into the content area instead of the top app-level title.

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm --filter @zettelkasten/mobile typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the terminology parity fix**

```bash
git add apps/mobile/app/(tabs)/workspace.tsx apps/mobile/app/(tabs)/review.tsx
git commit -m "fix: align mobile review terminology with desktop"
```

### Task 9: Final Audit Sweep And Verification

**Files:**
- Modify: `docs/superpowers/specs/2026-04-21-mobile-parity-findings.md`
- Verify: mobile files changed in prior tasks

- [ ] **Step 1: Re-run the parity audit against desktop flows**

Check these paths again:

```ts
apps/desktop/src/App.tsx
apps/desktop/src/screens/InboxScreen.tsx
apps/desktop/src/screens/ReviewScreen.tsx
apps/desktop/src/screens/LibraryScreen.tsx
apps/desktop/src/screens/GraphScreen.tsx
apps/desktop/src/screens/TrashScreen.tsx
```

Update the findings doc so fixed issues are either removed or marked resolved.

- [ ] **Step 2: Run the mobile verification suite**

Run:

```bash
pnpm --filter @zettelkasten/mobile typecheck
```

Expected: PASS.

Run:

```bash
pnpm typecheck
```

Expected: same known desktop CodeMirror failure only; no new mobile failures.

- [ ] **Step 3: Run targeted manual verification on device or simulator**

Verify these flows:

```text
1. Capture fleeting note from Inbox
2. Open Review and promote to literature with source
3. Save literature note as permanent with bootstrap logic
4. Re-open saved permanent note and confirm linked ids persist
5. Open Library after processing and confirm refreshed state
6. Open Graph after processing and confirm refreshed nodes
7. Delete note, open Trash, restore note, confirm it reappears in the proper screen
8. Confirm bottom tab bar visibly shows Inbox, Review, Library, Graph
```

- [ ] **Step 4: Commit the final audit closure updates**

```bash
git add docs/superpowers/specs/2026-04-21-mobile-parity-findings.md
git commit -m "docs: close resolved mobile parity findings"
```
