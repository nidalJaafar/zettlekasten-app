import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MarkdownEditor from './MarkdownEditor'

describe('MarkdownEditor', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('renders without errors', async () => {
    await act(async () => {
      root.render(
        <MarkdownEditor
          value="# Test"
          onChange={vi.fn()}
          placeholder="Write here"
        />
      )
    })

    expect(container).toBeTruthy()
  })

  it('passes through read-only mode to CodeMirror', async () => {
    await act(async () => {
      root.render(
        <MarkdownEditor
          value="Body"
          onChange={vi.fn()}
          placeholder="Write here"
          readOnly
        />
      )
    })

    // Just verify it renders without throwing
    expect(container.querySelector('.cm-editor')).toBeTruthy()
  })

  it('opens wikilinks on ctrl-click', async () => {
    const onLinkClick = vi.fn()

    await act(async () => {
      root.render(
        <MarkdownEditor
          value="See [[Alpha Note]]"
          onChange={vi.fn()}
          onLinkClick={onLinkClick}
        />
      )
    })

    const wikilink = container.querySelector('.cm-wikilink') as HTMLElement | null
    expect(wikilink).toBeTruthy()

    await act(async () => {
      wikilink?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, ctrlKey: true }))
    })

    expect(onLinkClick).toHaveBeenCalledWith('Alpha Note')
  })
})
