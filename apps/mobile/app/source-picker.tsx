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
    setSearch('')
    setCreating(false)
  }, [loadSources])

  const filtered = search.trim()
    ? sources.filter((s) => s.label.toLowerCase().includes(search.toLowerCase()))
    : sources

  const handleSelect = useCallback(
    (id: string) => {
      pendingSourceCallback?.(id)
      router.back()
    },
    [pendingSourceCallback, router]
  )

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
