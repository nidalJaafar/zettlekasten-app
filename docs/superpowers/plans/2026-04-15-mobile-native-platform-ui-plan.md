# Mobile Native Platform UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all custom-built UI elements with native platform equivalents (Liquid Glass on iOS, Material You on Android), fix the `crypto.randomUUID` crash.

**Architecture:** Use Expo's native APIs — `NativeTabs`, `Stack.Header blurEffect`, `Stack.SearchBar`, `Stack.Screen.BackButton`, `presentation: 'formSheet'`, React Native `Switch`. No manual blur libraries.

**Tech Stack:** Expo SDK 54, `expo-router/unstable-native-tabs`, `@react-navigation/native ThemeProvider`

---

### Task 1: Add crypto.randomUUID polyfill + ThemeProvider

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`
- Modify: `apps/mobile/package.json` (add `@react-navigation/native`)

- [ ] **Step 1: Install @react-navigation/native**

Run: `cd apps/mobile && npx expo install @react-navigation/native`

- [ ] **Step 2: Update root layout**

Replace `apps/mobile/app/_layout.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native'
import { ThemeProvider, DarkTheme } from '@react-navigation/native'
import { useAppStore } from '../src/store'
import { BG, TEXT } from '../src/theme'

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

if (!globalThis.crypto) {
  globalThis.crypto = {} as Crypto
}
if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = uuidv4
}

export default function RootLayout() {
  const { initialized, initDb } = useAppStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    initDb().catch((err) => setError(err instanceof Error ? err.message : 'DB init failed'))
  }, [])

  if (error) {
    return (
      <ThemeProvider value={DarkTheme}>
        <View style={styles.center}>
          <Text style={{ color: TEXT.primary }}>{error}</Text>
        </View>
      </ThemeProvider>
    )
  }

  if (!initialized) {
    return (
      <ThemeProvider value={DarkTheme}>
        <View style={styles.center}>
          <ActivityIndicator color={TEXT.primary} />
        </View>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: BG.base } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="trash"
          options={{
            presentation: 'modal',
            headerShown: true,
            headerTitle: 'Trash',
            headerTintColor: TEXT.primary,
            headerStyle: { backgroundColor: BG.panel },
          }}
        />
        <Stack.Screen
          name="note/[id]"
          options={{
            headerShown: true,
            headerTitle: 'Note',
            headerTintColor: TEXT.primary,
            headerStyle: { backgroundColor: BG.panel },
          }}
        />
        <Stack.Screen
          name="source-picker"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.5, 1],
            sheetGrabberVisible: true,
            headerShown: true,
            headerTitle: 'Select Source',
            headerTintColor: TEXT.primary,
            headerStyle: { backgroundColor: BG.panel },
          }}
        />
        <Stack.Screen
          name="link-picker"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.5, 1],
            sheetGrabberVisible: true,
            headerShown: true,
            headerTitle: 'Link Notes',
            headerTintColor: TEXT.primary,
            headerStyle: { backgroundColor: BG.panel },
          }}
        />
      </Stack>
    </ThemeProvider>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG.base },
})
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @zettelkasten/mobile typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/_layout.tsx apps/mobile/package.json apps/mobile/package-lock.json 2>/dev/null; git commit -m "fix: add crypto.randomUUID polyfill and ThemeProvider for native Liquid Glass"
```

---

### Task 2: Replace Tabs with NativeTabs

**Files:**
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Replace tab layout**

Replace `apps/mobile/app/(tabs)/_layout.tsx` with:

```tsx
import { Stack } from 'expo-router'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { BG, TEXT } from '../../src/theme'

