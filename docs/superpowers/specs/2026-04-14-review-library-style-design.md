# Review Library-Style Design

## Goal

Make the Review screen feel visually similar to the Library screen while keeping Review's existing color palette and workflow purpose.

## Problem

The current Review screen feels too custom and too different from Library. The user wants Review to inherit the calmer, more consistent visual language of Library, but without losing Review-specific actions or changing Review's colors.

## Design

### Visual direction

- Reuse the overall Library layout style for Review.
- Keep the current Review colors as they are.
- Review should feel like `Library + actions`, not like a separate workflow dashboard.

### Structure

Each Review item should follow the same overall reading pattern as Library:

- main content area led by title and note body preview
- quiet secondary metadata treatment
- actions added in a way that does not overpower the item

The list should read as a calm stack of entries rather than as task cards.

### Review-specific behavior

- Keep the Review queue loading/filtering behavior unchanged.
- Keep the existing `Open in Workspace` action.
- Keep type information visible, but integrated into the Library-like layout rather than emphasized as a separate card treatment.

### Color rule

- Do not adopt Library's colors.
- Preserve the current Review color choices and note-type accents.
- Only the layout language, spacing rhythm, and card structure should move toward Library.

## Implementation outline

- Update `apps/desktop/src/screens/ReviewScreen.tsx` to mirror the Library screen's structural layout more closely.
- Keep Review-specific buttons and queue metadata.
- Update `apps/desktop/src/screens/ReviewScreen.test.tsx` to reflect the new structure.

## Testing

Add or update tests for:

- Library-like Review row/card structure
- retained Review action rendering
- unchanged Review queue behavior

## Scope boundaries

Included:

- Review screen visual/layout alignment with Library
- preserving current Review colors

Not included:

- changing Library itself
- changing Review workflow rules
- changing the app-wide theme palette
