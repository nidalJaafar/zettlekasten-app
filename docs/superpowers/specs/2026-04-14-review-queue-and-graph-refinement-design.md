# Review Queue And Graph Refinement Design

## Goal

Improve two parts of the desktop app:

1. Make the Review queue feel clearer, calmer, and easier to scan.
2. Make the Graph feel stable during node inspection, while increasing node spacing.
3. Add a trash workflow for deleted notes.
4. Keep title-based wikilinks in sync when a note is renamed.
5. Make note viewing open in Preview mode by default and make Code View feel more like a real editor.
6. Make major layout dividers draggable and resizable like Obsidian or VS Code.

The work should preserve the current app structure and interaction model while fixing the specific UX problems the user reported.

## Problems

### Review queue

Current Review items are too compressed and visually weak:

- the rows feel cramped
- title, type, and action do not have strong hierarchy
- the action button looks tertiary instead of primary
- the list feels flat and visually under-designed

### Graph

Current graph inspection feels unstable:

- clicking a node causes the graph to zoom out and redraw
- selection changes rebuild the SVG and restart the simulation
- zoom/pan state is lost during ordinary inspection
- nodes are too close together in dense clusters

### Note deletion

There is currently no user-facing trash workflow, even though the core layer already supports soft deletion through `deleted_at`.

The app needs a deletion workflow that:

- is available from the note workspace
- is clearly destructive
- asks for confirmation before deleting
- removes the deleted note from normal app surfaces after deletion
- gives the user a place to review deleted notes
- lets the user recover or permanently delete a trashed note

### Wikilink title drift

Wikilinks are title-based in note content. Right now, renaming a note can leave stored `[[Title]]` references pointing at the old title text.

The app needs rename propagation so that:

- changing a note title updates matching wikilinks in stored note content
- title-based navigation keeps working after renames
- alias text remains intact when only the target title should change

### Editor feel

The current code view still feels too much like a form field.

The app needs:

- Preview mode as the default when opening an existing note
- a more editor-like code surface for markdown editing
- clearer visual distinction between Preview and Code View
- a VS Code-inspired editing feel without turning the app into a full IDE

### Fixed layout widths

The app currently uses fixed widths for major layout regions, so the user cannot tune the workspace the way they can in tools like Obsidian or VS Code.

The app needs draggable separators for major layout columns so users can adjust space allocation while working.

## Review Design

### Layout

Replace the current compressed single-line queue rows with roomier two-line cards.

Each card will have three zones:

1. Top row
- note title on the left
- note type chip on the right

2. Middle row
- 1-2 line content preview when content exists
- fallback helper text when content is empty

3. Bottom row
- quiet metadata on the left
- primary `Open in Workspace` action on the right

### Visual hierarchy

- Use `Poppins` for all UI text.
- Keep the title as the strongest text element.
- Replace the loose uppercase type label with a compact filled chip using the existing note type color.
- Promote the open action into a clearer button with stronger contrast and hit area.
- Increase padding, vertical spacing, and border radius slightly so the queue feels deliberate instead of cramped.
- Keep hover behavior subtle and aligned with the existing dark theme.

### Content rules

- Title remains single-source from the note.
- Preview text is truncated to 1-2 lines.
- If note content is empty, render a muted fallback such as `No body yet`.
- Metadata stays quiet and secondary so the card remains easy to scan.

## Graph Design

### Interaction behavior

Clicking a node inside the graph should inspect the note without resetting the camera or rebuilding the whole graph.

Expected behavior:

- preserve current zoom and pan when selecting a node
- preserve the current overall layout during ordinary inspection clicks
- update selected-node styling in place
- update the inspector panel in place
- only recenter when the graph focus changes from outside the graph, such as opening a note from another screen or changing the workspace target

### Layout behavior

Increase spacing in both full graph mode and context graph mode by adjusting the graph forces.

Changes:

- increase link distance
- increase collision radius slightly
- keep the current small node sizing
- keep the current graph style and inspector model

The graph should feel more breathable without drifting into an overly sparse layout.

## Deletion Design

### Placement

Add the initial delete action to the workspace context pane for persisted notes only.

- Do not show delete for brand new draft targets.
- Show delete for saved fleeting, literature, and permanent notes.

This keeps deletion in the place where the user is already editing or inspecting a note.

Add a dedicated `Trash` page in the main sidebar where users can manage deleted notes.

### Interaction

- Use a clearly destructive button style in the context pane.
- Require a confirmation step before deleting.
- On confirm, soft-delete the note.
- After deletion, navigate away from the deleted note to a safe state, preferably back to the Inbox screen or an empty workspace state.
- Refresh any derived counts or lists that depend on visible notes.

On the Trash page:

- show deleted notes in a readable list
- allow `Restore` to clear `deleted_at`
- allow `Delete Permanently` to remove the note row and associated note links
- require confirmation for permanent deletion

### Data behavior

- Use existing soft-delete behavior instead of hard deletion.
- Deleted notes should disappear from Review, Library, Graph, and normal workspace navigation because those surfaces already rely on `deleted_at IS NULL` queries.
- Restored notes should return to normal app surfaces automatically.
- Permanently deleted notes should be removed from `notes` and any related `note_links` rows.

## Trash Page Design

### Navigation

- add `Trash` to the main sidebar navigation
- treat it as a first-class screen like Inbox, Review, Library, and Graph

### Layout

Use a calm management view rather than a dense admin table.

