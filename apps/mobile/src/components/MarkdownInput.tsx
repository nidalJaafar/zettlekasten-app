import { useState, useCallback, useRef, useEffect } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { getActiveWikilinkQuery, insertWikilinkSelection } from '@zettelkasten/core'
import { BG, TEXT, FONT, BORDER, ACCENT, glassStyle } from '../theme'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  wikilinkOptions?: { id: string; title: string }[]
  onCreateWikilinkNote?: (title: string) => Promise<{ id: string; title: string }>
}

export default function MarkdownInput({ value, onChange, placeholder, wikilinkOptions, onCreateWikilinkNote }: Props) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [autocompleteItems, setAutocompleteItems] = useState<{ id: string; title: string }[]>([])
  const activeQueryRef = useRef<ReturnType<typeof getActiveWikilinkQuery> | null>(null)
  const cursorRef = useRef(0)

  const handleSelectionChange = useCallback(
    (e: { nativeEvent: { selection: { start: number; end: number } } }) => {
      cursorRef.current = e.nativeEvent.selection.start
    },
    []
  )

  useEffect(() => {
    if (mode === 'preview') {
      setAutocompleteItems([])
      return
    }
    const query = getActiveWikilinkQuery(value, cursorRef.current)
    activeQueryRef.current = query
    if (!query || !wikilinkOptions) {
      setAutocompleteItems([])
      return
    }
    const q = query.query.toLowerCase()
    const filtered = q
      ? wikilinkOptions.filter((o) => o.title.toLowerCase().includes(q))
      : wikilinkOptions
    setAutocompleteItems(filtered.slice(0, 8))
  }, [value, wikilinkOptions, mode])

  const handleAutocompleteSelect = useCallback(
    (title: string) => {
      if (!activeQueryRef.current) return
      const result = insertWikilinkSelection(value, activeQueryRef.current, title)
      onChange(result.value)
      cursorRef.current = result.cursor
      setAutocompleteItems([])
      activeQueryRef.current = null
    },
    [value, onChange]
  )

  const handleCreateWikilink = useCallback(async () => {
    if (!onCreateWikilinkNote || !activeQueryRef.current) return
    const title = activeQueryRef.current.query.trim()
    if (!title) return
    const note = await onCreateWikilinkNote(title)
    handleAutocompleteSelect(note.title)
  }, [onCreateWikilinkNote, handleAutocompleteSelect])

  const insertFormatting = useCallback((before: string, after: string) => {
    const pos = cursorRef.current
    const beforeText = value.slice(0, pos)
    const afterText = value.slice(pos)
    const newValue = beforeText + before + after + afterText
    onChange(newValue)
    cursorRef.current = pos + before.length
  }, [value, onChange])

  const renderPreviewLine = useCallback(
    (line: string, idx: number) => {
      const parts: React.ReactNode[] = []
      const regex = /\[\[([^\]\|]+)(?:\|[^\]]*)?\]\]/g
      let last = 0
      let m: RegExpExecArray | null
      while ((m = regex.exec(line)) !== null) {
        if (m.index > last) {
          parts.push(renderFormattedText(line.slice(last, m.index), `${idx}-${last}`))
        }
        parts.push(
          <Text key={`${idx}-${m.index}`} style={styles.wikilink}>
            {m[1]}
          </Text>
        )
        last = regex.lastIndex
      }
      if (last < line.length) {
        parts.push(renderFormattedText(line.slice(last), `${idx}-end`))
      }
      return (
        <Text key={idx} style={styles.previewLine}>
          {parts.length > 0 ? parts : '\n'}
        </Text>
      )
    },
    []
  )

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        {mode === 'edit' && (
          <>
            <Pressable onPress={() => insertFormatting('**', '**')} style={styles.fmtBtn}>
              <Text style={styles.fmtText}>B</Text>
            </Pressable>
            <Pressable onPress={() => insertFormatting('*', '*')} style={styles.fmtBtn}>
              <Text style={styles.fmtText}>I</Text>
            </Pressable>
            <Pressable onPress={() => insertFormatting('\n# ', '')} style={styles.fmtBtn}>
              <Text style={styles.fmtText}>H</Text>
            </Pressable>
            <Pressable onPress={() => insertFormatting('[[', ']]')} style={styles.fmtBtn}>
              <Text style={styles.fmtText}>[[]]</Text>
            </Pressable>
          </>
        )}
        <Pressable
          onPress={() => setMode(mode === 'edit' ? 'preview' : 'edit')}
          style={({ pressed }) => [glassStyle.pill, styles.toggleBtn, pressed && styles.pressed]}
        >
          <Text style={styles.toggleText}>{mode === 'edit' ? 'Preview' : 'Edit'}</Text>
        </Pressable>
      </View>

      {mode === 'edit' ? (
        <View style={styles.editorContainer}>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChange}
            onSelectionChange={handleSelectionChange}
            placeholder={placeholder}
            placeholderTextColor={TEXT.muted}
            multiline
            textAlignVertical="top"
            autoCapitalize="sentences"
          />
          {autocompleteItems.length > 0 && (
            <View style={styles.autocompleteContainer}>
              {autocompleteItems.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => handleAutocompleteSelect(item.title)}
                  style={({ pressed }) => [styles.autocompleteItem, pressed && styles.pressed]}
                >
                  <Text style={styles.autocompleteText}>{item.title}</Text>
                </Pressable>
              ))}
              {activeQueryRef.current?.query.trim() && onCreateWikilinkNote ? (
                <Pressable
                  onPress={handleCreateWikilink}
                  style={({ pressed }) => [styles.autocompleteItem, pressed && styles.pressed]}
                >
                  <Text style={[styles.autocompleteText, { color: ACCENT.ink }]}>
                    Create "{activeQueryRef.current.query.trim()}"
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.previewContainer}>
          {value.split('\n').map((line, i) => renderPreviewLine(line, i))}
          {!value && <Text style={styles.emptyPreview}>{placeholder || 'No content'}</Text>}
        </View>
      )}
    </View>
  )
}

