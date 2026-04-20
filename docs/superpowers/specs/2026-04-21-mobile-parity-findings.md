# Mobile Parity Findings

## Severity Legend
- High
- Medium
- Low

## Findings

### High

- Parity bug - `apps/mobile/app/(tabs)/_layout.tsx`: mobile tab labels differ from desktop product concepts. Desktop top-level navigation is `Inbox`, `Workspace`, `Review`, `Library`, `Graph`, and `Trash`, but mobile exposes `Inbox`, `Editor`, `Library`, and `Graph`, which renames `Workspace`, omits `Review`, and removes `Trash` from the main product shell.
- UI bug - `apps/mobile/app/(tabs)/_layout.tsx`: tab bar renders only one visible trigger in the reported state, which makes the rest of the top-level mobile product structure unreachable.
- Parity bug - `apps/mobile/app/(tabs)/_layout.tsx`: mobile collapses distinct desktop top-level concepts into a single `workspace` route. Desktop keeps `workspace` and `review` as separate destinations in `apps/desktop/src/App.tsx`, but mobile has no top-level `review` route in the tab layout.

### Medium

- Parity bug - `apps/mobile/app/_layout.tsx`: `trash` exists only as a separate stack route instead of a primary navigation destination. Desktop includes `Trash` directly in the main app shell, so the mobile top-level structure does not match that product model.

### Low
