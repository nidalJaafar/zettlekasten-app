import MarkdownEditor from '../MarkdownEditor'
import { BG, BORDER, FONT, TEXT } from '../../theme'
import SaveStatus, { type SaveState } from './SaveStatus'

interface Props {
  title: string
  content: string
  saveState: SaveState
  readOnly?: boolean
  placeholderTitle: string
  placeholderBody: string
  onTitleChange: (value: string) => void
  onContentChange: (value: string) => void
}

export default function DocumentPane({
  title,
  content,
  saveState,
  readOnly = false,
  placeholderTitle,
  placeholderBody,
  onTitleChange,
  onContentChange,
}: Props) {
  return (
    <section
      style={{
        padding: 28,
        minWidth: 0,
        overflow: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: 24,
          border: `1px solid ${BORDER.faint}`,
          borderRadius: 18,
          background: BG.panel,
        }}
      >
        <SaveStatus state={saveState} />
        <input
          value={title}
          onChange={(event) => onTitleChange(event.currentTarget.value)}
          readOnly={readOnly}
          placeholder={placeholderTitle}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: TEXT.primary,
            fontFamily: FONT.display,
            fontSize: 34,
            lineHeight: 1.2,
          }}
        />
        <MarkdownEditor
          value={content}
          onChange={(value) => {
            if (!readOnly) {
              onContentChange(value)
            }
          }}
          readOnly={readOnly}
          placeholder={placeholderBody}
          minHeight="62vh"
        />
      </div>
    </section>
  )
}