export default function TabLayout() {
  return (
    <NativeTabs
      blurEffect="systemMaterialDark"
      backgroundColor={BG.base}
      tintColor={TEXT.primary}
    >
      <NativeTabs.Trigger name="index" contentStyle={{ backgroundColor: BG.base }}>
        <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="workspace" contentStyle={{ backgroundColor: BG.base }}>
        <NativeTabs.Trigger.Label>Editor</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library" contentStyle={{ backgroundColor: BG.base }}>
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="graph" contentStyle={{ backgroundColor: BG.base }}>
        <NativeTabs.Trigger.Label>Graph</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @zettelkasten/mobile typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(tabs\)/_layout.tsx && git commit -m "feat: replace JavaScript Tabs with NativeTabs for Liquid Glass + Material You"
```

---

### Task 3: Update Inbox screen with native header

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Replace custom header with native Stack header**

Remove the custom `<View style={[glassStyle.header, styles.header]}>` block. Add `Stack.Screen.Title` and `Stack.Header` at the top of the returned JSX. The full replacement for `apps/mobile/app/(tabs)/index.tsx`:

```tsx
import { useState, useCallback, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { Stack } from 'expo-router'
import { useRouter } from 'expo-router'
import { getNotesByType, createNote, type Note } from '@zettelkasten/core'
import { ensureUniqueActiveTitle, DUPLICATE_ACTIVE_TITLE_ERROR } from '../../src/lib/note-workflow'
import { useAppStore } from '../../src/store'
import { BG, TEXT, FONT, BORDER, ACCENT, glassStyle } from '../../src/theme'
import NoteCard from '../../src/components/NoteCard'

export default function InboxScreen() {
  const router = useRouter()
  const { db, setActiveNote } = useAppStore()
  const [notes, setNotes] = useState<Note[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const listRef = useRef<FlatList>(null)

  const loadNotes = useCallback(async () => {
    if (!db) return
    const result = await getNotesByType(db, 'fleeting')
    setNotes(result)
  }, [db])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadNotes()
    setRefreshing(false)
  }, [loadNotes])

  const handleCapture = useCallback(async () => {
    if (!db) return
    const trimmedTitle = title.trim()
    const trimmedBody = body.trim()
    if (!trimmedTitle && !trimmedBody) return

    try {
      if (trimmedTitle) {
        await ensureUniqueActiveTitle(db, trimmedTitle)
      }
      await createNote(db, {
        type: 'fleeting',
        title: trimmedTitle || 'Untitled',
        content: trimmedBody,
      })
      setTitle('')
      setBody('')
      setError(null)
      await loadNotes()
      listRef.current?.scrollToOffset({ offset: 0, animated: true })
    } catch (err) {
      if (err instanceof Error && err.message === DUPLICATE_ACTIVE_TITLE_ERROR) {
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create note')
      }
    }
  }, [db, title, body, loadNotes])

  const handleNotePress = useCallback(
    (note: Note) => {
      setActiveNote(note)
      router.navigate('/(tabs)/workspace')
    },
    [setActiveNote, router]
  )

  const handleProcess = useCallback(
    (note: Note) => {
      setActiveNote(note)
      router.navigate('/(tabs)/workspace')
    },
    [setActiveNote, router]
  )

  const showActionMenu = useCallback(() => {
    Alert.alert('New Note', 'Choose a note type', [
      {
        text: 'Literature note',
        onPress: () => {
          setActiveNote(null)
          router.navigate('/(tabs)/workspace')
        },
      },
      {
        text: 'Permanent note',
        onPress: () => {
          setActiveNote(null)
          router.navigate('/(tabs)/workspace')
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ])
  }, [setActiveNote, router])

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen.Title large>Inbox</Stack.Screen.Title>
      <Stack.Header blurEffect="systemMaterialDark" transparent />

      <FlatList
        ref={listRef}
        data={notes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NoteCard
            note={item}
            onPress={handleNotePress}
            onProcess={handleProcess}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEXT.muted} />
        }
        ListHeaderComponent={
          <View style={[glassStyle.card, styles.captureCard]}>
            <TextInput
              style={styles.input}
              placeholder="Title"
              placeholderTextColor={TEXT.muted}
              value={title}
              onChangeText={(t) => {
                setTitle(t)
                if (error) setError(null)
              }}
              returnKeyType="next"
            />
            <TextInput
              style={[styles.input, styles.bodyInput]}
              placeholder="Capture a thought..."
              placeholderTextColor={TEXT.muted}
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
            <Pressable
              onPress={handleCapture}
              style={({ pressed }) => [
                glassStyle.pill,
                styles.captureBtn,
                pressed && styles.captureBtnPressed,
              ]}
            >
              <Text style={styles.captureBtnText}>Capture</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No fleeting notes yet</Text>
          </View>
        }
      />

      <Pressable
        onPress={showActionMenu}
        style={({ pressed }) => [
          glassStyle.pill,
          styles.fab,
          pressed && styles.fabPressed,
        ]}
      >
        <Text style={styles.fabText}>+ New</Text>
      </Pressable>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG.base,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  captureCard: {
    padding: 16,
    marginTop: 10,
    marginBottom: 18,
  },
  input: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 15,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER.faint,
  },
  bodyInput: {
    minHeight: 72,
    borderBottomWidth: 0,
    marginTop: 4,
  },
  errorText: {
    color: ACCENT.danger,
    fontFamily: FONT.ui,
    fontSize: 12,
    marginTop: 6,
  },
  captureBtn: {
    alignSelf: 'flex-end',
    marginTop: 12,
    backgroundColor: ACCENT.inkSoft,
  },
  captureBtnPressed: {
    opacity: 0.7,
  },
  captureBtnText: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 14,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: TEXT.muted,
    fontFamily: FONT.ui,
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
  },
  fabPressed: {
    opacity: 0.7,
  },
  fabText: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 15,
    fontWeight: '600',
  },
})
```

Key changes: removed custom header `<View>`, added `<Stack.Screen.Title large>Inbox</Stack.Screen.Title>` and `<Stack.Header blurEffect="systemMaterialDark" transparent />`. Removed `headerTitle` style, `countBadge` style, and `header` style.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @zettelkasten/mobile typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(tabs\)/index.tsx && git commit -m "feat: inbox screen uses native Stack header with Liquid Glass blur"
```

