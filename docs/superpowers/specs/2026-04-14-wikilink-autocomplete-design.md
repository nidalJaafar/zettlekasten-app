# Wikilink Autocomplete Design

## Goal

Make title-based wikilinks easier to author by adding inline autocomplete when typing `[[...]]`, including the ability to create a new fleeting note directly from the picker.

## Problem

The app already understands title-based wikilinks in markdown text, but creating them manually is slow and error-prone. Users should be able to type `[[` and get note suggestions immediately, search within those suggestions, and create a missing note inline without breaking writing flow.

## Design

### Authoring flow

- Typing `[[` opens a small inline picker near the cursor.
- Continuing to type filters existing notes by title.
- The picker should feel lightweight and editor-native, not like a modal or separate screen.

### Selection behavior

- Arrow keys move through results.
- `Enter` inserts the highlighted result.
- `Esc` closes the picker.
- Selecting a note inserts a title-based wikilink: `[[Note Title]]`.

### Create-new behavior

- When there is no good match, the picker offers `Create new fleeting note "..."`.
- Selecting that option immediately creates a new `fleeting` note with that title.
- The editor then inserts `[[New Title]]` and keeps focus in the writing flow.
- The new note should be available to future picker searches immediately.

### Data behavior

- Wikilinks remain title-based markdown text.
- Existing note-link syncing remains the single path that resolves wikilinks into `note_links`.
- No separate graph-only linking mechanism should be added.

### Graph behavior

- Links created through autocomplete must flow into the graph through the existing sync pipeline.
- Newly created notes should participate in future graph connections once the normal link-sync path runs.

### Scope boundary

- Suggestions come from existing notes plus the create-new option.
- AI suggestions for similar notes are explicitly deferred to a later iteration.

## Implementation outline

- Extend the markdown editor to detect an active wikilink query while typing.
- Render an inline picker anchored to the editor selection/cursor.
- Query note titles for matching suggestions.
- Support keyboard selection and insertion.
- Add a create-new callback path that creates a `fleeting` note and inserts the matching wikilink.
- Reuse existing note-link syncing rather than building a parallel graph-link system.

## Testing

Add or update tests for:

- opening the picker on `[[`
- filtering existing note suggestions by typed text
- inserting a selected existing note wikilink
- creating a new fleeting note from the picker and inserting its wikilink
- preserving graph/link sync behavior through the existing pipeline

## Scope boundaries

Included:

- inline wikilink autocomplete
- search over existing note titles
- inline creation of a new fleeting note from the picker

Not included:

- AI-based note suggestions
- alias editing UI beyond existing wikilink text behavior
- a new graph-linking subsystem
