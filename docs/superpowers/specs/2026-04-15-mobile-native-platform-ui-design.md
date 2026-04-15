# Mobile Native Platform UI Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the `crypto.randomUUID` crash, replace all custom-built UI elements with native platform equivalents, and adopt native platform UI patterns (Liquid Glass on iOS, Material You on Android) throughout the mobile app.

**Architecture:** Use Expo's native APIs (`NativeTabs`, `Stack.Header blurEffect`, `Stack.SearchBar`, `Stack.Screen.BackButton`, `formSheet` presentation, `Switch`) instead of custom-built components. All glass/material effects come from the OS. The app is dark-mode only.

**Tech Stack:** Expo SDK 54, `expo-router/unstable-native-tabs`, `Stack.Header`, `Stack.SearchBar`, `Stack.Screen.BackButton`, `DynamicColorIOS`, `Switch` from react-native

---

## Issues to Fix

### 1. `crypto.randomUUID` crash

React Native does not provide `globalThis.crypto.randomUUID()`. Both `createNote()` and `createSource()` in `packages/core` call it. The mobile app crashes on note capture.

**Fix:** Polyfill `globalThis.crypto.randomUUID` with a UUID v4 implementation using `Math.random()` in the mobile root layout, before DB init.

### 2. Tab bar not native

Current tab bar uses JavaScript `Tabs` from expo-router. This gives a custom React Native tab bar that looks the same on both platforms. It also may render default system icons that the user wants removed.

**Fix:** Replace `Tabs` with `NativeTabs` from `expo-router/unstable-native-tabs`. This gives:
- **iOS**: Native Liquid Glass tab bar (iOS 26 default behavior)
- **Android**: Native Material You bottom navigation

Text-only labels, no icons. Use `NativeTabs.Trigger.Label` with no `NativeTabs.Trigger.Icon`.

### 3. Headers not native

All four tab screens use custom header `<View>` components with `paddingTop: 56` and `glassStyle.header`. These look the same on both platforms and don't get Liquid Glass or Material You styling.

**Fix:** Use native Stack headers with `Stack.Screen.Title` and `Stack.Header blurEffect="systemMaterialDark"` on iOS. On Android, headers automatically get Material You styling. Remove all custom header `<View>` elements from:
- `index.tsx` (Inbox) — title + count badge
- `workspace.tsx` — back button + type badge
- `library.tsx` — title + count badge
- `graph.tsx` — no custom header currently, but gets native header automatically

### 4. Custom back button

Workspace screen has a custom `<Pressable><Text>Back</Text></Pressable>` for navigation.

**Fix:** Use `Stack.Screen.BackButton` — native chevron + swipe-back gesture on iOS, native arrow on Android.

### 5. Custom search input in Library

Library screen has a custom search `<View glassStyle.card><TextInput>` in the screen body.

**Fix:** Use `Stack.SearchBar` — integrates natively into the header on both platforms. iOS gets native search bar with collapse animation. Android gets Material search.

### 6. Custom checkbox for "own words"

Workspace screen builds a checkbox from scratch: `<View style={checkbox}>` with an `<Text>x</Text>` inside.

**Fix:** Use React Native `Switch` component — native toggle on both platforms.

### 7. Modals not native

SourcePicker and LinkPicker use React Native `<Modal>` component with custom styling. These don't get Liquid Glass on iOS or Material bottom sheets on Android.

**Fix:** Convert SourcePicker and LinkPicker from `<Modal>` to Expo Router modal routes using `presentation: 'formSheet'`. This gives native bottom sheets on both platforms:
- **iOS**: Native sheet with liquid glass chrome
- **Android**: Material bottom sheet

This changes how they're invoked: workspace navigates to the route (`router.navigate('/source-picker')`) instead of toggling `<Modal visible={}>`. State must be passed via router params or a shared store.

### 8. Theme provider missing

Without `ThemeProvider` from `@react-navigation/native`, iOS 26 Liquid Glass headers and tab bars show white background flashes when navigating (documented Expo known issue).

**Fix:** Wrap root layout with `ThemeProvider` using `DarkTheme`.

---

## Detailed Component Mapping

### Root Layout (`app/_layout.tsx`)
- Wrap with `ThemeProvider` from `@react-navigation/native` using `DarkTheme`
- Polyfill `crypto.randomUUID` before `initDb()`

### Tab Layout (`app/(tabs)/_layout.tsx`)
- Replace `Tabs` with `NativeTabs` from `expo-router/unstable-native-tabs`
- `blurEffect="systemMaterialDark"` on `NativeTabs` for iOS
- `backgroundColor` set to dark background for Android
- 4 triggers: Inbox, Editor, Library, Graph — text labels only, no `Icon` components
- Nest a `<Stack />` inside each tab so headers work (required by NativeTabs)