---

### Task 4: Update Workspace screen with native header + Switch + formSheet navigation

**Files:**
- Modify: `apps/mobile/app/(tabs)/workspace.tsx`
- Modify: `apps/mobile/src/store.ts`

- [ ] **Step 1: Add picker state to Zustand store**

Replace `apps/mobile/src/store.ts` with:

```tsx
import { create } from 'zustand'
import type { Database, Note } from '@zettelkasten/core'
import { getDb } from './db'

interface AppState {
  db: Database | null
  activeNote: Note | null
  initialized: boolean
  initDb: () => Promise<void>
  setActiveNote: (note: Note | null) => void
  pendingSourceCallback: ((id: string | null) => void) | null
  setPendingSourceCallback: (cb: ((id: string | null) => void) | null) => void
  pendingLinkCallback: ((ids: string[]) => void) | null
  setPendingLinkCallback: (cb: ((ids: string[]) => void) | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  db: null,
  activeNote: null,
  initialized: false,
  initDb: async () => {
    const db = await getDb()
    set({ db, initialized: true })
  },
  setActiveNote: (note) => set({ activeNote: note }),
  pendingSourceCallback: null,
  setPendingSourceCallback: (cb) => set({ pendingSourceCallback: cb }),
  pendingLinkCallback: null,
  setPendingLinkCallback: (cb) => set({ pendingLinkCallback: cb }),
}))
```

- [ ] **Step 2: Replace workspace screen**

Replace `apps/mobile/app/(tabs)/workspace.tsx` with:

