import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView, type DecorationSet, type ViewUpdate, ViewPlugin, Decoration } from '@uiw/react-codemirror'
import { RangeSetBuilder, Extension } from '@codemirror/state'
import { getWikilinkTarget, getWikilinkText, getActiveWikilinkQuery, insertWikilinkSelection, type ActiveWikilinkQuery } from '../lib/wikilinks'
import { BG, BORDER, TEXT, FONT, ACCENT } from '../theme'

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g

export interface WikilinkOption {
  id: string
  title: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
  readOnly?: boolean
  onLinkClick?: (linkText: string) => void
  wikilinkOptions?: WikilinkOption[]
  onCreateWikilinkNote?: (title: string) => Promise<{ id: string; title: string }>
}

function wikilinkPlugin(onLinkClick: (text: string) => void) {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = this.build(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.build(update.view)
      }
    }

    build(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>()
      const doc = view.state.doc
      const text = doc.toString()

      let match: RegExpExecArray | null
      WIKILINK_RE.lastIndex = 0

      while ((match = WIKILINK_RE.exec(text)) !== null) {
        const from = match.index
        const to = match.index + match[0].length
        if (from > doc.length || to > doc.length) continue

        const linkText = getWikilinkText(match[1])
        const deco = Decoration.mark({
          class: 'cm-wikilink',
          attributes: {
            title: `Ctrl+click to open: ${linkText}`,
            'data-wikilink': linkText,
          },
        })
        builder.add(from, to, deco)
      }

      return builder.finish()
    }
  }, {
    decorations: (v) => v.decorations,
    eventHandlers: {
      mousedown(event) {
        if (!event.ctrlKey && !event.metaKey) return

        const linkText = getWikilinkTarget(event.target)
        if (!linkText) return

        event.preventDefault()
        onLinkClick(linkText)
      },
    },
  })
}

export default function MarkdownEditor({ value, onChange, placeholder, minHeight = '120px', readOnly = false, onLinkClick, wikilinkOptions, onCreateWikilinkNote }: Props) {
  const [activeQuery, setActiveQuery] = useState<ActiveWikilinkQuery | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [pickerPos, setPickerPos] = useState<{ left: number; top: number } | null>(null)
  const optionsRef = useRef(wikilinkOptions)
  optionsRef.current = wikilinkOptions
  const readOnlyRef = useRef(readOnly)
  readOnlyRef.current = readOnly
  const cursorPosRef = useRef(value.length)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const cursorTracker = useMemo(() => EditorView.updateListener.of((update) => {
    if (update.selectionSet) {
      cursorPosRef.current = update.view.state.selection.main.head
    }
    if (update.docChanged || update.selectionSet) {
      const text = update.view.state.doc.toString()
      const query = (optionsRef.current && !readOnlyRef.current)
        ? getActiveWikilinkQuery(text, cursorPosRef.current)
        : null
      setActiveQuery(query)
      if (update.docChanged) {
        setHighlightedIndex(0)
      }
      if (query) {
        const coords = update.view.coordsAtPos(query.from)
        if (coords) {
          setPickerPos({
            left: coords.left,
            top: coords.bottom,
          })
        }
      } else {
        setPickerPos(null)
      }
    }
  }), [])

  useEffect(() => {
    const query = (wikilinkOptions && !readOnly)
      ? getActiveWikilinkQuery(value, cursorPosRef.current)
      : null
    setActiveQuery(query)
  }, [value, wikilinkOptions, readOnly])

  const extensions = useMemo(() => {
    const exts: Extension[] = [markdown(), EditorView.lineWrapping, cursorTracker]
    if (onLinkClick) {
      exts.push(wikilinkPlugin(onLinkClick))
    }
    return exts
  }, [onLinkClick, cursorTracker])

  const filteredOptions = activeQuery && wikilinkOptions
    ? wikilinkOptions.filter((opt) =>
        opt.title.toLowerCase().includes(activeQuery.query.toLowerCase())
      )
    : []

  function handleOptionSelect(title: string) {
    if (!activeQuery) return
    const result = insertWikilinkSelection(value, activeQuery, title)
    onChange(result.value)
  }

  async function handleCreateOption(title: string) {
    if (!onCreateWikilinkNote || !activeQuery) return
    const created = await onCreateWikilinkNote(title)
    const result = insertWikilinkSelection(value, activeQuery, created.title)
    onChange(result.value)
  }

  const showPicker = activeQuery && (filteredOptions.length > 0 || (activeQuery.query.trim() !== '' && onCreateWikilinkNote))

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <CodeMirror
        value={value}
        onChange={onChange}
        editable={!readOnly}
        readOnly={readOnly}
        extensions={extensions}
        placeholder={placeholder}
        theme="dark"
        style={{ minHeight }}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
          highlightSelectionMatches: false,
        }}
      />
      {showPicker && (
        <div
          className="wikilink-picker"
          style={{
            position: 'fixed',
            left: pickerPos ? pickerPos.left : 0,
            top: pickerPos ? pickerPos.top : 0,
            minWidth: 200,
            maxWidth: 'calc(100% - 8px)',
            maxHeight: 180,
            overflowY: 'auto',
            background: BG.raised,
            border: `1px solid ${BORDER.base}`,
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 10,
            padding: 4,
          }}
        >
          {filteredOptions.map((option, index) => (
            <button
              key={option.id}
              onClick={() => handleOptionSelect(option.title)}
              onMouseEnter={() => setHighlightedIndex(index)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                border: 'none',
                background: index === highlightedIndex ? BG.hover : 'transparent',
                color: TEXT.primary,
                padding: '6px 10px',
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: FONT.ui,
                fontSize: 13,
              }}
            >
              {option.title}
            </button>
          ))}
          {activeQuery.query.trim() !== '' && onCreateWikilinkNote && (
            <button
              onClick={() => void handleCreateOption(activeQuery.query.trim())}
              onMouseEnter={() => setHighlightedIndex(filteredOptions.length)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                border: 'none',
                background: highlightedIndex === filteredOptions.length ? BG.hover : 'transparent',
                color: ACCENT.ink,
                padding: '6px 10px',
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: FONT.ui,
                fontSize: 13,
                borderTop: `1px solid ${BORDER.faint}`,
                marginTop: 2,
              }}
            >
              Create new fleeting note &ldquo;{activeQuery.query.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  )
}
