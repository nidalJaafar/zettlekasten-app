import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { BG, BORDER } from '../theme'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
  readOnly?: boolean
}

export default function MarkdownEditor({ value, onChange, placeholder, minHeight = '120px', readOnly = false }: Props) {
  return (
    <div
      style={{
        border: `1px solid ${BORDER.faint}`,
        borderRadius: 14,
        overflow: 'hidden',
        background: BG.panel,
      }}
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        editable={!readOnly}
        readOnly={readOnly}
        extensions={[markdown()]}
        placeholder={placeholder}
        theme="dark"
        style={{ minHeight }}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
          highlightSelectionMatches: false,
        }}
      />
    </div>
  )
}
