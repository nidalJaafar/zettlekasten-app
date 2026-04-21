# Mobile Review Workspace Structural Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split mobile `Review` and `Workspace` into distinct destinations so the mobile app matches the desktop product structure and behavior more closely.

**Architecture:** Keep the main tab shell unchanged with `Inbox`, `Review`, `Library`, and `Graph`. Move the detailed editor/processing workflow into a separate non-tab `workspace` route, and turn the `Review` tab into a queue/entry screen that opens `Workspace` for note-focused work.

**Tech Stack:** Expo Router, React Native, TypeScript, Zustand, existing mobile workflow helpers, @zettelkasten/core

---

## File Map

- Modify: `apps/mobile/app/_layout.tsx` - register the non-tab `workspace` route in the root stack
- Modify: `apps/mobile/app/(tabs)/review.tsx` - convert from detailed editor into queue/entry screen
- Create: `apps/mobile/app/workspace.tsx` - new non-tab detailed note work surface, migrated from current review implementation
- Modify: `apps/mobile/app/(tabs)/index.tsx` - route Inbox actions into `Review` or `Workspace` appropriately
- Modify: `apps/mobile/app/(tabs)/library.tsx` - open `Workspace` instead of the `Review` tab for selected notes
- Modify: `apps/mobile/app/(tabs)/graph.tsx` - open `Workspace` instead of the `Review` tab for selected notes
- Modify: `apps/mobile/src/store.ts` - preserve active note routing semantics if any route-specific state is needed
- Modify: `apps/mobile/src/lib/note-workflow.ts` only if extraction helpers are needed during the move
- Verify against: `apps/desktop/src/App.tsx`, `apps/desktop/src/screens/InboxScreen.tsx`, `apps/desktop/src/screens/ReviewScreen.tsx`

### Task 1: Introduce Non-Tab Workspace Route

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/workspace.tsx`
- Modify: `apps/mobile/app/(tabs)/review.tsx`

- [ ] **Step 1: Snapshot the current detailed review implementation before moving it**

The current detailed editor/process screen lives in:

```text
apps/mobile/app/(tabs)/review.tsx
```

This screen should become the basis for the new non-tab workspace route.

- [ ] **Step 2: Create `apps/mobile/app/workspace.tsx` by moving the current detailed screen implementation there**

Create the new route file with the current detailed note workflow component exported as default:

```tsx
export default function WorkspaceScreen() {
  // current detailed note processing/editor implementation moved here
}
```

Preserve the already-fixed behavior:

```text
- autosave
- source picker flow
- link picker flow
- promote to literature
- save as permanent
- delete
- review/workflow state fixes already implemented
```

- [ ] **Step 3: Register the workspace route in the root stack**

In `apps/mobile/app/_layout.tsx`, add a standard stack screen for `workspace`:

```tsx
<Stack.Screen
  name="workspace"
  options={{
    headerShown: false,
  }}
/>
```

Place it alongside the other non-tab routes.

- [ ] **Step 4: Reduce `apps/mobile/app/(tabs)/review.tsx` to a temporary placeholder screen**

Replace the old detailed editor implementation with a minimal Review entry shell for now:

```tsx
export default function ReviewScreen() {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: BG.base }}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Review</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Select a note from Inbox to start Review</Text>
        </View>
      </View>
    </SafeAreaView>
  )
}
```

This task only establishes the structural split. Queue content comes in the next task.

- [ ] **Step 5: Run mobile typecheck**

Run:

```bash
pnpm --filter @zettelkasten/mobile typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the structural route split**

```bash
git add apps/mobile/app/_layout.tsx apps/mobile/app/workspace.tsx apps/mobile/app/(tabs)/review.tsx
git commit -m "feat: split mobile review and workspace routes"
```

### Task 2: Route Existing Note-Opening Flows Into Workspace

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx`
- Modify: `apps/mobile/app/(tabs)/library.tsx`
- Modify: `apps/mobile/app/(tabs)/graph.tsx`

- [ ] **Step 1: Update Inbox note-opening flow to target workspace for detailed work**

Replace detailed-work navigation targets in `apps/mobile/app/(tabs)/index.tsx`:

```ts
router.navigate('/workspace')
```

for flows that open an active note for work.

Keep the tab itself as `Review`, but open note-focused work in `Workspace`.

- [ ] **Step 2: Update Library note opening to target workspace**

Replace:

```ts
router.navigate('/(tabs)/review')
```

with:

```ts
router.navigate('/workspace')
```

in `apps/mobile/app/(tabs)/library.tsx` after setting `activeNote`.

- [ ] **Step 3: Update Graph note opening to target workspace**

Replace:

```ts
router.navigate('/(tabs)/review')
```

with:

```ts
router.navigate('/workspace')
```

in `apps/mobile/app/(tabs)/graph.tsx` after setting `activeNote`.

- [ ] **Step 4: Keep active note ownership in store unchanged unless required**

The route split should still rely on the existing shared active note pattern:

```ts
setActiveNote(note)
router.navigate('/workspace')
```

Avoid introducing new global state unless the route split requires it.

- [ ] **Step 5: Run mobile typecheck**

Run:

```bash
pnpm --filter @zettelkasten/mobile typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the navigation-target update**

