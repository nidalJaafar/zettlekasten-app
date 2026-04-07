# Zettelkasten App

Desktop-first Zettelkasten app with a pure TypeScript core package and a Tauri + React desktop client.

## Workspace Layout

- `packages/core`: domain logic, schema, and tests
- `apps/desktop`: Tauri + React desktop app

## Requirements

- Node.js 20+
- pnpm 9+
- Rust toolchain and Tauri system dependencies for desktop development

## Install

```bash
pnpm install
```

## Verification

```bash
pnpm typecheck
pnpm test
pnpm --filter @zettelkasten/desktop typecheck
```

## Run The Desktop App

```bash
pnpm --filter @zettelkasten/desktop dev
```

## Build The Desktop App

```bash
pnpm --filter @zettelkasten/desktop build
```

## Notes

- Copy `.env.example` to `.env` if local environment configuration is needed.
- Foreign key enforcement is enabled for SQLite connections in both the desktop adapter and the core test helper.
- SQLite database files and sidecars are ignored by git.
- Desktop verification for this repo is `pnpm --filter @zettelkasten/desktop typecheck`; use `pnpm --filter @zettelkasten/desktop dev` for a runtime check.
