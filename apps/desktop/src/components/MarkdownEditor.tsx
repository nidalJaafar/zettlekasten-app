import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { BORDER } from '../theme'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
}

export default function MarkdownEditor({ value, onChange, placeholder, minHeight = '120px' }: Props) {
  return (
    <div style={{
      border: `1px solid ${BORDER.base}`,
      borderRadius: 5,
      overflow: 'hidden',
    }}>
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={[markdown()]}
        placeholder={placeholder}
        theme="dark"
        style={{ minHeight, fontSize: 13 }}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
        }}
      />
    </div>
  )
}
