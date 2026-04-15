import { useState, useCallback, useEffect, useRef } from 'react'
import { View, Text, FlatList, Alert, StyleSheet, RefreshControl } from 'react-native'
import { Swipeable } from 'react-native-gesture-handler'
import { restoreNote, permanentlyDeleteNote, type Note } from '@zettelkasten/core'
import { useAppStore } from '../src/store'
import { BG, TEXT, FONT, BORDER, ACCENT, typeColor, glassStyle } from '../src/theme'

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

export default function TrashScreen() {
  const db = useAppStore((s) => s.db)
  const [notes, setNotes] = useState<Note[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const openSwipeable = useRef<Swipeable | null>(null)

  const loadNotes = useCallback(async () => {
    if (!db) return
    const rows = await db.query<Note>(
      'SELECT * FROM notes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'
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

  const handleRestore = useCallback(
    async (id: string) => {
      if (!db) return
      await restoreNote(db, id)
      await loadNotes()
    },
    [db, loadNotes]
  )

  const confirmPermanentDelete = useCallback(
    (id: string) => {
      Alert.alert('Delete Permanently', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!db) return
            await permanentlyDeleteNote(db, id)
            await loadNotes()
          },
        },
      ])
    },
    [db, loadNotes]
  )

  const renderLeftActions = useCallback(
    () => (
      <View style={styles.restoreAction}>
        <Text style={styles.actionLabel}>Restore</Text>
      </View>
    ),
    []
  )

  const renderRightActions = useCallback(
    () => (
      <View style={styles.deleteAction}>
        <Text style={styles.deleteLabel}>Delete</Text>
      </View>
    ),
    []
  )

  const renderItem = useCallback(
    ({ item }: { item: Note }) => {
      const color = typeColor(item.type)
      return (
        <Swipeable
          renderLeftActions={renderLeftActions}
          renderRightActions={renderRightActions}
          onSwipeableOpen={(direction, swipeable) => {
            if (openSwipeable.current && openSwipeable.current !== swipeable) {
              openSwipeable.current.close()
            }
            openSwipeable.current = swipeable

            if (direction === 'left') {
              handleRestore(item.id)
            } else {
              confirmPermanentDelete(item.id)
            }
          }}
          overshootLeft={false}
          overshootRight={false}
          friction={2}
        >
          <View style={[glassStyle.card, styles.card]}>
            <View style={styles.cardRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title || 'Untitled'}
              </Text>
              <View style={[styles.typeBadge, { borderColor: color }]}>
                <Text style={[styles.typeText, { color }]}>{item.type}</Text>
              </View>
            </View>
            {item.deleted_at != null && (
              <Text style={styles.cardDate}>Deleted {relativeTime(item.deleted_at)}</Text>
            )}
          </View>
        </Swipeable>
      )
    },
    [renderLeftActions, renderRightActions, handleRestore, confirmPermanentDelete]
  )

  return (
    <View style={styles.root}>
      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEXT.muted} />
        }
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Trash is empty</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG.base,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  card: {
    padding: 14,
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  typeBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  typeText: {
    fontFamily: FONT.mono,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  cardDate: {
    color: TEXT.muted,
    fontFamily: FONT.ui,
    fontSize: 12,
  },
  restoreAction: {
    backgroundColor: ACCENT.success,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  actionLabel: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 14,
    fontWeight: '600',
  },
  deleteAction: {
    backgroundColor: ACCENT.danger,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  deleteLabel: {
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
})
