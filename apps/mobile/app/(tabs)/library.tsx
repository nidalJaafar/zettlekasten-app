import { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
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
