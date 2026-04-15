import { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { getAllSources, createSource, type Database, type Source, type SourceType } from '@zettelkasten/core'
import { BG, TEXT, FONT, BORDER, ACCENT, glassStyle } from '../theme'

interface Props {
  db: Database
  selectedId: string | null
  onSelect: (sourceId: string) => void
  visible: boolean
  onClose: () => void
}

const SOURCE_TYPES: SourceType[] = ['book', 'article', 'video', 'podcast', 'conversation', 'other']

export default function SourcePicker({ db, selectedId, onSelect, visible, onClose }: Props) {
  const [sources, setSources] = useState<Source[]>([])
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newType, setNewType] = useState<SourceType>('book')

  const loadSources = useCallback(async () => {
    const all = await getAllSources(db)
    setSources(all)
  }, [db])

  useEffect(() => {
    if (visible) {
      loadSources()
      setSearch('')
      setCreating(false)
    }
  }, [visible, loadSources])

  const filtered = search.trim()
    ? sources.filter((s) => s.label.toLowerCase().includes(search.toLowerCase()))
    : sources

  const handleCreate = useCallback(async () => {
    if (!newLabel.trim()) return
    const source = await createSource(db, {
      type: newType,
      label: newLabel.trim(),
      description: newDesc.trim() || undefined,
    })
    setNewLabel('')
    setNewDesc('')
    setCreating(false)
    await loadSources()
    onSelect(source.id)
  }, [db, newLabel, newType, newDesc, loadSources, onSelect])

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Select Source</Text>
          <View style={{ width: 60 }} />
        </View>

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
                onPress={() => {
                  onSelect(item.id)
                  onClose()
                }}
                style={({ pressed }) => [
                  glassStyle.card,
                  styles.sourceRow,
                  item.id === selectedId && styles.sourceRowSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.sourceInfo}>
                  <Text style={styles.sourceLabel}>{item.label}</Text>
                  <View style={[styles.typeBadge, { borderColor: ACCENT.ink }]}>
                    <Text style={styles.typeText}>{item.type}</Text>
                  </View>
                </View>
                {item.id === selectedId && <Text style={styles.checkMark}>Selected</Text>}
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
  sourceRowSelected: {
    borderColor: ACCENT.ink,
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
  checkMark: {
    color: ACCENT.success,
    fontFamily: FONT.ui,
    fontSize: 11,
    marginTop: 4,
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
