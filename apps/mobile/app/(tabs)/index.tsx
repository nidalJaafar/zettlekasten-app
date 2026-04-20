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
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
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

  useFocusEffect(useCallback(() => {
    loadNotes()
  }, [loadNotes]))

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
      router.navigate('/(tabs)/review')
    },
    [setActiveNote, router]
  )

  const handleProcess = useCallback(
    (note: Note) => {
      setActiveNote(note)
      router.navigate('/(tabs)/review')
    },
    [setActiveNote, router]
  )

  const showActionMenu = useCallback(() => {
    Alert.alert('New Note', 'Choose a note type', [
      {
        text: 'Literature note',
        onPress: async () => {
          if (!db) return
          const note = await createNote(db, { type: 'literature', title: 'Untitled', content: '' })
          setActiveNote(note)
          router.navigate('/(tabs)/review')
        },
      },
      {
        text: 'Permanent note',
        onPress: async () => {
          if (!db) return
          const note = await createNote(db, { type: 'permanent', title: 'Untitled', content: '' })
          setActiveNote(note)
          router.navigate('/(tabs)/review')
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ])
  }, [setActiveNote, router])

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: BG.base }}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Inbox</Text>
          <Pressable
            onPress={() => router.navigate('/trash')}
            style={({ pressed }) => [styles.trashBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.trashBtnText}>Trash</Text>
          </Pressable>
        </View>

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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG.base,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trashBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  trashBtnText: {
    color: TEXT.muted,
    fontFamily: FONT.ui,
    fontSize: 14,
  },
  headerTitle: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 22,
    fontWeight: '700',
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
