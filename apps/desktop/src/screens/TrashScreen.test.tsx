import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database, Note } from '@zettelkasten/core'
import { permanentlyDeleteNote, restoreNote } from '@zettelkasten/core'
import TrashScreen from './TrashScreen'

vi.mock('@zettelkasten/core', () => ({
  restoreNote: vi.fn(),
  permanentlyDeleteNote: vi.fn(),
}))

const trashedNotes: Note[] = [
  {
    id: 'note-2',
    title: 'Recent deletion',
    content: '',
    type: 'literature',
    created_at: 1,
    updated_at: 2,
    source_id: null,
    own_words_confirmed: 0,
    processed_at: null,
    deleted_at: 200,
  },
  {
    id: 'note-1',
    title: 'Older deletion',
    content: 'Recovered context lives here.',
    type: 'fleeting',
    created_at: 1,
    updated_at: 2,
    source_id: null,
    own_words_confirmed: 0,
    processed_at: null,
    deleted_at: 100,
  },
]

function createFakeDb(): Database {
  return {
    execute: vi.fn(async () => {}),
    query: vi.fn(async () => trashedNotes),
    queryOne: vi.fn(async () => null),
  }
}

async function flushEffects() {
  await Promise.resolve()
  await Promise.resolve()
}

function getButton(container: HTMLDivElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent === label)
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Missing button: ${label}`)
  }
  return button
}

describe('TrashScreen', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.mocked(restoreNote).mockResolvedValue(undefined)
    vi.mocked(permanentlyDeleteNote).mockResolvedValue(undefined)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
      await flushEffects()
    })
    container.remove()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('loads deleted notes ordered by deletion time and shows readable fallbacks', async () => {
    const db = createFakeDb()

    await act(async () => {
      root.render(<TrashScreen db={db} />)
      await flushEffects()
    })

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('deleted_at IS NOT NULL'))
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY deleted_at DESC'))
    expect(container.textContent).toContain('Recent deletion')
    expect(container.textContent).toContain('No preview available.')
    expect(container.textContent).toContain('Older deletion')
    expect(container.textContent).toContain('Recovered context lives here.')
  })

  it('restores a deleted note and reloads the trash list', async () => {
    const db = createFakeDb()

    await act(async () => {
      root.render(<TrashScreen db={db} />)
      await flushEffects()
    })

    await act(async () => {
      getButton(container, 'Restore').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushEffects()
    })

    expect(restoreNote).toHaveBeenCalledWith(db, 'note-2')
    expect(db.query).toHaveBeenCalledTimes(2)
  })

  it('confirms before permanently deleting a note and reloads after success', async () => {
    const db = createFakeDb()
    const confirmSpy = vi.fn(() => true)
    vi.stubGlobal('confirm', confirmSpy)

    await act(async () => {
      root.render(<TrashScreen db={db} />)
      await flushEffects()
    })

    await act(async () => {
      getButton(container, 'Delete Permanently').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushEffects()
    })

    expect(confirmSpy).toHaveBeenCalled()
    expect(permanentlyDeleteNote).toHaveBeenCalledWith(db, 'note-2')
    expect(db.query).toHaveBeenCalledTimes(2)
  })

  it('does not permanently delete when confirmation is cancelled', async () => {
    const db = createFakeDb()
    vi.stubGlobal('confirm', vi.fn(() => false))

    await act(async () => {
      root.render(<TrashScreen db={db} />)
      await flushEffects()
    })

    await act(async () => {
      getButton(container, 'Delete Permanently').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushEffects()
    })

    expect(permanentlyDeleteNote).not.toHaveBeenCalled()
    expect(db.query).toHaveBeenCalledTimes(1)
  })
})
