import { useState, useCallback, useEffect } from 'react'
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { getNotesByType, type Note } from '@zettelkasten/core'
import { useAppStore } from '../../src/store'
import { BG, TEXT, FONT, BORDER, typeColor, glassStyle } from '../../src/theme'

export default function ReviewScreen() {
  const router = useRouter()
  const { db, setActiveNote } = useAppStore()
  const [notes, setNotes] = useState<Note[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const loadNotes = useCallback(async () => {
    if (!db) return

    const [fleeting, literature] = await Promise.all([
      getNotesByType(db, 'fleeting'),
      db.query<Note>(
        `SELECT * FROM notes WHERE type = 'literature' AND processed_at IS NULL AND deleted_at IS NULL ORDER BY created_at ASC`
      ),
    ])

    setNotes([...fleeting, ...literature].sort((a, b) => a.created_at - b.created_at))
  }, [db])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  useFocusEffect(useCallback(() => {
    loadNotes()
  }, [loadNotes]))

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await loadNotes()
    } finally {
      setRefreshing(false)
    }
  }, [loadNotes])

  const handlePress = useCallback(
    (note: Note) => {
      setActiveNote(note)
      router.navigate('/workspace')
    },
    [setActiveNote, router]
  )

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: BG.base }}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Review</Text>
        </View>

        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, notes.length === 0 && styles.listEmpty]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEXT.muted} />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handlePress(item)}
              style={({ pressed }) => [glassStyle.card, styles.card, pressed && styles.cardPressed]}
            >
              <View style={[styles.cardAccent, { backgroundColor: typeColor(item.type) }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title || 'Untitled'}
                  </Text>
                  <View style={styles.cardTypeChip}>
                    <Text style={[styles.cardTypeText, { color: typeColor(item.type) }]}>{item.type}</Text>
                  </View>
                </View>
                <Text style={styles.cardPreview} numberOfLines={2}>
                  {previewText(item.content) ?? 'No content yet. Open this note to continue Review.'}
                </Text>
              </View>
            </Pressable>
          )}
          ListHeaderComponent={
            notes.length > 0 ? (
              <Text style={styles.queueLabel}>Review Queue {notes.length}</Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No notes waiting for Review</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  )
}

function previewText(content: string | null): string | null {
  const trimmed = content?.trim()
  if (!trimmed) return null
  const maxLength = 120
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}...`
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG.base,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
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
    gap: 10,
  },
  listEmpty: {
    flexGrow: 1,
  },
  queueLabel: {
    color: TEXT.faint,
    fontFamily: FONT.ui,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.72,
  },
  cardAccent: {
    width: 6,
  },
  cardBody: {
    flex: 1,
    padding: 14,
    gap: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 15,
    fontWeight: '600',
  },
  cardTypeChip: {
    borderWidth: 1,
    borderColor: BORDER.base,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: BG.panel,
  },
  cardTypeText: {
    fontFamily: FONT.ui,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardPreview: {
    color: TEXT.secondary,
    fontFamily: FONT.ui,
    fontSize: 13,
    lineHeight: 19,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    color: TEXT.muted,
    fontFamily: FONT.ui,
    fontSize: 14,
    textAlign: 'center',
  },
})
