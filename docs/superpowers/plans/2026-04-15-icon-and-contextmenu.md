# Icon + Disable Right-Click Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bold typographic "Z" app icon and suppress the native right-click context menu across the entire Tauri webview.

**Architecture:** Create a master SVG icon, run `tauri icon` to rasterize it to all platform sizes and update `tauri.conf.json`, then add a single `contextmenu` listener in `main.tsx`.

**Tech Stack:** SVG, Tauri CLI v2 (`pnpm tauri icon`), TypeScript/React

---

### Task 1: Create the master SVG icon

**Files:**
- Create: `apps/desktop/src-tauri/icons/icon.svg`

- [ ] **Step 1: Write the SVG file**

Create `apps/desktop/src-tauri/icons/icon.svg` with this exact content:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="80" ry="80" fill="#1a1d23"/>
  <text
    x="256"
    y="370"
    font-family="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
    font-weight="900"
    font-size="320"
    text-anchor="middle"
    fill="#e8e6e0"
  >Z</text>
</svg>
```

- [ ] **Step 2: Verify the file renders correctly**

Open `apps/desktop/src-tauri/icons/icon.svg` in a browser or SVG viewer and confirm: dark rounded-corner square, large bold white "Z" centered.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/icons/icon.svg
git commit -m "Add master SVG icon (bold Z on dark background)"
```

---

### Task 2: Generate platform icons and wire into Tauri config

**Files:**
- Modify: `apps/desktop/src-tauri/tauri.conf.json` — populate `bundle.icon`
- Modify: `apps/desktop/src-tauri/icons/` — generated icon files added

- [ ] **Step 1: Run the tauri icon command**

```bash
cd apps/desktop
pnpm tauri icon src-tauri/icons/icon.svg --output src-tauri/icons
```

Expected output: a list of generated files including `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`.

- [ ] **Step 2: Verify generated files exist**

```bash
ls apps/desktop/src-tauri/icons/
```

Expected: `icon.svg`, `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico` (exact set may vary by platform).

- [ ] **Step 3: Update tauri.conf.json**

In `apps/desktop/src-tauri/tauri.conf.json`, replace:

```json
"icon": []
```

with the paths matching what was generated. Standard Tauri v2 output is:

```json
"icon": [
  "icons/32x32.png",
  "icons/128x128.png",
  "icons/128x128@2x.png",
  "icons/icon.icns",
  "icons/icon.ico"
]
```

If the generated file names differ from the above, use the actual names from Step 2.

- [ ] **Step 4: Typecheck**

```bash
cd /path/to/repo && pnpm typecheck
```

Expected: `Done` for both packages, no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri/icons/ apps/desktop/src-tauri/tauri.conf.json
git commit -m "Generate platform icons and wire into tauri.conf.json"
```

---

### Task 3: Disable right-click context menu

**Files:**
- Modify: `apps/desktop/src/main.tsx`

- [ ] **Step 1: Add the contextmenu listener**

In `apps/desktop/src/main.tsx`, replace the entire file with:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import './global.css'
import App from './App'

document.addEventListener('contextmenu', (e) => e.preventDefault())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 2: Run tests**

```bash
cd /path/to/repo && pnpm test
```

Expected: all test files pass, no failures.

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: `Done` for both packages, no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/main.tsx
git commit -m "Suppress native right-click context menu in Tauri webview"
```

---

### Task 4: Push

- [ ] **Step 1: Push all commits**

```bash
git push
```
