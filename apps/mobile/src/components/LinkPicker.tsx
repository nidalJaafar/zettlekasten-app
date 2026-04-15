import { useState, useCallback, useEffect } from 'react'
import { View, Text, TextInput, Pressable, Modal, FlatList, StyleSheet } from 'react-native'
import { getNotesByType, type Database, type Note } from '@zettelkasten/core'
import { BG, TEXT, FONT, BORDER, ACCENT, glassStyle } from '../theme'

interface Props {
  db: Database
  selectedIds: string[]
  onChange: (ids: string[]) => void
  visible: boolean
  onClose: () => void
}

export default function LinkPicker({ db, selectedIds, onChange, visible, onClose }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [search, setSearch] = useState('')

  const loadNotes = useCallback(async () => {
    const result = await getNotesByType(db, 'permanent')
    setNotes(result)
  }, [db])

  useEffect(() => {
    if (visible) {
      loadNotes()
      setSearch('')
    }
  }, [visible, loadNotes])

  const filtered = search.trim()
    ? notes.filter((n) => n.title.toLowerCase().includes(search.toLowerCase()))
    : notes

  const toggleNote = useCallback(
    (id: string) => {
      const set = new Set(selectedIds)
      if (set.has(id)) {
        set.delete(id)
      } else {
        set.add(id)
      }
      onChange(Array.from(set))
    },
    [selectedIds, onChange]
  )

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Link Notes</Text>
          {selectedIds.length > 0 && (
            <View style={glassStyle.pill}>
              <Text style={styles.countText}>{selectedIds.length}</Text>
            </View>
          )}
          {selectedIds.length === 0 && <View style={{ width: 40 }} />}
        </View>

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
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER.faint,
  },
  closeBtn: {
    paddingVertical: 4,
  },
  closeText: {
    color: ACCENT.ink,
    fontFamily: FONT.ui,
    fontSize: 14,
  },
  headerTitle: {
    color: TEXT.primary,
    fontFamily: FONT.display,
    fontSize: 18,
    fontWeight: '700',
  },
  countText: {
    color: TEXT.primary,
    fontFamily: FONT.mono,
    fontSize: 12,
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
  pressed: {
    opacity: 0.7,
  },
})
