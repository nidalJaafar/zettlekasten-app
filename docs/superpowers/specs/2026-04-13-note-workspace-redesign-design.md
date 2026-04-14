# Note Workspace Redesign Design

**Date:** 2026-04-13  
**Scope:** Rework the desktop app so notes become first-class documents with a dedicated workspace, integrated editing, and a contextual graph for navigation.  
**Out of scope:** Changing the core note model, changing promotion rules, or redesigning the imported vault data itself.

## Problem

The current desktop app treats notes as secondary objects inside screen-specific flows.

- `ReviewScreen` contains the only real editor.
- `NoteModal` is cramped and read-only in practice.
- `GraphScreen` is visually isolated and weak as a day-to-day note navigation tool.
- Inbox, Library, Review, and Graph feel like separate products instead of different ways to work with the same notes.

This makes writing, editing, and even reading notes feel clunky.

## Goals

- Make every note type a first-class document that can be opened and edited directly.
- Introduce a dedicated note workspace as the primary place for reading and writing.
- Replace modal-style note viewing with a comfortable full-page document surface.
- Turn the graph into a contextual navigation tool that supports note work.
- Keep the existing Zettelkasten rules for fleeting, literature, and permanent notes.
- Preserve the app's dark editorial tone while making the product feel more serious and usable.

## Non-Goals

- Replacing the underlying SQLite schema or core `Note` model.
- Removing the fleeting -> literature -> permanent progression.
- Adding collaborative editing, version history, or advanced markdown tooling.
- Turning the graph into a heavy analysis product with clustering, statistics, or multi-mode visual analytics.

## Chosen Direction

Dedicated workspace plus contextual graph.

The app should feel like opening and moving through living documents, not like stepping between disconnected screens. The most important change is architectural and experiential: note work becomes central, while list screens and graph views become ways to enter and navigate that central workspace.

## Structure

### Primary navigation model

The desktop app should gain a persistent `Note Workspace` screen that becomes the main reading and editing surface.

Inbox, Library, Review, and Graph remain useful, but they stop being isolated destinations. Their primary job becomes selecting a note or workflow target that opens into the shared workspace.

### Workspace layout

The workspace should have three coordinated regions:

- a left rail for note sets and note switching
- a central document pane for title and body editing
- a right context pane for source metadata, links, actions, and graph context

The document pane should be visually dominant. It should feel like a page, not a widget.

### Screen roles after redesign

#### Inbox

Inbox remains the fastest place to capture fleeting notes, but selecting an item opens it into the workspace instead of routing the user into a special-case review editor.

#### Library

Library becomes a browsable archival index of processed literature notes and other durable material, but viewing or editing happens in the workspace.

#### Review

Review remains responsible for progression rules and queue management, but it should no longer be the app's only substantial editor. Its role becomes workflow guidance, not ownership of note editing.

#### Graph

Graph stops being a disconnected full-canvas destination by default. The default graph experience becomes contextual and tied to the active note. A larger map mode may still exist, but it should share the same selection model as the workspace.

## Interaction Model

### Opening notes

Opening a note from any surface should load it into the workspace rather than showing a modal. This applies to fleeting, literature, and permanent notes.

The workspace should become the single place where note reading and editing happen.

### Editing model

The viewer should also be the editor. Notes should not switch between a separate read mode and edit mode for normal use.

- title is directly editable
- body is directly editable in a real markdown writing surface
- linked notes are directly navigable
- source metadata and note metadata are editable in context where applicable

### Save behavior

Auto-save should be the default.

- content changes debounce before persistence
- the UI shows lightweight status such as `Saving...`, `Saved`, or `Unsaved changes`
- save feedback should be visible but quiet

The goal is confidence without friction.

### Type-specific behavior

All note types share the same workspace shell, but the side actions adapt to the note:

#### Fleeting notes

- emphasize quick refinement
- allow source attachment
- allow promotion into literature
- keep controls light and fast

#### Literature notes

- keep source context visible
- allow continued editing of the literature note itself
- show links to related permanent notes
- support marking the note as processed or promoting it onward through existing rules

#### Permanent notes

- emphasize backlinks, linked notes, and graph context
- preserve direct editing in the same document surface
- keep the note at the center of navigation

## Graph Design

### Role

The graph should be best at contextual navigation.

Its job is to help the user move between connected notes, stay oriented, and discover nearby ideas while reading or editing. It is not primarily a decorative background and not primarily an analytics dashboard.

### Default graph behavior

Inside the workspace, the graph should show a focused neighborhood view centered on the active note.

- active note is visually dominant
- immediate linked notes are visible by default
- one additional hop may be shown for context when legible
- selecting a node opens that note in the workspace and recenters the graph

### Graph interactions

The graph should support:

- stable centering around the active note
- clear selection and neighbor emphasis
- search that jumps to a note and recenters the graph
- lightweight filters such as note type or neighborhood depth
- expansion into a larger map view when broader exploration is needed

### Full-map mode

If the app keeps a larger graph screen, it should be an expanded view of the same graph model, not a separate graph experience.

The workspace graph and full-map graph should share note selection state and navigation behavior.

## State and Data Flow

The desktop app should gain first-class active-note state at the app level.

The current event model already routes note-opening through `App.tsx`. That should evolve into a more explicit active note workflow rather than dispatching to a modal.

Required high-level state concepts:

- active note identity
- active note draft state
- save status for the current note
- contextual graph state derived from the active note
- source and link metadata shown alongside the current note

The existing core APIs for note creation, updating, and linking should remain the base layer unless small additions are required to support a cleaner desktop implementation.

## Visual Direction

The redesign should stay within the established editorial dark language, but it should become more document-centric and less screen-centric.

Design targets:

- a central writing page with stronger reading comfort
- less modal chrome and fewer cramped overlays
- clearer hierarchy between navigation, document, and context
- graph visuals that feel informative and calm rather than floaty and detached
- faster traversal between notes with less UI friction

The most memorable quality should be that notes feel like the real product.

## Implementation Boundaries

This redesign will primarily affect the desktop app:

- `apps/desktop/src/App.tsx`
- note viewing and editing components such as `NoteModal.tsx` and `MarkdownEditor.tsx`
- screen components that currently own isolated note experiences
- graph components and graph state flow

It may also justify a few focused shared components for workspace layout, note metadata, note status, or contextual graph controls if that improves clarity.

Core package changes should stay minimal and only support desktop needs that cannot be expressed cleanly with the current exported functions.

## Success Criteria

- Any note can be opened directly into a full-page workspace.
- Any note can be edited directly in that workspace.
- Auto-save makes editing feel immediate and reliable.
- The note modal is no longer needed for normal note reading.
- The graph is useful for moving between notes while working.
- Review no longer feels like the only place where note work truly happens.
- The desktop app still respects current note-type and promotion rules.
- Desktop typecheck passes after the redesign.

## Verification

- `pnpm typecheck`
- manual desktop verification for opening and editing fleeting, literature, and permanent notes
- manual check that auto-save feedback is correct when switching notes
- manual check that source attachment and link interactions still work
- manual check that graph selection opens notes and recenters around the active note
- manual check that imported literature notes and permanent notes remain usable in the new workspace

## Chosen Approach

Make notes the center of the desktop application by introducing a dedicated note workspace with integrated editing, then reposition the graph as a contextual navigation surface around the active note.