### Inbox Screen (`app/(tabs)/index.tsx`)
- Remove custom header `<View>`. Use `Stack.Screen.Title` large + `Stack.Header blurEffect="systemMaterialDark"`
- Note count: show as `Stack.Screen.Title` subtitle or `Stack.Toolbar.Badge` on the header
- Keep capture card and note list as-is (in-content components, not navigation chrome)

### Workspace Screen (`app/(tabs)/workspace.tsx`)
- Remove custom header `<View>` with back button. Use native Stack header
- `Stack.Screen.BackButton` for back navigation (native chevron on iOS, arrow on Android)
- Type badge: show via `Stack.Screen.Title` subtitle or in the header toolbar
- Replace custom checkbox (`<View checkbox> + <Text>x</Text>`) with `<Switch>` for "Written in own words"
- SourcePicker/LinkPicker: change from `<Modal visible={}>` to `router.navigate()` to formSheet routes
- Store picker state (selected source ID, selected link IDs) in Zustand store so the formSheet routes can read/write it

### Library Screen (`app/(tabs)/library.tsx`)
- Remove custom header `<View>` and inline search `<View>`
- Use `Stack.Screen.Title` + `Stack.Header blurEffect="systemMaterialDark"`
- Use `Stack.SearchBar` for native search in the header — wire `onChangeText` to the existing `search` state

### Graph Screen (`app/(tabs)/graph.tsx`)
- Gets native header automatically from the tab's Stack navigator
- Keep search overlay and detail card as in-content overlays (no native equivalent)

### SourcePicker → `app/source-picker.tsx`
- New route file using `presentation: 'formSheet'`
- `sheetAllowedDetents: [0.5, 1]`, `sheetGrabberVisible: true`
- Reads/writes picker state from Zustand store
- Calls `router.back()` on selection
- Delete `src/components/SourcePicker.tsx`

### LinkPicker → `app/link-picker.tsx`
- New route file using `presentation: 'formSheet'`
- Same config as SourcePicker
- Reads/writes picker state from Zustand store
- Delete `src/components/LinkPicker.tsx`

### Trash Screen
- Already a modal route — verify `presentation: 'modal'` is set with native styling

### Note Deep Link (`app/note/[id].tsx`)
- Gets native header with back button from Stack navigator
- `Stack.Header blurEffect="systemMaterialDark"`
- Remove custom back button (`<Pressable><Text>Go back</Text></Pressable>`)

### In-Content Surfaces (cards, pills, FAB)
- Keep existing `glassStyle` semi-transparent backgrounds — these are in-content, not navigation chrome
- No `expo-blur` needed — the glass effect comes from the OS navigation chrome
- Cards use the existing `glassStyle.card` with semi-transparent backgrounds on both platforms

### Zustand Store (`src/store.ts`)
- Add fields for picker communication:
  - `pendingSourceId: string | null` — set by workspace before navigating to source-picker
  - `pendingLinkIds: string[]` — set by workspace before navigating to link-picker
  - `sourcePickerCallback: ((id: string | null) => void) | null`
  - `linkPickerCallback: ((ids: string[]) => void) | null`

---

## Files Changed

| File | Change |
|------|--------|
| `app/_layout.tsx` | Add ThemeProvider + crypto polyfill |
| `app/(tabs)/_layout.tsx` | Replace `Tabs` with `NativeTabs`, nest `Stack` per tab |
| `app/(tabs)/index.tsx` | Remove custom header, use `Stack.Screen.Title` + native header |
| `app/(tabs)/workspace.tsx` | Native header + `Stack.Screen.BackButton`, `Switch` for own words, navigate to formSheet routes |
| `app/(tabs)/library.tsx` | Remove custom header + search input, use `Stack.Screen.Title` + `Stack.SearchBar` |
| `app/(tabs)/graph.tsx` | Native header from Stack |
| `app/trash.tsx` | Verify modal presentation |
| `app/note/[id].tsx` | Remove custom back button, use native Stack header |
| `src/store.ts` | Add picker state fields |
| `src/components/SourcePicker.tsx` | DELETE — replaced by route |
| `src/components/LinkPicker.tsx` | DELETE — replaced by route |

New files:
| File | Purpose |
|------|---------|
| `app/source-picker.tsx` | FormSheet route replacing SourcePicker modal |
| `app/link-picker.tsx` | FormSheet route replacing LinkPicker modal |

---

## What We Are NOT Doing

- No `expo-blur` dependency — all blur/glass comes from native OS APIs
- No `react-native-paper` — Android Material You comes from `NativeTabs` + native Stack headers
- No manual `BlurView` wrapping of cards
- No light mode support — dark only
- No changes to `packages/core` — the polyfill is mobile-side only
- No changes to GraphCanvas, NoteCard, MarkdownInput — correctly custom, no native equivalent
- No changes to Swipeable in trash — `react-native-gesture-handler` Swipeable is the standard approach
- No changes to capture card or FAB — custom content, no native form component
