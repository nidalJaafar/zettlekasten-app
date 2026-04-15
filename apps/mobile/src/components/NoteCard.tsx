import { Pressable, Text, View, StyleSheet } from 'react-native'
import type { Note } from '@zettelkasten/core'
import { BG, TEXT, FONT, BORDER, typeColor, glassStyle } from '../theme'

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

function firstLine(content: string): string {
  const line = content.split('\n')[0] ?? ''
  return line.length > 80 ? line.slice(0, 80) + '...' : line
}

interface NoteCardProps {
  note: Note
  onPress: (note: Note) => void
  onProcess?: (note: Note) => void
}

export default function NoteCard({ note, onPress, onProcess }: NoteCardProps) {
  const color = typeColor(note.type)

  return (
    <Pressable
      onPress={() => onPress(note)}
      style={({ pressed }) => [
        glassStyle.card,
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.typeBadge, { borderColor: color }]}>
          <Text style={[styles.typeText, { color }]}>{note.type}</Text>
        </View>
        <Text style={styles.time}>{relativeTime(note.created_at)}</Text>
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {note.title || 'Untitled'}
      </Text>
      {!!note.content && (
        <Text style={styles.preview} numberOfLines={1}>
          {firstLine(note.content)}
        </Text>
      )}
      {onProcess && (
        <Pressable
          onPress={() => onProcess(note)}
          style={({ pressed }) => [
            styles.processBtn,
            pressed && styles.processBtnPressed,
          ]}
        >
          <Text style={styles.processText}>Process</Text>
        </Pressable>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    marginBottom: 10,
  },
  cardPressed: {
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
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
    textTransform: 'uppercase' as const,
  },
  time: {
    color: TEXT.muted,
    fontFamily: FONT.ui,
    fontSize: 11,
  },
  title: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  preview: {
    color: TEXT.secondary,
    fontFamily: FONT.ui,
    fontSize: 13,
  },
  processBtn: {
    marginTop: 10,
    alignSelf: 'flex-end',
    backgroundColor: BG.hover,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: BORDER.base,
  },
  processBtnPressed: {
    opacity: 0.7,
  },
  processText: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 13,
    fontWeight: '500' as const,
  },
})