```tsx
import { useState, useCallback, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native'
import { Stack } from 'expo-router'
import { useRouter } from 'expo-router'
import {
  getNotesByType,
  softDeleteNote,
  getSourceById,
  type Note,
  type Source,
} from '@zettelkasten/core'
import {
  promoteFleetingToLiterature,
  saveLiteratureAsPermanent,
  savePersistedNote,
  syncWikilinksToLinks,
} from '../../src/lib/note-workflow'
import { useAppStore } from '../../src/store'
import { BG, TEXT, FONT, BORDER, ACCENT, typeColor, glassStyle } from '../../src/theme'
import MarkdownInput from '../../src/components/MarkdownInput'

export default function WorkspaceScreen() {
  const router = useRouter()
  const { db, activeNote, setActiveNote, setPendingSourceCallback, setPendingLinkCallback } = useAppStore()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [ownWords, setOwnWords] = useState(false)
  const [linkedIds, setLinkedIds] = useState<string[]>([])
  const [source, setSource] = useState<Source | null>(null)
  const [wikilinkOptions, setWikilinkOptions] = useState<{ id: string; title: string }[]>([])

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapshotRef = useRef({ title: '', content: '' })
  const initializedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!activeNote) {
      initializedRef.current = null
      setTitle('')
      setContent('')
      setSourceId(null)
      setOwnWords(false)
      setLinkedIds([])
      setSource(null)
      snapshotRef.current = { title: '', content: '' }
      return
    }
    if (initializedRef.current === activeNote.id) return
    initializedRef.current = activeNote.id
    setTitle(activeNote.title)
    setContent(activeNote.content)
    setSourceId(activeNote.source_id)
    setOwnWords(activeNote.own_words_confirmed === 1)
    setLinkedIds([])
    setSource(null)
    snapshotRef.current = { title: activeNote.title, content: activeNote.content }
  }, [activeNote])

  useEffect(() => {
    if (!db || !activeNote) return
    if (!activeNote.source_id) {
      setSource(null)
      return
    }
    getSourceById(db, activeNote.source_id).then(setSource)
  }, [db, activeNote, sourceId])

  useEffect(() => {
    if (!db) return
    getNotesByType(db, 'permanent').then((notes) => {
      setWikilinkOptions(notes.map((n) => ({ id: n.id, title: n.title })))
    })
  }, [db])

  const debouncedSave = useCallback(() => {
    if (!db || !activeNote) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const snap = snapshotRef.current
      if (snap.title === title && snap.content === content) return
      try {
        await savePersistedNote(db, activeNote, { title, content })
        await syncWikilinksToLinks(db, activeNote.id, content)
        snapshotRef.current = { title, content }
      } catch {}
    }, 450)
  }, [db, activeNote, title, content])

  useEffect(() => {
    if (!activeNote) return
    debouncedSave()
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [title, content, activeNote, debouncedSave])

  const handleTitleChange = useCallback((t: string) => {
    setTitle(t)
  }, [])

  const handleContentChange = useCallback((c: string) => {
    setContent(c)
  }, [])

  const handlePromoteToLiterature = useCallback(async () => {
    if (!db || !activeNote || !sourceId) return
    try {
      await promoteFleetingToLiterature(db, activeNote, title, content, sourceId)
      const updated = { ...activeNote, type: 'literature' as const, source_id: sourceId, title, content }
      setActiveNote(updated)
      initializedRef.current = null
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to promote note')
    }
  }, [db, activeNote, title, content, sourceId, setActiveNote])

  const handleSavePermanent = useCallback(async () => {
    if (!db || !activeNote) return
    try {
      const permanent = await saveLiteratureAsPermanent(db, activeNote, title, content, linkedIds, ownWords)
      setActiveNote(permanent)
      initializedRef.current = null
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save permanent note')
    }
  }, [db, activeNote, title, content, linkedIds, ownWords, setActiveNote])

  const handleDelete = useCallback(async () => {
    if (!db || !activeNote) return
    Alert.alert('Delete Note', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await softDeleteNote(db, activeNote.id)
          setActiveNote(null)
          router.navigate('/(tabs)')
        },
      },
    ])
  }, [db, activeNote, setActiveNote, router])

  const openSourcePicker = useCallback(() => {
    setPendingSourceCallback((id) => {
      if (id) setSourceId(id)
    })
    router.push('/source-picker')
  }, [setPendingSourceCallback, router])

  const openLinkPicker = useCallback(() => {
    setPendingLinkCallback((ids) => {
      setLinkedIds(ids)
    })
    router.push('/link-picker')
  }, [setPendingLinkCallback, router])

  if (!activeNote || !db) {
    return (
      <View style={styles.emptyRoot}>
        <Stack.Screen.Title large>Workspace</Stack.Screen.Title>
        <Stack.Header blurEffect="systemMaterialDark" transparent />
        <Text style={styles.emptyMessage}>Select a note from Inbox or create a new one</Text>
      </View>
    )
  }

  const noteType = activeNote.type
  const color = typeColor(noteType)

  const canPromote = noteType === 'fleeting' && sourceId !== null
  const canSavePerm =
    noteType === 'literature' && ownWords && linkedIds.length > 0

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen.Title>{title || 'Workspace'}</Stack.Screen.Title>
      <Stack.Header blurEffect="systemMaterialDark" transparent />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.typeBar]}>
          <View style={[styles.typeBadge, { borderColor: color }]}>
            <Text style={[styles.typeBadgeText, { color }]}>{noteType}</Text>
          </View>
        </View>

        <View style={[glassStyle.card, styles.editorCard]}>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={handleTitleChange}
            placeholder="Note title"
            placeholderTextColor={TEXT.muted}
            returnKeyType="next"
          />
          <MarkdownInput
            value={content}
            onChange={handleContentChange}
            placeholder="Start writing..."
            wikilinkOptions={wikilinkOptions}
          />
        </View>

        <View style={styles.contextSection}>
          {noteType === 'fleeting' && (
            <View style={[glassStyle.card, styles.contextCard]}>
              <View style={styles.contextRow}>
                <Text style={styles.contextLabel}>Source</Text>
                <Pressable
                  onPress={openSourcePicker}
                  style={({ pressed }) => [
                    glassStyle.pill,
                    styles.contextBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.contextBtnText}>
                    {source ? source.label : sourceId ? 'Source set' : 'Attach source'}
                  </Text>
                </Pressable>
              </View>
              <Pressable
                onPress={handlePromoteToLiterature}
                style={({ pressed }) => [
                  glassStyle.pill,
                  styles.actionBtn,
                  !canPromote && styles.disabled,
                  pressed && styles.pressed,
                ]}
                disabled={!canPromote}
              >
                <Text style={styles.actionBtnText}>Promote to Literature</Text>
              </Pressable>
            </View>
          )}

          {noteType === 'literature' && (
            <View style={[glassStyle.card, styles.contextCard]}>
              {source && (
                <View style={styles.contextRow}>
                  <Text style={styles.contextLabel}>Source</Text>
                  <Text style={styles.sourceLabel}>{source.label}</Text>
                </View>
              )}

              <View style={styles.checkRow}>
                <Switch
                  value={ownWords}
                  onValueChange={setOwnWords}
                  trackColor={{ false: BORDER.base, true: ACCENT.ink }}
                  thumbColor={ownWords ? TEXT.primary : TEXT.muted}
                />
                <Text style={styles.checkLabel}>Written in own words</Text>
              </View>

              <View style={styles.contextRow}>
                <Text style={styles.contextLabel}>
                  Links ({linkedIds.length})
                </Text>
                <Pressable
                  onPress={openLinkPicker}
                  style={({ pressed }) => [
                    glassStyle.pill,
                    styles.contextBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.contextBtnText}>Link permanent notes</Text>
                </Pressable>
              </View>

              <Pressable
                onPress={handleSavePermanent}
                style={({ pressed }) => [
                  glassStyle.pill,
                  styles.actionBtn,
                  !canSavePerm && styles.disabled,
                  pressed && styles.pressed,
                ]}
                disabled={!canSavePerm}
              >
                <Text style={styles.actionBtnText}>Save as Permanent</Text>
              </Pressable>
            </View>
          )}

          {noteType === 'permanent' && linkedIds.length > 0 && (
            <View style={[glassStyle.card, styles.contextCard]}>
              <Text style={styles.contextLabel}>Linked notes</Text>
              {linkedIds.map((id) => (
                <Text key={id} style={styles.linkedNote}>
                  {id}
                </Text>
              ))}
            </View>
          )}
        </View>

        <View style={styles.deleteRow}>
          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => [
              glassStyle.pill,
              styles.deleteBtn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG.base,
  },
  emptyRoot: {
    flex: 1,
    backgroundColor: BG.base,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyMessage: {
    color: TEXT.muted,
    fontFamily: FONT.ui,
    fontSize: 14,
  },
  typeBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  typeBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  typeBadgeText: {
    fontFamily: FONT.mono,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 60,
  },
  editorCard: {
    padding: 14,
    marginBottom: 12,
  },
  titleInput: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 17,
    fontWeight: '600',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER.faint,
    marginBottom: 8,
  },
  contextSection: {
    gap: 10,
  },
  contextCard: {
    padding: 14,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  contextLabel: {
    color: TEXT.secondary,
    fontFamily: FONT.ui,
    fontSize: 13,
  },
  sourceLabel: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 13,
    fontWeight: '500',
  },
  contextBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  contextBtnText: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 12,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  checkLabel: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 13,
  },
  actionBtn: {
    alignSelf: 'flex-end',
    marginTop: 4,
    backgroundColor: ACCENT.inkSoft,
  },
  actionBtnText: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 13,
    fontWeight: '600',
  },
  linkedNote: {
    color: TEXT.muted,
    fontFamily: FONT.mono,
    fontSize: 12,
    marginTop: 4,
  },
  deleteRow: {
    marginTop: 16,
    alignItems: 'center',
  },
  deleteBtn: {
    borderColor: ACCENT.danger,
  },
  deleteText: {
    color: ACCENT.danger,
    fontFamily: FONT.ui,
    fontSize: 13,
    fontWeight: '500',
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
})
```

