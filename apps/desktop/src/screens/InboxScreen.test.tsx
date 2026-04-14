import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Note } from '@zettelkasten/core'
import InboxScreen from './InboxScreen'

vi.mock('@zettelkasten/core', () => ({
  getNotesByType: vi.fn(),
  createNote: vi.fn(),
}))

import { createNote, getNotesByType } from '@zettelkasten/core'

function createFakeDb() {
  return {
    execute: vi.fn(async () => {}),
    query: vi.fn(async () => []),
    queryOne: vi.fn(async () => null),
  }
}

async function flushEffects() {
  await Promise.resolve()
  await Promise.resolve()
}

const mockNote: Note = {
  id: 'note-42',
  title: 'A fleeting thought',
  content: 'some content',
  type: 'fleeting',
  created_at: Date.now(),
  updated_at: Date.now(),
  source_id: null,
  own_words_confirmed: 0,
  processed_at: null,
  deleted_at: null,
}

const secondMockNote: Note = {
  id: 'note-43',
  title: 'Saved with body',
  content: 'Freshly captured body',
  type: 'fleeting',
  created_at: Date.now() + 1,
  updated_at: Date.now() + 1,
  source_id: null,
  own_words_confirmed: 0,
  processed_at: null,
  deleted_at: null,
}

describe('InboxScreen', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    vi.mocked(getNotesByType).mockResolvedValue([mockNote])
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
      await flushEffects()
    })
    container.remove()
    vi.clearAllMocks()
  })

  async function renderScreen() {
    await act(async () => {
      root.render(
        <InboxScreen db={createFakeDb() as any} onCountChange={() => {}} />
      )
      await flushEffects()
    })
  }

  function getTitleInput() {
    return container.querySelector('input[placeholder="Write a fleeting thought…"]') as HTMLInputElement
  }

  function getBodyInput() {
    return container.querySelector('textarea[placeholder="Add a little more context…"]') as HTMLTextAreaElement | null
  }

  function getCaptureButton() {
    return Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Capture'
    ) as HTMLButtonElement | undefined
  }

  function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const prototype = element instanceof window.HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
    setter?.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }

  function dispatchKeyDown(
    element: HTMLInputElement | HTMLTextAreaElement,
    init: KeyboardEventInit,
    overrides: Record<string, unknown> = {}
  ) {
    const event = new KeyboardEvent('keydown', { bubbles: true, ...init })
    for (const [key, value] of Object.entries(overrides)) {
      Object.defineProperty(event, key, { value })
    }
    element.dispatchEvent(event)
  }

  it('dispatches zettel:open-note when a note card title/content area is clicked', async () => {
    const listener = vi.fn()
    window.addEventListener('zettel:open-note', listener)

    await renderScreen()

    const clickableArea = container.querySelector('[data-testid="note-open"]') as HTMLElement
    expect(clickableArea).toBeTruthy()

    await act(async () => {
      clickableArea.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushEffects()
    })

    expect(listener).toHaveBeenCalledTimes(1)
    const detail = (listener.mock.calls[0][0] as CustomEvent<Note>).detail
    expect(detail.id).toBe('note-42')

    window.removeEventListener('zettel:open-note', listener)
  })

  it('dispatches zettel:review when the process button is clicked', async () => {
    const listener = vi.fn()
    window.addEventListener('zettel:review', listener)

    await renderScreen()

    const processBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Process')
    )
    expect(processBtn).toBeTruthy()

    await act(async () => {
      processBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushEffects()
    })

    expect(listener).toHaveBeenCalledTimes(1)
    const detail = (listener.mock.calls[0][0] as CustomEvent<Note>).detail
    expect(detail.id).toBe('note-42')

    window.removeEventListener('zettel:review', listener)
  })

  it('still captures a fleeting note from the title field only', async () => {
    vi.mocked(createNote).mockResolvedValue(mockNote)

    await renderScreen()

    const titleInput = getTitleInput()

    await act(async () => {
      setInputValue(titleInput, 'Just a title')
      await flushEffects()
    })

    const captureButton = getCaptureButton()
    expect(captureButton).toBeTruthy()

    await act(async () => {
      captureButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushEffects()
    })

    expect(createNote).toHaveBeenCalledWith(expect.anything(), {
      type: 'fleeting',
      title: 'Just a title',
    })
    expect(titleInput.value).toBe('')
  })

  it('captures both title and body when the body exists', async () => {
    vi.mocked(createNote).mockResolvedValue(mockNote)

    await renderScreen()

    const titleInput = getTitleInput()

    await act(async () => {
      setInputValue(titleInput, 'Title with body')
      titleInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await flushEffects()
    })

    const bodyInput = getBodyInput()
    expect(bodyInput).toBeTruthy()

    await act(async () => {
      setInputValue(bodyInput!, 'Extra context')
      await flushEffects()
    })

    await act(async () => {
      bodyInput!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }))
      await flushEffects()
    })

    expect(createNote).toHaveBeenCalledWith(expect.anything(), {
      type: 'fleeting',
      title: 'Title with body',
      content: 'Extra context',
    })
  })

  it('does not move from title to body while IME composition is active', async () => {
    await renderScreen()

    const titleInput = getTitleInput()

    await act(async () => {
      titleInput.focus()
      setInputValue(titleInput, 'Composing title')
      dispatchKeyDown(titleInput, { key: 'Enter' }, { isComposing: true })
      await flushEffects()
    })

    expect(getBodyInput()).toBeTruthy()
    expect(document.activeElement).toBe(titleInput)
  })

  it('does not move from title to body on IME confirmation events reported with keyCode 229', async () => {
    await renderScreen()

    const titleInput = getTitleInput()

    await act(async () => {
      titleInput.focus()
      setInputValue(titleInput, 'IME keycode title')
      dispatchKeyDown(titleInput, { key: 'Enter' }, { keyCode: 229 })
      await flushEffects()
    })

    expect(getBodyInput()).toBeTruthy()
    expect(document.activeElement).toBe(titleInput)
  })

  it('moves focus from title to body on a plain Enter keydown', async () => {
    await renderScreen()

    const titleInput = getTitleInput()

    await act(async () => {
      titleInput.focus()
      setInputValue(titleInput, 'Plain enter title')
      dispatchKeyDown(titleInput, { key: 'Enter' })
      await flushEffects()
    })

    const bodyInput = getBodyInput()
    expect(bodyInput).toBeTruthy()
    expect(document.activeElement).toBe(bodyInput)
  })

  it('captures from the body field with ctrl+enter', async () => {
    vi.mocked(createNote).mockResolvedValue(mockNote)

    await renderScreen()

    const titleInput = getTitleInput()

    await act(async () => {
      setInputValue(titleInput, 'Ctrl enter note')
      titleInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await flushEffects()
    })

    const bodyInput = getBodyInput()
    expect(bodyInput).toBeTruthy()

    await act(async () => {
      setInputValue(bodyInput!, 'Saved with ctrl enter')
      await flushEffects()
    })

    await act(async () => {
      bodyInput!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }))
      await flushEffects()
    })

    expect(createNote).toHaveBeenCalledWith(expect.anything(), {
      type: 'fleeting',
      title: 'Ctrl enter note',
      content: 'Saved with ctrl enter',
    })
  })

  it('does nothing when capture is empty', async () => {
    vi.mocked(createNote).mockResolvedValue(mockNote)

    await renderScreen()

    const captureButton = getCaptureButton()
    expect(captureButton).toBeTruthy()

    await act(async () => {
      captureButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushEffects()
    })

    expect(createNote).not.toHaveBeenCalled()
  })

  it('reloads notes and clears capture fields after saving a note with body', async () => {
    vi.mocked(createNote).mockResolvedValue(secondMockNote)
    vi.mocked(getNotesByType)
      .mockResolvedValueOnce([mockNote])
      .mockResolvedValueOnce([mockNote, secondMockNote])

    await renderScreen()

    const titleInput = getTitleInput()

    await act(async () => {
      setInputValue(titleInput, 'Saved with body')
      titleInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await flushEffects()
    })

    const bodyInput = getBodyInput()
    expect(bodyInput).toBeTruthy()

    await act(async () => {
      setInputValue(bodyInput!, 'Freshly captured body')
      bodyInput!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }))
      await flushEffects()
    })

    expect(getNotesByType).toHaveBeenCalledTimes(2)
    expect(titleInput.value).toBe('')
    expect(getBodyInput()).toBeNull()
    expect(container.textContent).toContain('2 fleeting notes waiting.')
    expect(container.textContent).toContain('Saved with body')
  })
})
