# Mobile Tab Bar Premium Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the mobile native tab bar so it feels sharper and more premium while preserving desktop-aligned naming, dark-only styling, and four clearly visible tabs.

**Architecture:** Keep the work tightly scoped to the native tabs layout and theme tokens. Prefer native tab capabilities first, then add only the smallest theme adjustments needed to produce a more deliberate active state, quieter inactive state, and stronger overall visual hierarchy.

**Tech Stack:** Expo Router NativeTabs, React Native, TypeScript, existing mobile theme tokens

---

## File Map

- Modify: `apps/mobile/app/(tabs)/_layout.tsx` - primary tab bar configuration, icon selection, label hierarchy, and native tab appearance props
- Modify: `apps/mobile/src/theme.ts` - only if needed to add or refine color/token support for the premium tab treatment
- Verify against: `docs/superpowers/specs/2026-04-21-mobile-tab-bar-premium-design.md`

### Task 1: Tighten NativeTabs Visual Hierarchy

**Files:**
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`
- Test/verify: `apps/mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Read the current tab layout and copy the existing structure into your working notes**

Expected current shape:

```tsx
<NativeTabs
  blurEffect="systemMaterialDark"
  backgroundColor={BG.panel}
  tintColor={TEXT.primary}
  labelStyle={{ color: TEXT.secondary, fontFamily: FONT.ui, fontSize: 11 }}
>
```

and four triggers for:

```tsx
Inbox
Review
Library
Graph
```

- [ ] **Step 2: Add the smallest premium-oriented native tab refinements**

Update `apps/mobile/app/(tabs)/_layout.tsx` so the `NativeTabs` root uses a slightly more deliberate hierarchy while staying native:

```tsx
<NativeTabs
  blurEffect="systemMaterialDark"
  backgroundColor={BG.panel}
  tintColor={TEXT.primary}
  labelStyle={{
    color: TEXT.secondary,
    fontFamily: FONT.ui,
    fontSize: 11,
    fontWeight: '500',
  }}
>
```

If the current native API supports it cleanly, prefer a stronger selected hierarchy through `tintColor` and quieter label styling instead of introducing custom layout wrappers.

- [ ] **Step 3: Normalize icon choices so they feel more premium and consistent**

Use restrained native icons with similar visual weight. Update the triggers to this shape if needed:

```tsx
<NativeTabs.Trigger name="index">
  <NativeTabs.Trigger.Icon sf={{ default: 'tray', selected: 'tray.fill' }} md="inbox" />
  <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
</NativeTabs.Trigger>
<NativeTabs.Trigger name="review">
  <NativeTabs.Trigger.Icon sf={{ default: 'square.and.pencil', selected: 'square.and.pencil' }} md="edit_note" />
  <NativeTabs.Trigger.Label>Review</NativeTabs.Trigger.Label>
</NativeTabs.Trigger>
<NativeTabs.Trigger name="library">
  <NativeTabs.Trigger.Icon sf={{ default: 'books.vertical', selected: 'books.vertical.fill' }} md="library_books" />
  <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
</NativeTabs.Trigger>
<NativeTabs.Trigger name="graph">
  <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} md="analytics" />
  <NativeTabs.Trigger.Label>Graph</NativeTabs.Trigger.Label>
</NativeTabs.Trigger>
```

Keep the naming unchanged.

- [ ] **Step 4: Run typecheck to verify the NativeTabs props are valid**

Run:

```bash
pnpm --filter @zettelkasten/mobile typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the visual hierarchy pass**

```bash
git add apps/mobile/app/(tabs)/_layout.tsx
git commit -m "style: refine mobile tab bar hierarchy"
```

### Task 2: Refine Supporting Theme Tokens Only If Needed

**Files:**
- Modify: `apps/mobile/src/theme.ts`
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Check whether the current tokens already support the desired premium tab treatment**

Review these existing tokens first:

```ts
BG.panel
TEXT.primary
TEXT.secondary
TEXT.muted
ACCENT.ink
ACCENT.inkSoft
BORDER.base
BORDER.strong
```

If the design can be achieved with the current tokens, do not change `theme.ts`.

- [ ] **Step 2: If needed, add only one minimal token refinement**

If the active state still feels too generic, add one carefully scoped token such as:

```ts
tabGlow: 'rgba(231, 224, 209, 0.08)'
```

or

```ts
tabQuiet: '#8e8a82'
```

Only add a token if it is actually used immediately in `_layout.tsx`.

- [ ] **Step 3: Apply the token minimally in the tab layout**

Use the new token only to improve hierarchy, for example:

```tsx
labelStyle={{
  color: TEXT.secondary,
  fontFamily: FONT.ui,
  fontSize: 11,
  fontWeight: '500',
}}
```

or, if the API allows, selected-state appearance via tint and subdued inactive label color.

- [ ] **Step 4: Run typecheck after any token change**

Run:

```bash
pnpm --filter @zettelkasten/mobile typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit only if theme tokens changed**

```bash
git add apps/mobile/src/theme.ts apps/mobile/app/(tabs)/_layout.tsx
git commit -m "style: polish mobile tab bar theme accents"
```

If no token changes were needed, skip this commit and note that Task 2 was satisfied without theme edits.

### Task 3: Final Visual Verification And Cleanup

**Files:**
- Verify: `apps/mobile/app/(tabs)/_layout.tsx`
- Verify: `docs/superpowers/specs/2026-04-21-mobile-tab-bar-premium-design.md`

- [ ] **Step 1: Confirm the final tab bar still satisfies the design spec**

Check against the spec requirements:

```text
- four visible tabs
- dark foundation preserved
- active tab feels more premium and deliberate
- inactive tabs quieter but still legible
- desktop naming unchanged
- no flashy or over-animated treatment
```

- [ ] **Step 2: Run final mobile typecheck**

Run:

```bash
pnpm --filter @zettelkasten/mobile typecheck
```

Expected: PASS.

- [ ] **Step 3: Do a manual visual check on device or simulator if available**

Verify:

```text
1. Inbox, Review, Library, and Graph are all visible
2. Active tab has stronger hierarchy than inactive tabs
3. Inactive tabs feel restrained, not disabled
4. Icons and labels feel visually balanced
5. The bar reads as a designed surface, not a generic fallback
```

- [ ] **Step 4: Commit any final cleanup needed for the premium pass**

```bash
git add apps/mobile/app/(tabs)/_layout.tsx apps/mobile/src/theme.ts
git commit -m "style: finalize premium mobile tab bar"
```

If there is no additional cleanup after Task 1 or Task 2, skip this extra commit.