Key changes:
- Removed custom header `<View>` with back button
- Added `<Stack.Screen.Title>` and `<Stack.Header blurEffect="systemMaterialDark" transparent />`
- Replaced custom checkbox with `<Switch>` component
- Replaced `<SourcePicker>` and `<LinkPicker>` modal components with `router.push('/source-picker')` and `router.push('/link-picker')`
- Removed `sourcePickerVisible`, `linkPickerVisible` state
- Added `openSourcePicker` / `openLinkPicker` that set callback in store then navigate

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @zettelkasten/mobile typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(tabs\)/workspace.tsx apps/mobile/src/store.ts && git commit -m "feat: workspace uses native header, Switch, and formSheet navigation"
```

---

### Task 5: Update Library screen with native header + Stack.SearchBar

**Files:**
- Modify: `apps/mobile/app/(tabs)/library.tsx`

- [ ] **Step 1: Replace custom header and search with native equivalents**

Replace `apps/mobile/app/(tabs)/library.tsx` with:

```tsx
import { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native'
import { Stack } from 'expo-router'
import { useRouter } from 'expo-router'
import { getNoteById } from '@zettelkasten/core'
import { useAppStore } from '../../src/store'
import { BG, TEXT, FONT, glassStyle } from '../../src/theme'

interface LibraryNote {
  id: string
  title: string
  source_label: string | null
  updated_at: number
}

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function LibraryScreen() {
  const router = useRouter()
  const { db, setActiveNote } = useAppStore()
  const [notes, setNotes] = useState<LibraryNote[]>([])
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const loadNotes = useCallback(async () => {
    if (!db) return
    const rows = await db.query<LibraryNote>(
      `SELECT n.id, n.title, s.label as source_label, n.updated_at FROM notes n LEFT JOIN sources s ON n.source_id = s.id WHERE n.processed_at IS NOT NULL AND n.deleted_at IS NULL ORDER BY n.updated_at DESC`
    )
    setNotes(rows)
  }, [db])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadNotes()
    setRefreshing(false)
  }, [loadNotes])

  const filtered = search.trim()
    ? notes.filter((n) => n.title.toLowerCase().includes(search.toLowerCase()))
    : notes

  const handlePress = useCallback(
    async (note: LibraryNote) => {
      if (!db) return
      const full = await getNoteById(db, note.id)
      if (full) {
        setActiveNote(full)
        router.navigate('/(tabs)/workspace')
      }
    },
    [db, setActiveNote, router]
  )

  return (
    <>
      <Stack.Screen.Title large>Library</Stack.Screen.Title>
      <Stack.Header blurEffect="systemMaterialDark" transparent />
      <Stack.SearchBar
        placeholder="Search notes..."
        onChangeText={setSearch}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEXT.muted} />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handlePress(item)}
            style={({ pressed }) => [glassStyle.card, styles.card, pressed && styles.cardPressed]}
          >
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title || 'Untitled'}
            </Text>
            <View style={styles.cardRow}>
              <Text style={styles.cardSource}>
                {item.source_label || 'No source'}
              </Text>
              <Text style={styles.cardTime}>{relativeTime(item.updated_at)}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {search ? 'No matching notes' : 'No processed notes yet'}
            </Text>
          </View>
        }
      />
    </>
  )
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  card: {
    padding: 14,
    marginBottom: 10,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardTitle: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardSource: {
    color: TEXT.secondary,
    fontFamily: FONT.ui,
    fontSize: 12,
  },
  cardTime: {
    color: TEXT.muted,
    fontFamily: FONT.ui,
    fontSize: 11,
  },
  empty: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: TEXT.muted,
    fontFamily: FONT.ui,
    fontSize: 14,
  },
})
```

Key changes: removed custom header `<View>`, inline search `<View>`, root `<View>`. Added `Stack.Screen.Title`, `Stack.Header`, `Stack.SearchBar`. Wrapped in `<>` fragment instead of root View since FlatList fills the screen.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @zettelkasten/mobile typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(tabs\)/library.tsx && git commit -m "feat: library uses native Stack header and SearchBar"
```

