import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Note } from '@zettelkasten/core'
import { getNotesByType } from '@zettelkasten/core'
import ReviewScreen from './ReviewScreen'
import { FONT } from '../theme'

vi.mock('@zettelkasten/core', () => ({
  getNotesByType: vi.fn(),
}))

const mockNote: Note = {
  id: 'note-1',
  title: 'Unreadable title',
  content: 'body',
  type: 'fleeting',
  created_at: Date.now(),
  updated_at: Date.now(),
  source_id: null,
  own_words_confirmed: 0,
  processed_at: null,
  deleted_at: null,
}

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

describe('ReviewScreen', () => {
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

  it('uses the UI font for review queue note titles', async () => {
    await act(async () => {
      root.render(
        <ReviewScreen db={createFakeDb() as any} onOpenNoteId={vi.fn(async () => {})} />
      )
      await flushEffects()
    })

    const title = Array.from(container.querySelectorAll('span')).find(
      (element) => element.textContent === 'Unreadable title'
    ) as HTMLElement | undefined

    expect(title).toBeTruthy()
    expect(title?.style.fontFamily).toContain('Poppins')
    expect(title?.style.fontFamily).not.toBe(FONT.display)
  })
})
