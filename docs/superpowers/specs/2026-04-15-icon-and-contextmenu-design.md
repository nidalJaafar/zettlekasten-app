# Design: App Icon + Disable Right-Click

Date: 2026-04-15

## Overview

Two small but meaningful polish tasks:
1. Give the app a real icon (bold typographic "Z" on a dark background).
2. Suppress the native browser context menu throughout the Tauri webview.

---

## Task 1: App Icon

### Design

A 512×512 SVG master file stored at `apps/desktop/src-tauri/icons/icon.svg`.

- **Background**: rounded-corner square, radius 80px, fill `#1a1d23` (matches `BG.base` theme token)
- **Glyph**: bold "Z" centered on the canvas, fill `#e8e6e0` (matches `TEXT.primary`), geometric sans-serif, filling ~60% of the canvas height
- **No gradients, shadows, or decorations** — clean and legible at all sizes

### Icon generation

Run `pnpm tauri icon apps/desktop/src-tauri/icons/icon.svg` from the repo root (or `npx tauri icon` inside `apps/desktop`). This command:
- Rasterizes the SVG to all required platform sizes
- Outputs PNGs, `.icns` (macOS), `.ico` (Windows) into `apps/desktop/src-tauri/icons/`
- Prints the exact paths to wire into `tauri.conf.json`

### Config

Update `bundle.icon` in `apps/desktop/src-tauri/tauri.conf.json` with the paths produced by the `tauri icon` command (typically `["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"]`).

---

## Task 2: Disable Right-Click Context Menu

### Design

Add a single global event listener in `apps/desktop/src/main.tsx` before the React root is mounted:

```ts
document.addEventListener('contextmenu', (e) => e.preventDefault());
```

This prevents the Chromium/WebKit context menu from appearing anywhere in the Tauri webview. No component changes, no conditional logic.

---

## Files Changed

| File | Change |
|---|---|
| `apps/desktop/src-tauri/icons/icon.svg` | New master SVG source |
| `apps/desktop/src-tauri/icons/` | Generated icon files (via `tauri icon`) |
| `apps/desktop/src-tauri/tauri.conf.json` | `bundle.icon` array populated |
| `apps/desktop/src/main.tsx` | `contextmenu` listener added |

---

## Testing

- **Icon**: build the app (`pnpm --filter @zettelkasten/desktop build`) and verify the icon appears in the OS dock/taskbar/window title bar.
- **Right-click**: run the dev server (`pnpm --filter @zettelkasten/desktop dev`) and confirm right-click anywhere produces no menu.
- **Typecheck**: `pnpm typecheck` must pass after `main.tsx` edit.
