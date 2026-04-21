# Mobile Review Workspace Structural Parity Design

## Goal

Finish the remaining desktop/mobile parity gap by separating mobile `Review` and `Workspace` into distinct destinations, matching the desktop product model.

## Approved Direction

Use a real `Review` tab plus a separate non-tab `Workspace` route.

This keeps the main navigation aligned to desktop product concepts while giving `Workspace` its own destination for detailed note processing and editing.

## Product Structure

### Main Tabs

The main mobile tabs should remain:

- `Inbox`
- `Review`
- `Library`
- `Graph`

`Workspace` should not be a tab.

### Review

`Review` is a queue and processing entry screen.

Responsibilities:

- Show the notes that need review or processing
- Provide queue-level entry into note processing
- Preserve desktop-aligned review terminology and flow intent

`Review` should feel like a screen for selecting and entering work, not the place where the full detailed editor lives.

### Workspace

`Workspace` is a separate route for detailed note editing and processing.

Responsibilities:

- Edit the selected note
- Attach source
- manage links
- confirm own-words state
- perform promote/save/delete actions

`Workspace` should open when a note is being actively worked on.

## Navigation Model

- `Inbox` sends notes into `Review`
- `Review` opens `Workspace`
- `Library` and `Graph` can also open `Workspace` when a note is selected for editing or processing
- `Workspace` should return the user to the correct parent context when leaving

The important parity rule is conceptual separation:

- `Review` = queue / entry / selection
- `Workspace` = focused work on one note

## Behavioral Expectations

### Review Screen

The screen should support desktop-style queue behavior rather than acting like a direct editor.

Expected behavior:

- list notes pending review
- allow selecting a note to open `Workspace`
- allow queue-level creation or entry actions if desktop supports them
- avoid presenting the full editor inline on the tab root

### Workspace Screen

The detailed workflow currently living in mobile `review.tsx` should move here.

Expected behavior:

- keep current fixed workflow mechanics already repaired in prior parity work
- preserve autosave behavior
- preserve source and link picker flows
- preserve promotion and permanent-note save behavior
- preserve delete behavior

## Routing Expectations

- `apps/mobile/app/(tabs)/review.tsx` becomes the queue screen
- `apps/mobile/app/workspace.tsx` or equivalent non-tab route becomes the detailed workspace destination
- the root stack should register `workspace` as a standard pushed screen or modal route according to the existing mobile routing style

The key requirement is that `Workspace` is no longer represented as the tab content for `Review`.

## Constraints

- Keep desktop naming exactly: `Review` and `Workspace`
- Do not add `Workspace` as a fifth tab
- Do not collapse the two concepts back into one route
- Preserve all previously fixed mobile workflow/state bugs while restructuring
- Keep dark-mode-only behavior

## Success Criteria

- Mobile has a distinct `Review` screen and a distinct `Workspace` screen
- Main tabs remain `Inbox`, `Review`, `Library`, `Graph`
- `Review` behaves like a queue/entry surface
- `Workspace` behaves like the detailed note work surface
- Navigation between these two concepts matches desktop intent
- Previous parity fixes remain intact after the split