function renderFormattedText(text: string, keyPrefix: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(__(.+?)__)|(_(.+?)_)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(<Text key={`${keyPrefix}-${last}`}>{text.slice(last, m.index)}</Text>)
    }
    const bold = m[2] || m[6]
    const italic = m[4] || m[8]
    if (bold) {
      parts.push(
        <Text key={`${keyPrefix}-${m.index}`} style={{ fontWeight: '700' }}>
          {bold}
        </Text>
      )
    } else if (italic) {
      parts.push(
        <Text key={`${keyPrefix}-${m.index}`} style={{ fontStyle: 'italic' }}>
          {italic}
        </Text>
      )
    }
    last = regex.lastIndex
  }
  if (last < text.length) {
    parts.push(<Text key={`${keyPrefix}-end`}>{text.slice(last)}</Text>)
  }
  return parts.length === 1 ? parts[0] : <Text>{parts}</Text>
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  toggleBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  toggleText: {
    color: TEXT.secondary,
    fontFamily: FONT.ui,
    fontSize: 12,
    fontWeight: '500',
  },
  fmtBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  fmtText: {
    color: TEXT.secondary,
    fontFamily: FONT.mono,
    fontSize: 13,
    fontWeight: '600',
  },
  editorContainer: {
    flex: 1,
    position: 'relative',
  },
  input: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
    minHeight: 120,
    padding: 0,
    textAlignVertical: 'top',
  },
  autocompleteContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BG.raised,
    borderWidth: 1,
    borderColor: BORDER.base,
    borderRadius: 10,
    maxHeight: 180,
    zIndex: 10,
  },
  autocompleteItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER.faint,
  },
  autocompleteText: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 13,
  },
  previewContainer: {
    flex: 1,
    minHeight: 120,
  },
  previewLine: {
    color: TEXT.primary,
    fontFamily: FONT.ui,
    fontSize: 14,
    lineHeight: 20,
  },
  wikilink: {
    color: ACCENT.ink,
    fontWeight: '600',
  },
  emptyPreview: {
    color: TEXT.muted,
    fontFamily: FONT.ui,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.7,
  },
})
