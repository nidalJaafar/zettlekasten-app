# Mobile Tab Bar Premium Design

## Goal

Upgrade the mobile tab bar from a functional native default into a sharper, more premium navigation surface while keeping desktop-aligned naming and dark-mode-only styling.

## Chosen Direction

Refined instrument panel.

The tab bar should feel deliberate, expensive, and controlled rather than playful or decorative. It should read like a precision tool with soft glass depth, balanced spacing, and a clearly elevated active state.

## Visual Intent

- Keep the current dark foundation.
- Reduce the sense of generic system styling.
- Make inactive tabs quieter and more disciplined.
- Make the active tab feel intentionally selected, not merely highlighted.

The memorable quality should be a calm, premium "lit control panel" feel at the bottom of the screen.

## Design Rules

### Layout

- Keep the four tabs visible at all times.
- Preserve the existing tab order:
  - Inbox
  - Review
  - Library
  - Graph
- Maintain a compact overall height with better internal balance between icon, label, and active background.

### Active State

- Active tab should use a more deliberate capsule or plate effect.
- The active treatment should feel brighter and more precise, not larger or louder.
- The selected icon should feel crisp and high-contrast.
- The selected label should carry slightly stronger weight than inactive labels.

### Inactive State

- Inactive icons should be restrained and lower contrast.
- Inactive labels should remain legible but secondary.
- The inactive state should feel elegant, not faded out or disabled.

### Color

- Stay within the existing dark palette family.
- Use the existing ink accent system rather than introducing a new bright accent.
- Prefer subtle separation through contrast, translucency, and edge definition over saturated color.

### Typography

- Labels should remain small and controlled.
- Weight and color should create hierarchy without making the bar feel busy.
- Avoid toy-like or oversized tab labels.

### Icons

- Icons should stay simple, native, and restrained.
- Use icons that feel like part of a premium system UI, not decorative illustrations.
- Keep icon and label alignment visually centered and balanced.

## Implementation Shape

This enhancement should stay minimal in code scope:

- Primary file: `apps/mobile/app/(tabs)/_layout.tsx`
- Optional token refinements only if truly necessary: `apps/mobile/src/theme.ts`

The work should prefer native tab capabilities first, with the smallest possible styling adjustments needed to improve hierarchy and polish.

## Constraints

- Keep desktop-aligned naming exactly as-is.
- Preserve text labels and icons for all four tabs.
- Do not redesign the overall information architecture.
- Do not introduce light mode.
- Do not turn the tab bar into a flashy or highly animated surface.

## Success Criteria

- All four tabs remain clearly visible.
- The active tab feels more premium and intentional.
- The inactive tabs feel cleaner and more balanced.
- The tab bar looks less like a default system fallback and more like a designed part of the app.
- The result still feels consistent with the rest of the mobile theme.
