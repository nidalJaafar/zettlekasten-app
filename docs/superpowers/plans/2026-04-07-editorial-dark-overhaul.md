# Editorial Dark Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the desktop app into a dark, calm, writing-first interface with warm editorial minimalism while keeping the current app structure and workflows intact.

**Architecture:** Rework the desktop design in layers instead of screen-by-screen improvisation. First establish typography, tokens, and global interaction rules; then restyle shared chrome and content surfaces; then tune each major screen so Inbox, Review, Library, and Graph all feel like one coherent product.

**Tech Stack:** React 18, TypeScript, Tauri v2, inline styles, global CSS, CodeMirror, D3

**Important:** Do not create git commits unless the human explicitly asks for them.

---

## File Map

- Modify: `apps/desktop/src/theme.ts`
  Responsibility: define the new dark editorial token system, typography, and note-type accents.
- Modify: `apps/desktop/src/global.css`
  Responsibility: import fonts and establish global hover, focus, scrollbar, and CodeMirror styling aligned with the new direction.
- Modify: `apps/desktop/src/components/Sidebar.tsx`
  Responsibility: make navigation feel like a quiet table of contents rather than a product sidebar.
- Modify: `apps/desktop/src/components/NoteCard.tsx`
  Responsibility: restyle fleeting notes into flatter, calmer stacked entries.
- Modify: `apps/desktop/src/components/MarkdownEditor.tsx`
  Responsibility: make the editor feel like a writing surface, not a widget wrapper.
- Modify: `apps/desktop/src/components/SourcePicker.tsx`
  Responsibility: make source selection and creation feel integrated and editorial.
- Modify: `apps/desktop/src/components/LinkPicker.tsx`
  Responsibility: restyle permanent-note linking so it feels quiet and typographic.
- Modify: `apps/desktop/src/components/GraphCanvas.tsx`
  Responsibility: align the graph node, edge, and label rendering with the new atmospheric dark palette.
- Modify: `apps/desktop/src/screens/InboxScreen.tsx`
  Responsibility: make quick capture the hero and give the inbox a quieter intake-tray feel.
- Modify: `apps/desktop/src/screens/ReviewScreen.tsx`
  Responsibility: make Review the visual centerpiece with calmer hierarchy and stronger writing focus.
- Modify: `apps/desktop/src/screens/LibraryScreen.tsx`
  Responsibility: make processed notes feel archival and shelf-like.
- Modify: `apps/desktop/src/screens/GraphScreen.tsx`
  Responsibility: reduce chrome weight and make overlays blend with the immersive graph canvas.

### Task 1: Establish Editorial Tokens And Global Styling

**Files:**
- Modify: `apps/desktop/src/theme.ts`
- Modify: `apps/desktop/src/global.css`
- Test: `apps/desktop/src/theme.ts`

- [ ] **Step 1: Replace the token set in `theme.ts`**

Update `apps/desktop/src/theme.ts` to this token set:

```ts
export const BG = {
  base: '#111318',
  panel: '#171a20',
  raised: '#1d2128',
  canvas: '#0d0f13',
  hover: '#222730',
} as const

export const BORDER = {
  faint: '#232831',
  base: '#2b313c',
  strong: '#3a4350',
} as const

export const TEXT = {
  primary: '#e7e0d1',
  secondary: '#b4ab99',
  muted: '#7f7a70',
  faint: '#5e5b55',
} as const

export const ACCENT = {
  ink: '#8f98a8',
  inkSoft: 'rgba(143,152,168,0.14)',
  fleeting: '#9a7a5a',
  literature: '#6d8394',
  permanent: '#8d879f',
  success: '#6d8e7a',
  danger: '#b06c68',
} as const

export const FONT = {
  display: "'Literata', Georgia, serif",
  ui: "'Spline Sans', 'Segoe UI', sans-serif",
  mono: "'IBM Plex Mono', 'SFMono-Regular', monospace",
} as const

export function typeColor(type: string): string {
  if (type === 'fleeting') return ACCENT.fleeting
  if (type === 'literature') return ACCENT.literature
  return ACCENT.permanent
}
```

- [ ] **Step 2: Run desktop typecheck to verify token renames are not yet broken**

Run: `pnpm --filter @zettelkasten/desktop typecheck`

Expected: this may FAIL because later files still reference removed token names such as `BG.surface`, `BG.card`, `TEXT.dim`, `TEXT.muted`, `ACCENT.gold`, and `BORDER.dim`. Record the failures and proceed.

