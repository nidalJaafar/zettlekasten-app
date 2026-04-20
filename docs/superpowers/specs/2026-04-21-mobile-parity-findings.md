# Mobile Parity Findings

## Severity Legend
- High
- Medium
- Low

## Findings

### High

- Parity bug - `apps/mobile/app/(tabs)/_layout.tsx`, `apps/mobile/app/_layout.tsx`: mobile top-level structure does not match the desktop product model in `apps/desktop/src/App.tsx`. Desktop exposes `Inbox`, `Workspace`, `Review`, `Library`, `Graph`, and `Trash` as primary app destinations, while mobile exposes only `Inbox`, `Editor`, `Library`, and `Graph` in tabs, renames the shared `Workspace` concept to `Editor`, omits a top-level `Review` destination, and places `trash` outside the main tab shell.
- UI bug - `apps/mobile/app/(tabs)/_layout.tsx`: user-reported screenshot evidence shows the native tab bar rendering only one visible trigger in at least one state. This should be treated as a high-severity top-level navigation bug, but the file-based baseline alone does not prove the runtime rendering failure.
