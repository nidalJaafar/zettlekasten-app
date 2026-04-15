import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { getNoteById, type Note } from '@zettelkasten/core'
import { useAppStore } from '../../src/store'
import { BG, TEXT, FONT, BORDER, typeColor, glassStyle } from '../../src/theme'
import MarkdownInput from '../../src/components/MarkdownInput'

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const db = useAppStore((s) => s.db)
  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !id) return
    getNoteById(db, id).then((n) => {
      setNote(n ?? null)
      setLoading(false)
    })
  }, [db, id])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={TEXT.primary} />
      </View>
    )
  }

  if (!note) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundTitle}>Note not found</Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [glassStyle.pill, styles.backBtn, pressed && styles.pressed]}
        >
          <Text style={styles.backText}>Go back</Text>
        </Pressable>
      </View>
    )
  }

  const color = typeColor(note.type)

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={[styles.typeBadge, { borderColor: color }]}>
          <Text style={[styles.typeText, { color }]}>{note.type}</Text>
        </View>
      </View>
      <Text style={styles.title}>{note.title || 'Untitled'}</Text>
      <View style={glassStyle.card}>
        <View style={styles.markdownWrap}>
          <MarkdownInput
            value={note.content}
            onChange={() => {}}
            placeholder="No content"
          />
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG.base,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 60,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG.base,
  },
  notFoundTitle: {
    color: TEXT.primary,
    fontFamily: FONT.display,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  backText: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 14,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.7,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  typeBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  typeText: {
    fontFamily: FONT.mono,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  title: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  markdownWrap: {
    padding: 14,
  },
})