- [ ] **Step 3: Replace `global.css` with font imports and editorial interaction rules**

Update `apps/desktop/src/global.css` to:

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Literata:opsz,wght@7..72,400;7..72,500;7..72,600&family=Spline+Sans:wght@400;500;600&display=swap');

:root {
  color-scheme: dark;
}

html, body, #root {
  margin: 0;
  min-height: 100%;
  background: #111318;
  font-family: 'Spline Sans', 'Segoe UI', sans-serif;
}

body {
  color: #e7e0d1;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

* {
  box-sizing: border-box;
}

input, select, textarea, button {
  font: inherit;
}

::placeholder {
  color: #5e5b55;
  opacity: 1;
}

*:focus {
  outline: none;
}

::selection {
  background: rgba(143, 152, 168, 0.24);
  color: #f4ede0;
}

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-thumb {
  background: #2b313c;
  border: 2px solid #111318;
  border-radius: 999px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

.nav-item,
.note-card,
.queue-item,
.picker-row,
.source-row,
.dropdown-item,
.library-card,
.btn-ghost,
.btn-new,
.btn-inspect,
.btn-dismiss,
.process-btn,
.add-source-btn {
  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease, opacity 120ms ease;
}

.nav-item:hover {
  color: #e7e0d1 !important;
}

.nav-item.active:hover {
  color: #e7e0d1 !important;
}

.note-card:hover,
.queue-item:hover,
.library-card:hover,
.picker-row:hover,
.source-row:hover {
  background: #222730 !important;
  border-color: #3a4350 !important;
}

.process-btn:hover,
.btn-inspect:hover,
.btn-new:hover,
.add-source-btn:hover {
  color: #e7e0d1 !important;
}

.btn-ghost:hover,
.btn-dismiss:hover,
.dropdown-item:hover {
  background: #222730 !important;
  color: #e7e0d1 !important;
}

.cm-editor {
  background: #171a20 !important;
}

.cm-scroller,
.cm-content,
.cm-gutters {
  background: #171a20 !important;
}

.cm-content {
  font-family: 'Literata', Georgia, serif;
  font-size: 15px;
  line-height: 1.8;
  color: #e7e0d1;
  padding: 18px 18px 24px;
}

.cm-line {
  padding: 0;
}

.cm-placeholder {
  color: #5e5b55 !important;
  font-style: italic;
}

.cm-activeLine,
.cm-activeLineGutter {
  background: transparent !important;
}

.cm-gutters {
  border-right: none !important;
  color: #5e5b55;
}

.cm-cursor {
  border-left-color: #b4ab99 !important;
}

.cm-focused {
  outline: none !important;
}
```

- [ ] **Step 4: Run desktop typecheck again after the global styling change**

Run: `pnpm --filter @zettelkasten/desktop typecheck`

Expected: still FAIL until later tasks update token consumers.

- [ ] **Step 5: If the human explicitly asks for a commit, create one**

```bash
git add apps/desktop/src/theme.ts apps/desktop/src/global.css
git commit -m "feat: establish editorial dark design tokens"
```

### Task 2: Restyle Shared Desktop Chrome

**Files:**
- Modify: `apps/desktop/src/components/Sidebar.tsx`
- Modify: `apps/desktop/src/components/NoteCard.tsx`
- Modify: `apps/desktop/src/components/MarkdownEditor.tsx`

- [ ] **Step 1: Replace the sidebar styling with a quieter table-of-contents look**

Update `apps/desktop/src/components/Sidebar.tsx` to use these structural styles:

```tsx
<nav
  style={{
    width: 168,
    background: BG.panel,
    borderRight: `1px solid ${BORDER.faint}`,
    display: 'flex',
    flexDirection: 'column',
    padding: '26px 0 18px',
    flexShrink: 0,
    userSelect: 'none',
  }}
>
  <div
    style={{
      padding: '0 22px 18px',
      fontFamily: FONT.display,
      fontSize: 23,
      fontWeight: 500,
      color: TEXT.primary,
      letterSpacing: '-0.01em',
      lineHeight: 1,
    }}
  >
    Z
  </div>

  <div style={{ height: 1, background: BORDER.faint, margin: '0 18px 10px' }} />

  {items.map((item) => {
    const active = current === item.id
    return (
      <button
        key={item.id}
        onClick={() => onNavigate(item.id)}
        className={`nav-item${active ? ' active' : ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 20px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
          position: 'relative',
          color: active ? TEXT.primary : TEXT.muted,
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: '0.02em',
        }}
      >
        {active && (
          <div
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              width: 4,
              height: 4,
              marginTop: -2,
              borderRadius: '50%',
              background: ACCENT.ink,
            }}
          />
        )}
        <span style={{ flex: 1, paddingLeft: active ? 10 : 0 }}>{item.label}</span>
        {item.id === 'inbox' && inboxCount > 0 && (
          <span
            style={{
              color: TEXT.secondary,
              fontSize: 10,
              padding: '0 0 0 8px',
              lineHeight: 1.4,
            }}
          >
            {inboxCount}
          </span>
        )}
      </button>
    )
  })}

  <div
    style={{
      marginTop: 'auto',
      padding: '0 20px',
      fontSize: 9,
      color: TEXT.faint,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
    }}
  >
    Zettelkasten
  </div>
</nav>
```

- [ ] **Step 2: Restyle `NoteCard.tsx` as a flatter intake entry**

Use this shape in `apps/desktop/src/components/NoteCard.tsx`:

```tsx
<div
  className="note-card"
  style={{
    background: BG.raised,
    border: `1px solid ${BORDER.faint}`,
    borderRadius: 10,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
  }}
>
  <div style={{ width: 6, paddingTop: 8, flexShrink: 0 }}>
    <div style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT.fleeting, opacity: 0.8 }} />
  </div>
  <div style={{ flex: 1, minWidth: 0 }}>
    <div
      style={{
        fontFamily: FONT.display,
        fontSize: 18,
        fontWeight: 500,
        color: TEXT.primary,
        marginBottom: 4,
        lineHeight: 1.3,
        letterSpacing: '0.002em',
      }}
    >
      {note.title}
    </div>
    {note.content && (
      <div
        style={{
          fontSize: 12,
          color: TEXT.secondary,
          lineHeight: 1.7,
          marginBottom: 8,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {note.content}
      </div>
    )}
    <div style={{ fontSize: 10, color: TEXT.faint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      {timeAgo(note.created_at)}
    </div>
  </div>
  <button
    onClick={() => onProcess(note)}
    className="process-btn"
    style={{
      background: 'transparent',
      color: TEXT.secondary,
      border: 'none',
      padding: '5px 0',
      fontSize: 11,
      fontWeight: 500,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      flexShrink: 0,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    }}
  >
    Process
  </button>
</div>
```

- [ ] **Step 3: Restyle `MarkdownEditor.tsx` as a writing surface**

Update `apps/desktop/src/components/MarkdownEditor.tsx` to:

```tsx
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { BG, BORDER } from '../theme'

export default function MarkdownEditor({ value, onChange, placeholder, minHeight = '120px' }: Props) {
  return (
    <div
      style={{
        border: `1px solid ${BORDER.faint}`,
        borderRadius: 14,
        overflow: 'hidden',
        background: BG.panel,
      }}
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={[markdown()]}
        placeholder={placeholder}
        theme="dark"
        style={{ minHeight }}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
          highlightSelectionMatches: false,
        }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run desktop typecheck to verify shared chrome compiles**

Run: `pnpm --filter @zettelkasten/desktop typecheck`

Expected: PASS.

- [ ] **Step 5: If the human explicitly asks for a commit, create one**

```bash
git add apps/desktop/src/components/Sidebar.tsx apps/desktop/src/components/NoteCard.tsx apps/desktop/src/components/MarkdownEditor.tsx
git commit -m "feat: restyle desktop shell and shared note surfaces"
```

### Task 3: Restyle Inbox And Library

**Files:**
- Modify: `apps/desktop/src/screens/InboxScreen.tsx`
- Modify: `apps/desktop/src/screens/LibraryScreen.tsx`

- [ ] **Step 1: Restyle `InboxScreen.tsx` around quick capture**

Apply these key structural changes:

```tsx
<div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG.base }}>
  <div style={{ padding: '28px 32px 18px' }}>
    <div style={{ fontFamily: FONT.display, fontSize: 29, fontWeight: 500, color: TEXT.primary, letterSpacing: '-0.015em' }}>
      Inbox
    </div>
    <div style={{ fontSize: 12, color: TEXT.secondary, marginTop: 6, lineHeight: 1.6 }}>
      A quiet place for unfinished thoughts. {notes.length} fleeting note{notes.length !== 1 ? 's' : ''} waiting.
    </div>
  </div>

  <div style={{ padding: '0 32px 24px' }}>
    <div style={{ background: BG.panel, border: `1px solid ${BORDER.faint}`, borderRadius: 16, padding: '18px 18px 14px' }}>
      <div style={{ fontSize: 10, color: TEXT.faint, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
        Quick capture
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleCapture()}
        placeholder="Write a fleeting thought..."
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          color: TEXT.primary,
          fontFamily: FONT.display,
          fontSize: 22,
          lineHeight: 1.4,
          padding: '2px 0 10px',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 11, color: TEXT.faint }}>Press Enter to capture</span>
        {/* keep dropdown button here, but restyle it with low-contrast panel chrome */}
      </div>
    </div>
  </div>

  <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
```

Restyle `dropdownItemStyle` to:

```ts
const dropdownItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '10px 12px',
  background: 'transparent',
  border: 'none',
  color: TEXT.secondary,
  fontSize: 12,
  textAlign: 'left',
  cursor: 'pointer',
  borderRadius: 8,
  letterSpacing: '0.03em',
}
```

- [ ] **Step 2: Restyle `LibraryScreen.tsx` as an archival list**

Apply these styles:

```tsx
<div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG.base }}>
  <div style={{ padding: '28px 32px 18px' }}>
    <div style={{ fontFamily: FONT.display, fontSize: 29, fontWeight: 500, color: TEXT.primary, letterSpacing: '-0.015em' }}>
      Library
    </div>
    <div style={{ fontSize: 12, color: TEXT.secondary, marginTop: 6, lineHeight: 1.6 }}>
      Processed literature notes, arranged like a working shelf. {notes.length} item{notes.length !== 1 ? 's' : ''}.
    </div>
  </div>

  <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
```

Update each card to:

```tsx
<div
  key={note.id}
  className="library-card"
  style={{
    background: BG.raised,
    border: `1px solid ${BORDER.faint}`,
    borderRadius: 12,
    overflow: 'hidden',
  }}
>
  <button
    onClick={() => setExpandedId(expanded ? null : note.id)}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '16px 18px',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      width: '100%',
      textAlign: 'left',
    }}
  >
    <div style={{ width: 6, alignSelf: 'stretch', borderRadius: 999, background: ACCENT.literature, opacity: 0.7 }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: FONT.display, fontSize: 19, fontWeight: 500, color: TEXT.primary, lineHeight: 1.3 }}>
        {note.title}
      </div>
      <div style={{ fontSize: 11, color: TEXT.secondary, marginTop: 5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {note.source_label ?? 'No source'} · {formatDate(note.processed_at!)}
      </div>
    </div>
    <span style={{ color: TEXT.faint, fontSize: 10, flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
  </button>
  {expanded && (
    <div style={{ padding: '0 18px 18px 40px', fontFamily: FONT.display, fontSize: 15, color: TEXT.secondary, lineHeight: 1.85, borderTop: `1px solid ${BORDER.faint}`, whiteSpace: 'pre-wrap' }}>
      {note.content || <span style={{ fontStyle: 'italic', color: TEXT.faint }}>No content.</span>}
    </div>
  )}
</div>
```

- [ ] **Step 3: Run desktop typecheck to verify Inbox and Library compile**

Run: `pnpm --filter @zettelkasten/desktop typecheck`

Expected: PASS.

- [ ] **Step 4: If the human explicitly asks for a commit, create one**

```bash
git add apps/desktop/src/screens/InboxScreen.tsx apps/desktop/src/screens/LibraryScreen.tsx
git commit -m "feat: restyle inbox and library screens"
```

### Task 4: Make Review The Visual Centerpiece

**Files:**
- Modify: `apps/desktop/src/screens/ReviewScreen.tsx`
- Modify: `apps/desktop/src/components/SourcePicker.tsx`
- Modify: `apps/desktop/src/components/LinkPicker.tsx`

- [ ] **Step 1: Restyle `SourcePicker.tsx` to feel integrated and typographic**

Make these replacements:

```ts
const inputStyle: React.CSSProperties = {
  width: '100%',
  background: BG.raised,
  border: `1px solid ${BORDER.faint}`,
  borderRadius: 10,
  padding: '10px 12px',
  color: TEXT.primary,
  fontSize: 12,
  outline: 'none',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  borderRadius: 10,
  border: `1px solid ${BORDER.faint}`,
  cursor: 'pointer',
  width: '100%',
  background: BG.raised,
}
```

Update the selected-state block to:

```tsx
style={{
  ...rowStyle,
  background: selected ? ACCENT.inkSoft : BG.raised,
  borderColor: selected ? ACCENT.ink : BORDER.faint,
}}
```

Change action buttons to use `ACCENT.ink` and `TEXT.primary` instead of gold.

- [ ] **Step 2: Restyle `LinkPicker.tsx` to be quieter and more archival**

Update the empty state, search input, and rows to:

```tsx
if (notes.length === 0) {
  return (
    <div style={{ fontSize: 12, color: TEXT.faint, fontStyle: 'italic', padding: '10px 0', lineHeight: 1.7 }}>
      No permanent notes yet. The first permanent note can be saved without links.
    </div>
  )
}

<input
  value={query}
  onChange={(e) => setQuery(e.target.value)}
  placeholder="Search permanent notes..."
  style={{
    width: '100%',
    background: BG.raised,
    border: `1px solid ${BORDER.faint}`,
    borderRadius: 10,
    padding: '10px 12px',
    color: TEXT.primary,
    fontSize: 12,
    outline: 'none',
    marginBottom: 8,
  }}
/>
```

For each note row:

```tsx
style={{
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  borderRadius: 10,
  border: `1px solid ${selected ? ACCENT.permanent : BORDER.faint}`,
  background: selected ? 'rgba(141,135,159,0.12)' : BG.raised,
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left',
}}
```

and text styles:

```tsx
<span style={{ fontSize: 10, color: selected ? ACCENT.permanent : TEXT.faint, flexShrink: 0 }}>
  {selected ? '◆' : '◇'}
</span>
<span style={{ fontFamily: FONT.display, fontSize: 16, color: selected ? TEXT.primary : TEXT.secondary, lineHeight: 1.4 }}>
  {note.title}
</span>
```

- [ ] **Step 3: Restyle `ReviewScreen.tsx` as the strongest writing surface in the app**

Apply these high-level replacements:

```tsx
<div style={{ padding: '30px 34px 36px', background: BG.base, height: '100%', overflowY: 'auto' }}>
```

Step indicator wrapper:

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 34 }}>
```

Step indicator dot/text styles:

```tsx
const stepTypeColors = { fleeting: ACCENT.fleeting, literature: ACCENT.literature, permanent: ACCENT.permanent }

<div style={{ width: 7, height: 7, borderRadius: '50%', background: active ? stepTypeColors[s] : isDone ? TEXT.secondary : BORDER.strong }} />
<span style={{ fontSize: 10, color: active ? TEXT.primary : TEXT.faint, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
  {s}
</span>
```

Editor wrapper and title input:

```tsx
<div style={{ marginBottom: 22 }}>
  <input
    value={title}
    onChange={(e) => setTitle(e.target.value)}
    style={{
      width: '100%',
      background: 'transparent',
      border: 'none',
      color: TEXT.primary,
      fontFamily: FONT.display,
      fontSize: 34,
      fontWeight: 500,
      padding: '2px 0 14px',
      marginBottom: 16,
      outline: 'none',
      letterSpacing: '-0.015em',
      lineHeight: 1.2,
    }}
  />
  <MarkdownEditor value={content} onChange={setContent} minHeight="260px" />
</div>
```

Section labels:

```tsx
<div style={{ fontSize: 10, fontWeight: 500, color: TEXT.faint, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
```

Action button styling helper:

```ts
function actionButtonStyle(active: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '13px 16px',
    border: `1px solid ${active ? ACCENT.ink : BORDER.faint}`,
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 500,
    cursor: active ? 'pointer' : 'default',
    background: active ? ACCENT.inkSoft : BG.raised,
    color: active ? TEXT.primary : TEXT.faint,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  }
}
```

Queue list view should use `BG.base`, `BG.raised`, `BORDER.faint`, `TEXT.primary`, and `TEXT.secondary` instead of the previous heavier card treatment.

- [ ] **Step 4: Run desktop typecheck to verify Review and picker changes compile**

Run: `pnpm --filter @zettelkasten/desktop typecheck`

Expected: PASS.

- [ ] **Step 5: If the human explicitly asks for a commit, create one**

```bash
git add apps/desktop/src/screens/ReviewScreen.tsx apps/desktop/src/components/SourcePicker.tsx apps/desktop/src/components/LinkPicker.tsx
git commit -m "feat: make review screen the visual centerpiece"
```

### Task 5: Atmosphere-Tune The Graph Views

**Files:**
- Modify: `apps/desktop/src/components/GraphCanvas.tsx`
- Modify: `apps/desktop/src/screens/GraphScreen.tsx`

- [ ] **Step 1: Restyle graph primitives in `GraphCanvas.tsx`**

Use these values:

```ts
link
  .attr('stroke', '#38414c')
  .attr('stroke-opacity', 0.45)
  .attr('stroke-width', 1)

node.append('circle')
  .attr('r', (d) => radiusScale(d.linkCount))
  .attr('fill', '#1d2128')
  .attr('stroke', '#6d8394')
  .attr('stroke-opacity', 0.55)
  .attr('stroke-width', 1)

node.append('text')
  .attr('dy', (d) => radiusScale(d.linkCount) + 15)
  .attr('text-anchor', 'middle')
  .attr('font-size', 10)
  .attr('font-family', 'Spline Sans, sans-serif')
  .attr('letter-spacing', '0.04em')
  .attr('fill', '#7f7a70')
```

Update hover opacity reset to:

```ts
node.attr('opacity', 1)
link.attr('stroke-opacity', 0.45)
```

Set SVG background to:

```tsx
return <svg ref={svgRef} width="100%" height="100%" style={{ background: '#0d0f13' }} />
```

- [ ] **Step 2: Restyle `GraphScreen.tsx` overlays to feel quieter and more integrated**

Update the search overlay:

```tsx
<div style={{ position: 'absolute', top: 22, left: 22, display: 'flex', gap: 10, alignItems: 'center' }}>
```

Use these input/chip styles:

```tsx
style={{
  background: 'rgba(23,26,32,0.9)',
  border: `1px solid ${BORDER.faint}`,
  borderRadius: 12,
  padding: '9px 13px',
  color: TEXT.primary,
  fontSize: 12,
  width: 220,
  backdropFilter: 'blur(10px)',
}}
```

Inspector panel styles:

```tsx
style={{
  position: 'absolute',
  bottom: 22,
  right: 22,
  width: 280,
  background: 'rgba(23,26,32,0.92)',
  border: `1px solid ${BORDER.faint}`,
  borderRadius: 16,
  padding: 18,
  backdropFilter: 'blur(12px)',
  boxShadow: '0 18px 50px rgba(0,0,0,0.32)',
}}
```

Title and metadata styles:

```tsx
fontFamily: FONT.display,
fontSize: 19,
fontWeight: 500,
color: TEXT.primary,
```

and:

```tsx
fontSize: 10,
color: TEXT.faint,
marginBottom: 12,
letterSpacing: '0.1em',
textTransform: 'uppercase',
```

- [ ] **Step 3: Run desktop typecheck to verify Graph components compile**

Run: `pnpm --filter @zettelkasten/desktop typecheck`

Expected: PASS.

- [ ] **Step 4: If the human explicitly asks for a commit, create one**

```bash
git add apps/desktop/src/components/GraphCanvas.tsx apps/desktop/src/screens/GraphScreen.tsx
git commit -m "feat: restyle graph view for editorial dark mode"
```

### Task 6: Final Verification And Cohesion Pass

**Files:**
- Modify: any touched desktop file above only if final consistency cleanup is required

- [ ] **Step 1: Run the desktop package typecheck**

Run: `pnpm --filter @zettelkasten/desktop typecheck`

Expected: PASS.

- [ ] **Step 2: Run a full repo typecheck to ensure desktop token changes did not ripple incorrectly**

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 3: Inspect final worktree state**

Run: `git status --short`

Expected: only the intended desktop overhaul files are changed.

- [ ] **Step 4: Perform a manual visual pass in the running app**

Run: `pnpm --filter @zettelkasten/desktop dev`

Check these screens manually:
- Inbox: quick capture is the hero, note list feels calm
- Review: title/editor dominate, controls recede
- Library: entries feel archival
- Graph: overlays are subdued, graph remains legible

- [ ] **Step 5: If the human explicitly asks for a commit, create one**

```bash
git status --short
```

Expected: use the output to confirm exactly what would be committed.

---

## Self-Review

- Spec coverage: the plan covers theme/tokens, global interaction styling, sidebar, Inbox, Review, Library, Graph, and shared content surfaces.
- Placeholder scan: no `TODO`, `TBD`, or “figure it out later” steps remain.
- Type consistency: the plan uses current desktop file names and existing component boundaries (`Sidebar`, `NoteCard`, `MarkdownEditor`, `SourcePicker`, `LinkPicker`, `GraphCanvas`, `InboxScreen`, `ReviewScreen`, `LibraryScreen`, `GraphScreen`).
