import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView, type DecorationSet, type ViewUpdate, ViewPlugin, Decoration } from '@codemirror/view'
import { RangeSetBuilder, Extension } from '@codemirror/state'
import { getWikilinkTarget, getWikilinkText } from '../lib/wikilinks'

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
  readOnly?: boolean
  onLinkClick?: (linkText: string) => void
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

export default function MarkdownEditor({ value, onChange, placeholder, minHeight = '120px', readOnly = false, onLinkClick }: Props) {
  const extensions = useMemo(() => {
    const exts: Extension[] = [markdown(), EditorView.lineWrapping]
    if (onLinkClick) {
      exts.push(wikilinkPlugin(onLinkClick))
    }
    return exts
  }, [onLinkClick])

  return (
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
  )
}