```bash
git add apps/mobile/app/(tabs)/index.tsx apps/mobile/app/(tabs)/library.tsx apps/mobile/app/(tabs)/graph.tsx
git commit -m "fix: route mobile note work into workspace"
```

### Task 3: Turn Review Into A Real Queue Screen

**Files:**
- Modify: `apps/mobile/app/(tabs)/review.tsx`
- Verify against: `apps/desktop/src/screens/ReviewScreen.tsx`

- [ ] **Step 1: Identify the desktop Review queue inputs and outputs**

Check desktop reference behavior in:

```text
apps/desktop/src/screens/ReviewScreen.tsx
```

Capture the key product role of Review:

```text
- queue / entry screen
- note selection into detailed work
- not the full inline workspace itself
```

- [ ] **Step 2: Build the mobile Review tab as a queue/entry surface**

In `apps/mobile/app/(tabs)/review.tsx`, render a list or entry state for notes needing review. Start with the smallest correct version:

```tsx
const [notes, setNotes] = useState<Note[]>([])

const loadNotes = useCallback(async () => {
  if (!db) return
  const result = await getNotesByType(db, 'fleeting')
  setNotes(result)
}, [db])
```

Then render a Review list that opens workspace:

```tsx
<Pressable onPress={() => {
  setActiveNote(item)
  router.navigate('/workspace')
}}>
```

This can be refined later, but the Review tab must become an entry surface rather than the editor itself.

- [ ] **Step 3: Preserve fixed Review terminology**

Keep the screen header and empty-state language aligned:

```tsx
<Text style={styles.headerTitle}>Review</Text>
<Text style={styles.emptyText}>No notes waiting for Review</Text>
```

Avoid any `Workspace` wording here.

- [ ] **Step 4: Add focus-based reload for the Review queue**

Use:

```tsx
useFocusEffect(useCallback(() => {
  loadNotes()
}, [loadNotes]))
```

so the queue stays fresh after returning from Workspace.

- [ ] **Step 5: Run mobile typecheck**

Run:

```bash
pnpm --filter @zettelkasten/mobile typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the Review queue screen**

```bash
git add apps/mobile/app/(tabs)/review.tsx
git commit -m "feat: make mobile review a queue screen"
```

### Task 4: Align Workspace Exit Behavior With Parent Context

**Files:**
- Modify: `apps/mobile/app/workspace.tsx`
- Modify: `apps/mobile/app/(tabs)/review.tsx` if needed for entry assumptions

- [ ] **Step 1: Update workspace back navigation to return to the right parent**

Replace tab-root back assumptions like:

```ts
router.navigate('/(tabs)')
```

with a route behavior appropriate for a non-tab screen, preferring:

```ts
router.back()
```

or, if needed for stability:

```ts
router.navigate('/(tabs)/review')
```

Use the smallest correct behavior that returns users to Review when that is the parent context.

- [ ] **Step 2: Keep delete/save/promote flows consistent with the new route split**

Verify these flows still land in a sensible place:

```text
- delete note from workspace
- save literature/permanent transitions
- open note from Library/Graph into workspace
```

Adjust only the route targets, not the workflow semantics.

- [ ] **Step 3: Run mobile typecheck**

Run:

```bash
pnpm --filter @zettelkasten/mobile typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit the workspace route-behavior alignment**

```bash
git add apps/mobile/app/workspace.tsx apps/mobile/app/(tabs)/review.tsx
git commit -m "fix: align mobile workspace exit behavior"
```

### Task 5: Final Structural Parity Verification

**Files:**
- Verify: `apps/mobile/app/(tabs)/review.tsx`
- Verify: `apps/mobile/app/workspace.tsx`
- Verify: `apps/mobile/app/_layout.tsx`
- Verify: `docs/superpowers/specs/2026-04-21-mobile-review-workspace-structural-parity-design.md`

- [ ] **Step 1: Verify structural parity against the spec**

Confirm all of the following are true:

```text
- main tabs are Inbox, Review, Library, Graph
- Workspace is not a tab
- Review is a queue/entry surface
- Workspace is the detailed note work surface
- Review opens Workspace
- Library and Graph can open Workspace
```

- [ ] **Step 2: Run mobile typecheck**

Run:

```bash
pnpm --filter @zettelkasten/mobile typecheck
```

Expected: PASS.

- [ ] **Step 3: Run broader verification to confirm no new repo-wide typecheck regressions**

Run:

```bash
pnpm typecheck
```

Expected: the same known pre-existing desktop `CodeMirror` / `@types/react` failure only.

- [ ] **Step 4: Do a manual route-flow check if available**

Verify this route behavior:

```text
1. Open Review tab and see queue-style screen
2. Select a note and enter Workspace
3. Open a note from Library and land in Workspace
4. Open a note from Graph and land in Workspace
5. Leave Workspace and confirm the user returns sensibly
```

- [ ] **Step 5: Commit any final structural parity cleanup**

```bash
git add apps/mobile/app/_layout.tsx apps/mobile/app/(tabs)/review.tsx apps/mobile/app/workspace.tsx apps/mobile/app/(tabs)/index.tsx apps/mobile/app/(tabs)/library.tsx apps/mobile/app/(tabs)/graph.tsx
git commit -m "feat: finish mobile review workspace structural parity"
```

If no final cleanup beyond earlier tasks is needed, skip this extra commit.
