# Mobile Parity Findings

## Severity Legend
- High
- Medium
- Low

## Findings

### High

- Parity bug - `apps/mobile/app/(tabs)/_layout.tsx`, `apps/mobile/app/_layout.tsx`: mobile top-level structure does not match the desktop product model in `apps/desktop/src/App.tsx`. Desktop exposes `Inbox`, `Workspace`, `Review`, `Library`, `Graph`, and `Trash` as primary app destinations, while mobile exposes only `Inbox`, `Editor`, `Library`, and `Graph` in tabs, renames the shared `Workspace` concept to `Editor`, omits a top-level `Review` destination, and places `trash` outside the main tab shell.
- Parity bug - `apps/mobile/app/(tabs)/_layout.tsx`: mobile uses `Editor` as the visible tab label where desktop uses `Review`, so the primary processing surface is named differently across clients.
- Parity bug - `apps/mobile/app/(tabs)/workspace.tsx`, `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/app/(tabs)/library.tsx`, `apps/mobile/app/(tabs)/graph.tsx`: mobile collapses review and note-editing under the `workspace` route instead of using desktop workflow language centered on a top-level `Review` destination.
