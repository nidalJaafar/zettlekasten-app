import { useState, useCallback, useEffect, useRef } from 'react'
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { getNotesByType, type Note } from '@zettelkasten/core'
import { useAppStore } from '../src/store'
import { getInitialLinkPickerSelection } from '../src/lib/note-workflow'
import { BG, TEXT, FONT, BORDER, ACCENT, glassStyle } from '../src/theme'

export default function LinkPickerScreen() {
  const router = useRouter()
  const { db, pendingLinkCallback, pendingReviewDraft, setPendingReviewDraft } = useAppStore()

  const [notes, setNotes] = useState<Note[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const completedRef = useRef(false)

  const loadNotes = useCallback(async () => {
    if (!db) return
    const result = await getNotesByType(db, 'permanent')
    setNotes(result)
  }, [db])

  useEffect(() => {
    loadNotes()
    setSearch('')
    setSelectedIds(getInitialLinkPickerSelection(pendingReviewDraft))
  }, [loadNotes, pendingReviewDraft])

  useEffect(() => {
    return () => {
      if (!pendingReviewDraft || completedRef.current) return
      setPendingReviewDraft({ ...pendingReviewDraft, roundTripComplete: true })
    }
  }, [pendingReviewDraft, setPendingReviewDraft])

  const filtered = search.trim()
    ? notes.filter((n) => n.title.toLowerCase().includes(search.toLowerCase()))
    : notes

  const toggleNote = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const set = new Set(prev)
        if (set.has(id)) {
          set.delete(id)
        } else {
          set.add(id)
        }
        return Array.from(set)
      })
    },
    []
  )

  const handleDone = useCallback(() => {
    completedRef.current = true
    if (pendingReviewDraft) {
      setPendingReviewDraft({ ...pendingReviewDraft, linkedIds: selectedIds, roundTripComplete: true })
    }
    pendingLinkCallback?.(selectedIds)
    router.back()
  }, [pendingLinkCallback, pendingReviewDraft, selectedIds, setPendingReviewDraft, router])

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

      <View style={styles.footer}>
        <Pressable
          onPress={handleDone}
          style={({ pressed }) => [
            glassStyle.pill,
            styles.doneBtn,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.doneText}>
            Done{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
          </Text>
        </Pressable>
      </View>
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
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 10,
    backgroundColor: BG.base,
    borderTopWidth: 1,
    borderTopColor: BORDER.faint,
    alignItems: 'center',
  },
  doneBtn: {
    backgroundColor: ACCENT.inkSoft,
    paddingVertical: 10,
    paddingHorizontal: 32,
  },
  doneText: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
})