Each trash item should show:

- title
- note type chip
- short content preview or fallback text
- deleted timestamp or relative deletion label
- `Restore` action
- `Delete Permanently` action

### Empty state

If trash is empty, show a quiet empty state that explains deleted notes land here first before permanent removal.

## Editor Design

### Default mode

- opening an existing note should default to `Preview`
- brand new draft creation may stay in `Code View` so writing can begin immediately

### Code View treatment

Make Code View feel VS Code-inspired rather than form-like.

Changes:

- wrap Code View in a stronger editor frame
- add a slim editor chrome row above the content area
- include a clear mode label and markdown/editor context
- use a real editor surface with visible boundaries, not loose page text
- make gutters, active line treatment, and editor background feel intentional

This should feel like an embedded editor, not a textarea inside a form.

### Preview treatment

- Preview should stay cleaner and calmer than Code View
- Preview should use the UI reading font (`Poppins`)
- Code View should use the code font (`Fira Code`)
- switching between the two should feel explicit and easy to read

## Resizable Layout Design

### Scope

Add draggable separators for the main desktop layout regions that are visually framed as columns or panes.

Initial targets:

- app sidebar versus main content area
- workspace rail versus document pane
- workspace document pane versus right context column

### Interaction

- separators should show a resize cursor on hover
- dragging should update widths live
- widths should be clamped to sensible minimums so panes cannot collapse into unusable states
- the interaction should feel calm and direct, not springy or animated

### Persistence

- persist pane sizes locally so the layout stays the way the user left it
- use a lightweight client-side persistence mechanism appropriate for the desktop app

### Defaults

- keep good starting widths for first launch
- if saved values are missing or invalid, fall back to sane defaults

## Wikilink Rename Design

### Trigger

Run wikilink-title propagation when a persisted note title is changed from one non-empty value to another.

### Update behavior

When renaming `Old Title` to `New Title`:

- replace stored `[[Old Title]]` with `[[New Title]]`
- replace stored `[[Old Title|Alias]]` with `[[New Title|Alias]]`
- do not modify plain text occurrences outside wikilinks
- do not modify unrelated links whose target text is different

### Scope

- apply the update across persisted notes in the database
- keep the implementation deterministic and string-based
- avoid introducing a larger markdown AST dependency for this behavior

## Implementation Outline

### Review screen

- update `ReviewScreen.tsx` card markup to support a three-zone layout
- use existing theme tokens for colors, borders, and fonts
- keep existing review actions and queue-loading behavior unchanged

### Note deletion

- use the existing core soft-delete function rather than adding a new persistence path
- surface deletion from `NoteWorkspace` through `NoteContextPane`
- confirm before deleting and then clear or redirect the workspace target
- refresh inbox count and any visible note lists after deletion
- add a `TrashScreen` plus sidebar navigation entry
- add restore and permanent-delete core helpers and use them from the trash UI

### Wikilink rename propagation

- detect title changes during persisted-note saves in `NoteWorkspace`
- run a content update pass that rewrites matching wikilinks in other notes
- keep the existing note-link table behavior unchanged
- preserve alias text inside wikilinks while updating the linked title

### Editor experience

- set existing-note opens to Preview mode by default in the workspace
- keep draft-note creation optimized for writing
- refine `MarkdownEditor` styling and surrounding chrome so Code View feels like an editor surface
- avoid changing the underlying editor library unless the current library cannot support the desired feel

### Resizable layout

- add reusable pane-resize behavior rather than custom one-off mouse logic in each component if possible
- apply it to the main sidebar and workspace column boundaries
- clamp and persist widths locally
- preserve the current overall app structure while making widths user-adjustable

### Graph canvas

- refactor `GraphCanvas.tsx` so SVG setup, zoom state, and simulation instance are not discarded on ordinary selection changes
- separate graph initialization from selection-style updates where practical
- retain selection highlighting and inspector updates without rebuilding the graph container
- adjust force constants for more node spacing in `full` and `context` modes

### Graph screen and context graph

- preserve current public props if possible
- continue passing selected/focused note IDs from parent components
- make selection changes cheap so node clicks do not reset the graph view

## Error Handling

- Review should continue rendering even when note content is empty.
- Graph should keep current graceful behavior when there are no notes or no links.
- If a selected note disappears from the filtered graph set, clear selection as it does today.

## Testing

Add or update tests for:

- Review queue card structure and primary action rendering
- graph selection behavior that should not require full graph teardown on simple selection changes
- increased graph spacing behavior where it can be asserted through implementation-level tests
- workspace deletion flow and confirmation behavior
- trash page listing, restore flow, and permanent-delete flow
- wikilink title propagation when a note is renamed
- default preview mode for existing notes and VS Code-like editor presentation cues
- resizable sidebar and workspace column layout behavior

Manual verification should cover:

- Review list readability with fleeting and literature notes
- graph node click preserving zoom/pan state
- graph spacing improvement in both full and context views

## Scope Boundaries

Included:

- Review queue visual redesign
- graph selection stability improvements
- moderate graph spacing increase
- workspace delete-note action for persisted notes
- trash page with restore and permanent delete
- title-based wikilink propagation on rename
- preview-first note opening and a stronger code-editor presentation
- draggable and persistent major pane widths

Not included:

- a brand new graph visualization system
- major changes to graph inspector content
- changes to note data model or persistence
- broad restyling of unrelated screens
- deletion controls added to every screen and inspector surface at once
