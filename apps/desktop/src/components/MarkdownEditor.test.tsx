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

  it('shows line-number gutter for the editor surface', async () => {
    await act(async () => {
      root.render(
        <MarkdownEditor
          value={"# Title\nBody"}
          onChange={vi.fn()}
        />
      )
    })

    expect(container.querySelector('.cm-gutters')).toBeTruthy()
  })

  it('has the range client rects API available for CodeMirror in jsdom', () => {
    expect(typeof Range.prototype.getClientRects).toBe('function')
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

  it('opens wikilinks on cmd-click', async () => {
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
      wikilink?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, metaKey: true }))
    })

    expect(onLinkClick).toHaveBeenCalledWith('Alpha Note')
  })

  it('shows wikilink suggestions when value contains an open wikilink query', async () => {
    await act(async () => {
      root.render(
        <MarkdownEditor
          value="See [[Al"
          onChange={vi.fn()}
          wikilinkOptions={[{ id: '1', title: 'Alpha Note' }, { id: '2', title: 'Another Note' }]}
        />
      )
    })

    expect(container.textContent).toContain('Alpha Note')
    expect(container.textContent).not.toContain('Another Note')
  })

  it('does not show the picker when wikilinkOptions is not provided', async () => {
    await act(async () => {
      root.render(
        <MarkdownEditor
          value="See [[Al"
          onChange={vi.fn()}
        />
      )
    })

    expect(container.querySelector('.wikilink-picker')).toBeNull()
  })

  it('calls onCreateWikilinkNote and inserts wikilink when create-new is clicked', async () => {
    const onCreateWikilinkNote = vi.fn(async () => ({ id: 'new-1', title: 'Missing Note' }))
    const onChange = vi.fn()

    await act(async () => {
      root.render(
        <MarkdownEditor
          value="See [[Missing Note"
          onChange={onChange}
          wikilinkOptions={[]}
          onCreateWikilinkNote={onCreateWikilinkNote}
        />
      )
    })

    const createOption = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Create new fleeting note')
    )

    await act(async () => {
      createOption?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onCreateWikilinkNote).toHaveBeenCalledWith('Missing Note')
    expect(onChange).toHaveBeenCalledWith('See [[Missing Note]]')
  })

  it('inserts a selected existing note as a completed wikilink', async () => {
    const onChange = vi.fn()

    await act(async () => {
      root.render(
        <MarkdownEditor
          value="See [[Al"
          onChange={onChange}
          wikilinkOptions={[{ id: '1', title: 'Alpha Note' }]}
        />
      )
    })

    const option = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Alpha Note')
    )

    await act(async () => {
      option?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onChange).toHaveBeenCalledWith('See [[Alpha Note]]')
  })

  it('hides the picker when no open wikilink query exists', async () => {
    await act(async () => {
      root.render(
        <MarkdownEditor
          value="See [[Alpha Note]] done"
          onChange={vi.fn()}
          wikilinkOptions={[{ id: '1', title: 'Alpha Note' }]}
        />
      )
    })

    expect(container.querySelector('.wikilink-picker')).toBeNull()
  })

  it('refreshes picker position on window resize', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    await act(async () => {
      root.render(
        <MarkdownEditor
          value="See [[Al"
          onChange={vi.fn()}
          wikilinkOptions={[{ id: '1', title: 'Alpha Note' }]}
        />
      )
    })

    const resizeCalls = addSpy.mock.calls.filter(([event]) => event === 'resize')
    expect(resizeCalls.length).toBeGreaterThanOrEqual(1)

    await act(async () => {
      root.unmount()
    })

    const removeResizeCalls = removeSpy.mock.calls.filter(([event]) => event === 'resize')
    expect(removeResizeCalls.length).toBeGreaterThanOrEqual(1)

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
