import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DocumentPane from './DocumentPane'

const codeMirrorSpy = vi.fn<[unknown], void>()

vi.mock('../MarkdownEditor', () => ({
  default: (props: unknown) => {
    codeMirrorSpy(props)
    return <div data-testid="markdown-editor">MarkdownEditor</div>
  },
}))

describe('DocumentPane', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    codeMirrorSpy.mockClear()
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('renders in code view by default', async () => {
    await act(async () => {
      root.render(
        <DocumentPane
          title="Test Note"
          content="# Hello World"
          saveState="saved"
          placeholderTitle="Title"
          placeholderBody="Body"
          onTitleChange={vi.fn()}
          onContentChange={vi.fn()}
        />
      )
    })

    expect(codeMirrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        value: "# Hello World",
        readOnly: false,
      })
    )
    expect(container.textContent).toContain('Mode: Editor')
  })

  it('opens existing notes in preview mode by default', async () => {
    await act(async () => {
      root.render(
        <DocumentPane
          title="Test Note"
          content="Preview body"
          saveState="saved"
          placeholderTitle="Title"
          placeholderBody="Body"
          onTitleChange={vi.fn()}
          onContentChange={vi.fn()}
          defaultMode="preview"
        />
      )
    })

    expect(container.querySelector('.rendered-markdown')).toBeTruthy()
    expect(container.textContent).toContain('Mode: Preview')
  })

  it('shows editor chrome in code view', async () => {
    await act(async () => {
      root.render(
        <DocumentPane
          title="Test Note"
          content="Body"
          saveState="saved"
          placeholderTitle="Title"
          placeholderBody="Body"
          onTitleChange={vi.fn()}
          onContentChange={vi.fn()}
          defaultMode="code"
        />
      )
    })

    expect(container.textContent).toContain('Markdown')
    expect(container.querySelector('[data-testid="editor-chrome"]')).toBeTruthy()
  })

  it('toggles to rendered view when button clicked', async () => {
    await act(async () => {
      root.render(
        <DocumentPane
          title="Test Note"
          content="# Hello World"
          saveState="saved"
          placeholderTitle="Title"
          placeholderBody="Body"
          onTitleChange={vi.fn()}
          onContentChange={vi.fn()}
        />
      )
    })

    // Click the toggle button
    const toggleButton = container.querySelector('button')
    expect(toggleButton).toBeTruthy()
    await act(async () => {
      toggleButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Should now show rendered content
    expect(container.textContent).toContain('Hello World')
    expect(container.textContent).toContain('Mode: Preview')
  })

  it('maintains read-only state in both views', async () => {
    await act(async () => {
      root.render(
        <DocumentPane
          title="Test Note"
          content="# Hello World"
          saveState="saved"
          readOnly
          placeholderTitle="Title"
          placeholderBody="Body"
          onTitleChange={vi.fn()}
          onContentChange={vi.fn()}
        />
      )
    })

    // In code view, editor should be read-only
    expect(codeMirrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        readOnly: true,
      })
    )

    // Toggle to rendered view
    const toggleButton = container.querySelector('button')
    await act(async () => {
      toggleButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Title input should still be read-only
    const titleInput = container.querySelector('input')
    expect(titleInput?.hasAttribute('readonly')).toBe(true)
  })

  it('renders wikilinks as ctrl-clickable preview links', async () => {
    const onLinkClick = vi.fn()

    await act(async () => {
      root.render(
        <DocumentPane
          title="Test Note"
          content="See [[Alpha Note]] next"
          saveState="saved"
          placeholderTitle="Title"
          placeholderBody="Body"
          onTitleChange={vi.fn()}
          onContentChange={vi.fn()}
          onLinkClick={onLinkClick}
        />
      )
    })

    const toggleButton = container.querySelector('button')
    await act(async () => {
      toggleButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const renderedLink = container.querySelector('[data-wikilink="Alpha Note"]') as HTMLElement | null
    expect(renderedLink).toBeTruthy()

    await act(async () => {
      renderedLink?.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }))
    })

    expect(onLinkClick).toHaveBeenCalledWith('Alpha Note')
  })

  it('renders wikilinks as cmd-clickable preview links', async () => {
    const onLinkClick = vi.fn()

    await act(async () => {
      root.render(
        <DocumentPane
          title="Test Note"
          content="See [[Alpha Note]] next"
          saveState="saved"
          placeholderTitle="Title"
          placeholderBody="Body"
          onTitleChange={vi.fn()}
          onContentChange={vi.fn()}
          onLinkClick={onLinkClick}
          defaultMode="preview"
        />
      )
    })

    const renderedLink = container.querySelector('[data-wikilink="Alpha Note"]') as HTMLElement | null
    expect(renderedLink).toBeTruthy()

    await act(async () => {
      renderedLink?.dispatchEvent(new MouseEvent('click', { bubbles: true, metaKey: true }))
    })

    expect(onLinkClick).toHaveBeenCalledWith('Alpha Note')
  })

  it('renders preview text using the UI font instead of the code font', async () => {
    await act(async () => {
      root.render(
        <DocumentPane
          title="Test Note"
          content="Preview body"
          saveState="saved"
          placeholderTitle="Title"
          placeholderBody="Body"
          onTitleChange={vi.fn()}
          onContentChange={vi.fn()}
        />
      )
    })

    const toggleButton = container.querySelector('button')
    await act(async () => {
      toggleButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const preview = container.querySelector('.rendered-markdown') as HTMLElement | null
    expect(preview).toBeTruthy()
    expect(preview?.style.fontFamily).toContain('Poppins')
    expect(preview?.style.fontFamily).not.toContain('Fira Code')
  })
})
