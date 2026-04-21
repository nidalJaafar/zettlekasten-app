import { useState, useCallback, useEffect, useMemo } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { getNotesByType, getAllLinks, getNoteById } from '@zettelkasten/core'
import type { Note, NoteLink } from '@zettelkasten/core'
import { useAppStore } from '../../src/store'
import { BG, TEXT, FONT, ACCENT, typeColor, glassStyle } from '../../src/theme'
import GraphCanvas from '../../src/components/GraphCanvas'

export default function GraphScreen() {
  const router = useRouter()
  const { db, setActiveNote } = useAppStore()
  const [notes, setNotes] = useState<Note[]>([])
  const [links, setLinks] = useState<NoteLink[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!db) return
    const [n, l] = await Promise.all([
      getNotesByType(db, 'permanent'),
      getAllLinks(db),
    ])
    setNotes(n)
    setLinks(l)
  }, [db])

  useEffect(() => {
    loadData()
  }, [loadData])

  useFocusEffect(useCallback(() => {
    loadData()
  }, [loadData]))

  const graphNodes = useMemo(
    () => notes.map((n) => ({ id: n.id, title: n.title, type: n.type })),
    [notes]
  )

  const graphEdges = useMemo(
    () => links.map((l) => ({ source: l.from_note_id, target: l.to_note_id })),
    [links]
  )

  const filteredNodes = useMemo(() => {
    if (!search.trim()) return graphNodes
    const q = search.toLowerCase()
    return graphNodes.filter((n) => n.title.toLowerCase().includes(q))
  }, [graphNodes, search])

  const visibleIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes])

  const filteredEdges = useMemo(
    () => graphEdges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target)),
    [graphEdges, visibleIds]
  )

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId]
  )

  const selectedLinkCount = useMemo(() => {
    if (!selectedId) return 0
    return links.filter(
      (l) => l.from_note_id === selectedId || l.to_note_id === selectedId
    ).length
  }, [links, selectedId])

  const handleNodePress = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id))
  }, [])

  const handleOpen = useCallback(async () => {
    if (!db || !selectedNote) return
    const full = await getNoteById(db, selectedNote.id)
    if (full) {
      setActiveNote(full)
      router.navigate('/(tabs)/review')
    }
  }, [db, selectedNote, setActiveNote, router])

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: BG.canvas }}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Graph</Text>
        </View>
        <GraphCanvas
          nodes={filteredNodes}
          edges={filteredEdges}
          onNodePress={handleNodePress}
        />

        <View style={styles.searchOverlay}>
          <View style={[glassStyle.card, styles.searchCard]}>
            <TextInput
              style={styles.searchInput}
              placeholder="Filter nodes..."
              placeholderTextColor={TEXT.muted}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        {selectedNote && (
          <View style={styles.detailOverlay}>
            <View style={[glassStyle.card, styles.detailCard]}>
              <View style={styles.detailRow}>
                <Text style={styles.detailTitle} numberOfLines={1}>
                  {selectedNote.title || 'Untitled'}
                </Text>
                <View style={[styles.typeBadge, { borderColor: typeColor(selectedNote.type) }]}>
                  <Text style={[styles.typeText, { color: typeColor(selectedNote.type) }]}>
                    {selectedNote.type}
                  </Text>
                </View>
              </View>
              <View style={styles.detailFooter}>
                <Text style={styles.linkCount}>{selectedLinkCount} link{selectedLinkCount !== 1 ? 's' : ''}</Text>
                <Pressable
                  onPress={handleOpen}
                  style={({ pressed }) => [glassStyle.pill, styles.openBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.openText}>Open</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG.canvas,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerTitle: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 22,
    fontWeight: '700',
  },
  searchOverlay: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
  },
  searchCard: {
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  searchInput: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 14,
    paddingVertical: 10,
  },
  detailOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
  },
  detailCard: {
    padding: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailTitle: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 16,
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
  detailFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkCount: {
    color: TEXT.muted,
    fontFamily: FONT.ui,
    fontSize: 12,
  },
  openBtn: {
    backgroundColor: 'rgba(143,152,168,0.14)',
  },
  openText: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
})
