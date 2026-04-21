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
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  getNotesByType,
  countNotesByType,
  softDeleteNote,
  getSourceById,
  getLinkedNoteIds,
  type Note,
  type Source,
} from '@zettelkasten/core'
import {
  consumeCompletedReviewDraft,
  consumeReviewDraft,
  getCompletedReviewDraftLinkedIds,
  mergeLinkedIdsIntoReviewDraft,
  promoteFleetingToLiterature,
  saveLiteratureAsPermanent,
  savePersistedNote,
} from '../../src/lib/note-workflow'
import { useAppStore } from '../../src/store'
import { BG, TEXT, FONT, BORDER, ACCENT, typeColor, glassStyle } from '../../src/theme'
import MarkdownInput from '../../src/components/MarkdownInput'

export default function ReviewScreen() {
  const router = useRouter()
  const {
    db,
    activeNote,
    setActiveNote,
    setPendingSourceCallback,
    setPendingLinkCallback,
    pendingReviewDraft,
    setPendingReviewDraft,
  } = useAppStore()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [ownWords, setOwnWords] = useState(false)
  const [linkedIds, setLinkedIds] = useState<string[]>([])
  const [source, setSource] = useState<Source | null>(null)
  const [wikilinkOptions, setWikilinkOptions] = useState<{ id: string; title: string }[]>([])
  const [permCount, setPermCount] = useState(0)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapshotRef = useRef({ title: '', content: '', sourceId: null as string | null })
  const initializedRef = useRef<string | null>(null)
  const skipLinkedHydrationRef = useRef<string | null>(null)

  useEffect(() => {
    if (!activeNote) {
      initializedRef.current = null
      setTitle('')
      setContent('')
      setSourceId(null)
      setOwnWords(false)
      setLinkedIds([])
      setSource(null)
      snapshotRef.current = { title: '', content: '', sourceId: null }
      return
    }
    if (initializedRef.current === activeNote.id) return
    initializedRef.current = activeNote.id
    const { initialState, remainingDraft } = consumeReviewDraft(activeNote, pendingReviewDraft)
    setTitle(initialState.title)
    setContent(initialState.content)
    setSourceId(initialState.sourceId)
    setOwnWords(initialState.ownWords)
    setLinkedIds(initialState.linkedIds)
    setSource(null)
    snapshotRef.current = {
      title: initialState.title,
      content: initialState.content,
      sourceId: initialState.sourceId,
    }
    if (remainingDraft !== pendingReviewDraft) {
      setPendingReviewDraft(remainingDraft)
    }
  }, [activeNote, pendingReviewDraft, setPendingReviewDraft])

  useEffect(() => {
    if (!activeNote || !pendingReviewDraft) return

    const completedLinkedIds = getCompletedReviewDraftLinkedIds(activeNote, pendingReviewDraft)
    const remainingDraft = consumeCompletedReviewDraft(activeNote, pendingReviewDraft)
    if (remainingDraft !== pendingReviewDraft) {
      if (completedLinkedIds) {
        setLinkedIds(completedLinkedIds)
        skipLinkedHydrationRef.current = activeNote.id
      }
      setPendingReviewDraft(remainingDraft)
    }
  }, [activeNote, pendingReviewDraft, setPendingReviewDraft])

  useEffect(() => {
    if (!db) return

    if (!sourceId) {
      setSource(null)
      return
    }

    let cancelled = false

    setSource(null)

    getSourceById(db, sourceId).then((nextSource) => {
      if (!cancelled) {
        setSource(nextSource)
      }
    })

    return () => {
      cancelled = true
    }
  }, [db, sourceId])

  useEffect(() => {
    if (!db || !activeNote) return
    if (activeNote.type === 'fleeting') {
      setLinkedIds([])
      return
    }

    if (pendingReviewDraft?.noteId === activeNote.id) {
      setLinkedIds(pendingReviewDraft.linkedIds)
      return
    }

    if (skipLinkedHydrationRef.current === activeNote.id) {
      skipLinkedHydrationRef.current = null
      return
    }

    let cancelled = false

    getLinkedNoteIds(db, activeNote.id).then((ids) => {
      if (!cancelled) {
        setLinkedIds(ids)
      }
    })

    return () => {
      cancelled = true
    }
  }, [db, activeNote, pendingReviewDraft])

  useEffect(() => {
    if (!db) return
    getNotesByType(db, 'permanent').then((notes) => {
      setWikilinkOptions(notes.map((n) => ({ id: n.id, title: n.title })))
    })
  }, [db])

  useEffect(() => {
    if (!db || !activeNote || activeNote.type !== 'literature') return
    countNotesByType(db, 'permanent').then(setPermCount)
  }, [db, activeNote])

  const debouncedSave = useCallback(() => {
    if (!db || !activeNote) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const snap = snapshotRef.current
      if (snap.title === title && snap.content === content && snap.sourceId === sourceId) return
      try {
        const updates = {
          title,
          content,
          ...(activeNote.type !== 'permanent' ? { source_id: sourceId } : {}),
        }

        await savePersistedNote(db, activeNote, updates)
        setActiveNote({ ...activeNote, ...updates })
        snapshotRef.current = { title, content, sourceId }
      } catch (err) {
        if (err instanceof Error) {
          Alert.alert('Save Error', err.message)
        }
      }
    }, 450)
  }, [db, activeNote, title, content, sourceId, setActiveNote])

  useEffect(() => {
    if (!activeNote) return
    debouncedSave()
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [title, content, sourceId, activeNote, debouncedSave])

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
    if (!activeNote) return

    const draft = {
      noteId: activeNote.id,
      title,
      content,
      sourceId,
      ownWords,
      linkedIds,
      roundTripComplete: false,
    }

    setPendingReviewDraft(draft)
    setPendingLinkCallback((ids) => {
      setLinkedIds(ids)
      const currentDraft = useAppStore.getState().pendingReviewDraft
      const baseDraft = currentDraft?.noteId === draft.noteId ? currentDraft : draft
      setPendingReviewDraft(mergeLinkedIdsIntoReviewDraft(baseDraft, ids))
    })
    router.push('/link-picker')
  }, [activeNote, title, content, sourceId, ownWords, linkedIds, setPendingLinkCallback, setPendingReviewDraft, router])

  if (!activeNote || !db) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: BG.base }}>
        <View style={styles.emptyRoot}>
          <View style={styles.header}>
            <Pressable onPress={() => router.navigate('/(tabs)')} style={({ pressed }) => [glassStyle.pill, styles.backBtn, pressed && styles.pressed]}>
              <Text style={styles.backText}>Back</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Review</Text>
          </View>
          <Text style={styles.emptyMessage}>Select a note from Inbox to start Review</Text>
        </View>
      </SafeAreaView>
    )
  }

  const noteType = activeNote.type
  const color = typeColor(noteType)

  const canPromote = noteType === 'fleeting' && sourceId !== null
  const canSavePerm =
    noteType === 'literature' && ownWords && (linkedIds.length > 0 || permCount === 0)

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: BG.base }}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.navigate('/(tabs)')} style={({ pressed }) => [glassStyle.pill, styles.backBtn, pressed && styles.pressed]}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Review</Text>
        </View>
        <View style={styles.typeBar}>
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
          <Text style={styles.noteTitleLabel}>{title || 'Untitled'}</Text>
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
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 10,
  },
  headerTitle: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  backBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  backText: {
    color: TEXT.secondary,
    fontFamily: FONT.ui,
    fontSize: 13,
  },
  emptyMessage: {
    color: TEXT.muted,
    fontFamily: FONT.ui,
    fontSize: 14,
    textAlign: 'center',
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
    paddingTop: 12,
    paddingBottom: 60,
  },
  noteTitleLabel: {
    color: TEXT.secondary,
    fontFamily: FONT.ui,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
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