---

### Task 6: Update Graph screen with native header

**Files:**
- Modify: `apps/mobile/app/(tabs)/graph.tsx`

- [ ] **Step 1: Add native header to graph screen**

In `apps/mobile/app/(tabs)/graph.tsx`, add `Stack.Screen.Title` and `Stack.Header` inside the root `<View>`, right before the `<GraphCanvas>` component:

```tsx
<Stack.Screen.Title large>Graph</Stack.Screen.Title>
<Stack.Header blurEffect="systemMaterialDark" transparent />
```

Remove the import of `glassStyle` from the search card if it's the only remaining use (check — it's also used in `detailCard` and `openBtn`). Keep the import.

The search overlay `top: 56` may need adjustment since the native header now takes that space. The search overlay sits on top of the GraphCanvas, so it needs `position: 'absolute'` with a `top` value that accounts for the native header. Since the native header height varies, use a reasonable offset or `useSafeAreaInsets`. For now, keep `top: 56` as a reasonable starting point — test on device and adjust.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @zettelkasten/mobile typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(tabs\)/graph.tsx && git commit -m "feat: graph screen uses native Stack header"
```

---

### Task 7: Create SourcePicker and LinkPicker as formSheet routes

**Files:**
- Create: `apps/mobile/app/source-picker.tsx`
- Create: `apps/mobile/app/link-picker.tsx`
- Delete: `apps/mobile/src/components/SourcePicker.tsx`
- Delete: `apps/mobile/src/components/LinkPicker.tsx`

- [ ] **Step 1: Create source-picker route**

Create `apps/mobile/app/source-picker.tsx`:

```tsx
import { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { getAllSources, createSource, type Source, type SourceType } from '@zettelkasten/core'
import { useAppStore } from '../src/store'
import { BG, TEXT, FONT, BORDER, ACCENT, glassStyle } from '../src/theme'

const SOURCE_TYPES: SourceType[] = ['book', 'article', 'video', 'podcast', 'conversation', 'other']

export default function SourcePickerScreen() {
  const router = useRouter()
  const { db, pendingSourceCallback } = useAppStore()
  const [sources, setSources] = useState<Source[]>([])
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newType, setNewType] = useState<SourceType>('book')

  const loadSources = useCallback(async () => {
    if (!db) return
    const all = await getAllSources(db)
    setSources(all)
  }, [db])

  useEffect(() => {
    loadSources()
  }, [loadSources])

  const filtered = search.trim()
    ? sources.filter((s) => s.label.toLowerCase().includes(search.toLowerCase()))
    : sources

  const handleSelect = useCallback((id: string) => {
    if (pendingSourceCallback) pendingSourceCallback(id)
    router.back()
  }, [pendingSourceCallback, router])

  const handleCreate = useCallback(async () => {
    if (!db || !newLabel.trim()) return
    const source = await createSource(db, {
      type: newType,
      label: newLabel.trim(),
      description: newDesc.trim() || undefined,
    })
    setNewLabel('')
    setNewDesc('')
    setCreating(false)
    await loadSources()
    handleSelect(source.id)
  }, [db, newLabel, newType, newDesc, loadSources, handleSelect])

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TextInput
        style={styles.searchInput}
        placeholder="Search sources..."
        placeholderTextColor={TEXT.muted}
        value={search}
        onChangeText={setSearch}
      />

      {!creating ? (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleSelect(item.id)}
              style={({ pressed }) => [
                glassStyle.card,
                styles.sourceRow,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.sourceInfo}>
                <Text style={styles.sourceLabel}>{item.label}</Text>
                <View style={[styles.typeBadge, { borderColor: ACCENT.ink }]}>
                  <Text style={styles.typeText}>{item.type}</Text>
                </View>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No sources found</Text>
          }
          ListFooterComponent={
            <Pressable
              onPress={() => setCreating(true)}
              style={({ pressed }) => [glassStyle.pill, styles.createBtn, pressed && styles.pressed]}
            >
              <Text style={styles.createBtnText}>Create New Source</Text>
            </Pressable>
          }
        />
      ) : (
        <View style={[glassStyle.card, styles.createForm]}>
          <Text style={styles.formTitle}>New Source</Text>
          <View style={styles.typeRow}>
            {SOURCE_TYPES.map((t) => (
              <Pressable
                key={t}
                onPress={() => setNewType(t)}
                style={[
                  styles.typeOption,
                  newType === t && styles.typeOptionActive,
                ]}
              >
                <Text style={[styles.typeOptionText, newType === t && styles.typeOptionTextActive]}>
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.formInput}
            placeholder="Label"
            placeholderTextColor={TEXT.muted}
            value={newLabel}
            onChangeText={setNewLabel}
          />
          <TextInput
            style={[styles.formInput, styles.formInputMultiline]}
            placeholder="Description (optional)"
            placeholderTextColor={TEXT.muted}
            value={newDesc}
            onChangeText={setNewDesc}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
          <View style={styles.formActions}>
            <Pressable
              onPress={() => setCreating(false)}
              style={({ pressed }) => [glassStyle.pill, pressed && styles.pressed]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleCreate}
              style={({ pressed }) => [
                glassStyle.pill,
                styles.saveBtn,
                !newLabel.trim() && styles.disabled,
                pressed && styles.pressed,
              ]}
              disabled={!newLabel.trim()}
            >
              <Text style={styles.saveText}>Create</Text>
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG.base,
  },
  searchInput: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 14,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: BG.raised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER.base,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  sourceRow: {
    padding: 12,
    marginBottom: 8,
  },
  sourceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sourceLabel: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  typeBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 8,
  },
  typeText: {
    color: ACCENT.ink,
    fontFamily: FONT.mono,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  emptyText: {
    color: TEXT.muted,
    fontFamily: FONT.ui,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 30,
  },
  createBtn: {
    alignSelf: 'center',
    marginTop: 16,
    backgroundColor: ACCENT.inkSoft,
  },
  createBtnText: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 14,
    fontWeight: '500',
  },
  createForm: {
    margin: 16,
    padding: 16,
  },
  formTitle: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  typeOption: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER.base,
    backgroundColor: BG.hover,
  },
  typeOptionActive: {
    borderColor: ACCENT.ink,
    backgroundColor: ACCENT.inkSoft,
  },
  typeOptionText: {
    color: TEXT.secondary,
    fontFamily: FONT.mono,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  typeOptionTextActive: {
    color: TEXT.primary,
  },
  formInput: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: BG.hover,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER.faint,
    marginBottom: 8,
  },
  formInputMultiline: {
    minHeight: 48,
    textAlignVertical: 'top',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  cancelText: {
    color: TEXT.secondary,
    fontFamily: FONT.ui,
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: ACCENT.inkSoft,
  },
  saveText: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 14,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
})
```

- [ ] **Step 2: Create link-picker route**

Create `apps/mobile/app/link-picker.tsx`:

```tsx
import { useState, useCallback, useEffect } from 'react'
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { getNotesByType, type Note } from '@zettelkasten/core'
import { useAppStore } from '../src/store'
import { BG, TEXT, FONT, BORDER, ACCENT, glassStyle } from '../src/theme'

