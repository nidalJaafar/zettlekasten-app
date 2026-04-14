import MarkdownEditor from '../MarkdownEditor'
import { BG, BORDER, FONT, TEXT } from '../../theme'
import SaveStatus, { type SaveState } from './SaveStatus'
import { useLayoutEffect, useRef, useState } from 'react'
import { getWikilinkTarget, renderMarkdownPreview } from '../../lib/wikilinks'

interface Props {
  title: string
  content: string
  saveState: SaveState
  defaultMode?: 'preview' | 'code'
  readOnly?: boolean
  placeholderTitle: string
  placeholderBody: string
  onTitleChange: (value: string) => void
  onContentChange: (value: string) => void
  onLinkClick?: (linkText: string) => void
}

export default function DocumentPane({
  title,
  content,
  saveState,
  defaultMode = 'code',
  readOnly = false,
  placeholderTitle,
  placeholderBody,
  onTitleChange,
  onContentChange,
  onLinkClick,
}: Props) {
  const [isRenderedView, setIsRenderedView] = useState(defaultMode === 'preview')
  const titleRef = useRef<HTMLTextAreaElement | null>(null)

  function resizeTitle() {
    const element = titleRef.current
    if (!element) {
      return
    }

    element.style.height = '0px'
    element.style.height = `${element.scrollHeight}px`
  }

  useLayoutEffect(() => {
    resizeTitle()
  }, [title])

  useLayoutEffect(() => {
    const element = titleRef.current
    if (!element || typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => {
      resizeTitle()
    })

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [])

  function handlePreviewClick(event: React.MouseEvent<HTMLDivElement>) {
    if ((!event.ctrlKey && !event.metaKey) || !onLinkClick) {
      return
    }

    const linkText = getWikilinkTarget(event.target)
    if (!linkText) {
      return
    }

    event.preventDefault()
    onLinkClick(linkText)
  }

  function handleTitleChange(value: string) {
    onTitleChange(value.replace(/\r?\n/g, ' '))
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
    }}>
      <div style={{
        flex: '1 1 0%',
        overflow: 'auto',
        padding: '24px 32px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{
              color: TEXT.faint,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily: FONT.ui,
            }}>
              Mode: {isRenderedView ? 'Preview' : 'Editor'}
            </span>
            <button
              onClick={() => setIsRenderedView(!isRenderedView)}
              style={{
                border: 'none',
                background: 'transparent',
                color: TEXT.secondary,
                cursor: 'pointer',
                fontSize: 14,
                padding: '4px 8px',
                borderRadius: 4,
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {isRenderedView ? 'Code View' : 'Preview'}
            </button>
          </div>
          <div style={{ marginBottom: 4 }}>
            <SaveStatus state={saveState} />
          </div>
          <textarea
            ref={titleRef}
            value={title}
            onChange={(event) => handleTitleChange(event.currentTarget.value)}
            readOnly={readOnly}
            placeholder={placeholderTitle}
            rows={1}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: TEXT.primary,
              fontFamily: FONT.display,
              fontSize: 26,
              fontWeight: 500,
              lineHeight: 1.2,
              width: '100%',
              padding: '8px 0 12px',
              resize: 'none',
              overflowY: 'hidden',
              overflowX: 'hidden',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'break-word',
            }}
          />
          {isRenderedView ? (
            <div
              className="rendered-markdown"
              onClick={handlePreviewClick}
              dangerouslySetInnerHTML={{
                __html: renderMarkdownPreview(content),
              }}
              style={{
                minHeight: '60vh',
                padding: '16px',
                lineHeight: 1.6,
                color: TEXT.primary,
                fontFamily: FONT.ui,
              }}
            />
          ) : (
            <div style={{
              border: `1px solid ${BORDER.base}`,
              borderRadius: 12,
              overflow: 'hidden',
              background: BG.panel,
              boxShadow: '0 18px 40px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.02)',
            }}>
              <div
                data-testid="editor-chrome"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderBottom: `1px solid ${BORDER.faint}`,
                  background: BG.raised,
                }}
              >
                <span style={{
                  fontFamily: FONT.ui,
                  fontSize: 11,
                  color: TEXT.faint,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  Markdown
                </span>
                <span style={{
                  fontFamily: FONT.ui,
                  fontSize: 11,
                  color: TEXT.secondary,
                }}>
                  Code View
                </span>
              </div>
              <MarkdownEditor
                value={content}
                onChange={(value) => {
                  if (!readOnly) {
                    onContentChange(value)
                  }
                }}
                readOnly={readOnly}
                placeholder={placeholderBody}
                minHeight="60vh"
                onLinkClick={onLinkClick}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
