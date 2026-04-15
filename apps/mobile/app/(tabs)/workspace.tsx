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
} from 'react-native'
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
import SourcePicker from '../../src/components/SourcePicker'
import LinkPicker from '../../src/components/LinkPicker'

export default function WorkspaceScreen() {
  const router = useRouter()
  const { db, activeNote, setActiveNote } = useAppStore()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [ownWords, setOwnWords] = useState(false)
  const [linkedIds, setLinkedIds] = useState<string[]>([])
  const [sourcePickerVisible, setSourcePickerVisible] = useState(false)
  const [linkPickerVisible, setLinkPickerVisible] = useState(false)
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

  if (!activeNote || !db) {
    return (
      <View style={styles.emptyRoot}>
        <Text style={styles.emptyTitle}>Workspace</Text>
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
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            setActiveNote(null)
            router.navigate('/(tabs)')
          }}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={[styles.typeBadge, { borderColor: color }]}>
          <Text style={[styles.typeBadgeText, { color }]}>{noteType}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
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
                  onPress={() => setSourcePickerVisible(true)}
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

              <Pressable
                onPress={() => setOwnWords(!ownWords)}
                style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}
              >
                <View style={[styles.checkbox, ownWords && styles.checkboxActive]}>
                  {ownWords && <Text style={styles.checkIcon}>x</Text>}
                </View>
                <Text style={styles.checkLabel}>Written in own words</Text>
              </Pressable>

              <View style={styles.contextRow}>
                <Text style={styles.contextLabel}>
                  Links ({linkedIds.length})
                </Text>
                <Pressable
                  onPress={() => setLinkPickerVisible(true)}
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

      <SourcePicker
        db={db}
        selectedId={sourceId}
        onSelect={(id) => setSourceId(id)}
        visible={sourcePickerVisible}
        onClose={() => setSourcePickerVisible(false)}
      />

      <LinkPicker
        db={db}
        selectedIds={linkedIds}
        onChange={setLinkedIds}
        visible={linkPickerVisible}
        onClose={() => setLinkPickerVisible(false)}
      />
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
  emptyTitle: {
    color: TEXT.primary,
    fontFamily: FONT.display,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyMessage: {
    color: TEXT.muted,
    fontFamily: FONT.ui,
    fontSize: 14,
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
  backBtn: {
    paddingVertical: 4,
  },
  backText: {
    color: ACCENT.ink,
    fontFamily: FONT.ui,
    fontSize: 14,
  },
  typeBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
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
    paddingTop: 12,
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
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: BORDER.base,
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
    fontSize: 11,
    fontWeight: '700',
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
