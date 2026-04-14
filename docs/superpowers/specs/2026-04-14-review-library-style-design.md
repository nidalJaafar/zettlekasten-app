# Review And Workspace Readability Design

## Goal

Make the Review screen feel visually similar to the Library screen while keeping Review's existing color palette, and improve workspace readability for long titles and compact window sizes.

## Problem

The current Review screen feels too custom and too different from Library. The user wants Review to inherit the calmer, more consistent visual language of Library, but without losing Review-specific actions or changing Review's colors.

The workspace also has two readability issues:

- long note titles can get visually cut off
- the 3-column workspace becomes hard to read in compact windows

## Design

### Visual direction

- Reuse the overall Library layout style for Review.
- Keep the current Review colors as they are.
- Review should feel like `Library + actions`, not like a separate workflow dashboard.
- Prefer the Library row/card shell rather than the newer custom multi-zone Review card treatment.

### Structure

Each Review item should follow the same overall reading pattern as Library:

- left accent strip
- main content area led by title and note body preview
- quiet secondary metadata treatment integrated into the content block
- actions added in a way that does not overpower the item

The list should read as a calm stack of entries rather than as task cards.

Review items should move away from:

- boxed inner preview panels
- heavy card segmentation
- action-footer treatment that makes the row feel like a workflow widget

Review items should move toward:

- Library-style horizontal row cards
- calmer text flow
- integrated actions within the row layout

### Review-specific behavior

- Keep the Review queue loading/filtering behavior unchanged.
- Remove the `Open in Workspace` control from each row.
- Make the entire Review row clickable like Library.
- Keep type information visible, but integrated into the Library-like layout rather than emphasized as a separate card treatment.
- Use the row shell itself and hover/focus treatment to communicate clickability.

### Color rule

- Do not adopt Library's colors.
- Preserve the current Review color choices and note-type accents.
- Only the layout language, spacing rhythm, and card structure should move toward Library.

## Workspace Design

### Long titles

- Workspace note titles should wrap naturally to multiple lines instead of being cut off.
- Keep inline editing behavior.
- Do not require horizontal scrolling for long titles.

### Compact windows

- The workspace should stop forcing the 3-column layout on narrow widths.
- On compact windows, use a two-pane fallback centered on document readability.
- The document pane remains primary.
- Supporting panes (rail/context) should move into secondary toggleable panels or drawers rather than compressing the editor.

### Principle

- Reading and editing the current note takes priority over always-visible supporting panes.
- The compact layout should reduce clutter and preserve legibility.

## Implementation outline

- Update `apps/desktop/src/screens/ReviewScreen.tsx` to mirror the Library screen's structural layout more closely.
- Rework Review rows to use a Library-like horizontal entry structure with a left accent strip and integrated action area.
- Keep Review-specific buttons and queue metadata.
- Update `apps/desktop/src/screens/ReviewScreen.test.tsx` to reflect the new structure.
- Update the workspace document title rendering so long titles wrap cleanly.
- Update the workspace layout so compact widths fall back from 3 columns to a more readable two-pane pattern.

## Testing

Add or update tests for:

- Library-like Review row/card structure
- left accent strip and Library-style row shell
- clickable Review row behavior
- unchanged Review queue behavior
- wrapped workspace title behavior
- compact workspace fallback behavior

## Scope boundaries

Included:

- Review screen visual/layout alignment with Library
- preserving current Review colors
- wrapped workspace titles
- compact-window workspace readability improvements

Not included:

- changing Library itself
- changing Review workflow rules
- changing the app-wide theme palette