export default function LinkPickerScreen() {
  const router = useRouter()
  const { db, pendingLinkCallback } = useAppStore()
  const [notes, setNotes] = useState<Note[]>([])
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const loadNotes = useCallback(async () => {
    if (!db) return
    const result = await getNotesByType(db, 'permanent')
    setNotes(result)
  }, [db])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  const filtered = search.trim()
    ? notes.filter((n) => n.title.toLowerCase().includes(search.toLowerCase()))
    : notes

  const toggleNote = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const set = new Set(prev)
      if (set.has(id)) set.delete(id)
      else set.add(id)
      return Array.from(set)
    })
  }, [])

  const handleDone = useCallback(() => {
    if (pendingLinkCallback) pendingLinkCallback(selectedIds)
    router.back()
  }, [pendingLinkCallback, selectedIds, router])

  return (
    <View style={styles.root}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search permanent notes..."
        placeholderTextColor={TEXT.muted}
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isSelected = selectedIds.includes(item.id)
          return (
            <Pressable
              onPress={() => toggleNote(item.id)}
              style={({ pressed }) => [
                glassStyle.card,
                styles.noteRow,
                isSelected && styles.noteRowSelected,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.noteContent}>
                <Text style={styles.noteTitle} numberOfLines={1}>
                  {item.title || 'Untitled'}
                </Text>
                {item.content ? (
                  <Text style={styles.notePreview} numberOfLines={1}>
                    {item.content.split('\n')[0]}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                {isSelected && <Text style={styles.checkIcon}>x</Text>}
              </View>
            </Pressable>
          )
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No permanent notes found</Text>
        }
      />

      <Pressable
        onPress={handleDone}
        style={({ pressed }) => [glassStyle.pill, styles.doneBtn, pressed && styles.pressed]}
      >
        <Text style={styles.doneText}>Done ({selectedIds.length})</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG.base,
  },
  searchInput: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 14,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: BG.raised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER.base,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 80,
  },
  noteRow: {
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteRowSelected: {
    borderColor: ACCENT.ink,
  },
  noteContent: {
    flex: 1,
  },
  noteTitle: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 14,
    fontWeight: '500',
  },
  notePreview: {
    color: TEXT.muted,
    fontFamily: FONT.ui,
    fontSize: 12,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER.base,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: ACCENT.ink,
    borderColor: ACCENT.ink,
  },
  checkIcon: {
    color: BG.base,
    fontFamily: FONT.ui,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    color: TEXT.muted,
    fontFamily: FONT.ui,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 30,
  },
  doneBtn: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: ACCENT.inkSoft,
  },
  doneText: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
})
```

- [ ] **Step 3: Delete old modal components**

```bash
rm apps/mobile/src/components/SourcePicker.tsx apps/mobile/src/components/LinkPicker.tsx
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @zettelkasten/mobile typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/source-picker.tsx apps/mobile/app/link-picker.tsx && git rm apps/mobile/src/components/SourcePicker.tsx apps/mobile/src/components/LinkPicker.tsx && git commit -m "feat: convert SourcePicker and LinkPicker to native formSheet routes"
```

---

### Task 8: Update note/[id].tsx with native header

**Files:**
- Modify: `apps/mobile/app/note/[id].tsx`

- [ ] **Step 1: Remove custom back button, use native header**

In `apps/mobile/app/note/[id].tsx`:

1. Add `Stack` import from `expo-router` (already has `useLocalSearchParams` and `useRouter`).
2. Remove the "not found" custom back button (`<Pressable><Text>Go back</Text></Pressable>`) and replace with a simple message — the native header already has a back button.
3. Keep the note display as-is.

Replace the file with:

```tsx
import { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { getNoteById, type Note } from '@zettelkasten/core'
import { useAppStore } from '../../src/store'
import { BG, TEXT, FONT, typeColor, glassStyle } from '../../src/theme'
import MarkdownInput from '../../src/components/MarkdownInput'

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const db = useAppStore((s) => s.db)
  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !id) return
    getNoteById(db, id).then((n) => {
      setNote(n ?? null)
      setLoading(false)
    })
  }, [db, id])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={TEXT.primary} />
      </View>
    )
  }

  if (!note) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundText}>Note not found</Text>
      </View>
    )
  }

  const color = typeColor(note.type)

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={[styles.typeBadge, { borderColor: color }]}>
          <Text style={[styles.typeText, { color }]}>{note.type}</Text>
        </View>
      </View>
      <Text style={styles.title}>{note.title || 'Untitled'}</Text>
      <View style={glassStyle.card}>
        <View style={styles.markdownWrap}>
          <MarkdownInput
            value={note.content}
            onChange={() => {}}
            placeholder="No content"
          />
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG.base,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 60,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG.base,
  },
  notFoundText: {
    color: TEXT.primary,
    fontFamily: FONT.display,
    fontSize: 22,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  typeBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  typeText: {
    fontFamily: FONT.mono,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  title: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  markdownWrap: {
    padding: 14,
  },
})
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @zettelkasten/mobile typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/note/\[id\].tsx && git commit -m "feat: note detail uses native Stack header back button"
```

---

### Task 9: Final typecheck + tests + cleanup

- [ ] **Step 1: Run full typecheck**

Run: `pnpm typecheck`
Expected: All 3 packages pass

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: All tests pass (no changes to core)

- [ ] **Step 3: Clean up unused glassStyle entries**

In `apps/mobile/src/theme.ts`, the `glassStyle.header` and `glassStyle.tabBar` entries are no longer used by any screen. Verify with:

```bash
rg "glassStyle\.(header|tabBar)" apps/mobile/ --no-heading
```

If no results, remove those entries from `glassStyle` in `theme.ts`.

- [ ] **Step 4: Remove unused imports**

Check all modified files for unused imports (e.g., `useRouter` removed from note/[id].tsx). Run typecheck to catch them.

- [ ] **Step 5: Commit cleanup**

```bash
git add -A && git commit -m "chore: remove unused theme entries and imports"
```
