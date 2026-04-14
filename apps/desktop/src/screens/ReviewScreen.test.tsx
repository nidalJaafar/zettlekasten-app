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

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    ...mockNote,
    ...overrides,
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

  it('shows preview text under the title and keeps the workspace action visible', async () => {
    vi.mocked(getNotesByType).mockResolvedValue([
      makeNote({ content: 'A roomy preview for the review card.' }),
    ])

    await act(async () => {
      root.render(
        <ReviewScreen db={createFakeDb() as any} onOpenNoteId={vi.fn(async () => {})} />
      )
      await flushEffects()
    })

    expect(container.textContent).toContain('Unreadable title')
    expect(container.textContent).toContain('A roomy preview for the review card.')

    const button = Array.from(container.querySelectorAll('button')).find(
      (element) => element.textContent === 'Open in Workspace'
    )

    expect(button).toBeTruthy()
  })

  it('shows fallback preview text when note content is empty', async () => {
    vi.mocked(getNotesByType).mockResolvedValue([
      makeNote({ id: 'note-2', title: 'Empty note', content: '   ' }),
    ])

    await act(async () => {
      root.render(
        <ReviewScreen db={createFakeDb() as any} onOpenNoteId={vi.fn(async () => {})} />
      )
      await flushEffects()
    })

    expect(container.textContent).toContain('Empty note')
    expect(container.textContent).toContain('No content yet. Open this note to continue shaping it.')
  })

  it('includes unprocessed literature notes in the review queue', async () => {
    const db = createFakeDb()
    db.query.mockResolvedValue([
      makeNote({
        id: 'lit-1',
        title: 'Unprocessed literature',
        type: 'literature',
        processed_at: null,
      }),
    ])

    await act(async () => {
      root.render(
        <ReviewScreen db={db as any} onOpenNoteId={vi.fn(async () => {})} />
      )
      await flushEffects()
    })

    expect(container.textContent).toContain('Unprocessed literature')
  })

  it('excludes processed literature notes from the review queue', async () => {
    const db = createFakeDb()
    db.query.mockResolvedValue([])

    await act(async () => {
      root.render(
        <ReviewScreen db={db as any} onOpenNoteId={vi.fn(async () => {})} />
      )
      await flushEffects()
    })

    expect(container.textContent).not.toContain('Processed literature')
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("processed_at IS NULL")
    )
  })

  it('renders mixed fleeting and literature notes in chronological order', async () => {
    const db = createFakeDb()
    vi.mocked(getNotesByType).mockResolvedValue([
      makeNote({ id: 'fleeting-late', title: 'Later fleeting', created_at: 300 }),
      makeNote({ id: 'fleeting-early', title: 'Earlier fleeting', created_at: 100 }),
    ])
    db.query.mockResolvedValue([
      makeNote({
        id: 'literature-middle',
        title: 'Middle literature',
        type: 'literature',
        created_at: 200,
      }),
    ])

    await act(async () => {
      root.render(
        <ReviewScreen db={db as any} onOpenNoteId={vi.fn(async () => {})} />
      )
      await flushEffects()
    })

    const titles = Array.from(container.querySelectorAll('[data-testid="review-card-title"]')).map(
      (element) => element.textContent
    )

    expect(titles).toEqual(['Earlier fleeting', 'Middle literature', 'Later fleeting'])
  })

  it('renders each redesigned card with a compact type chip and primary action', async () => {
    const db = createFakeDb()
    db.query.mockResolvedValue([
      makeNote({ id: 'lit-2', title: 'Literature card', type: 'literature' }),
    ])

    await act(async () => {
      root.render(
        <ReviewScreen db={db as any} onOpenNoteId={vi.fn(async () => {})} />
      )
      await flushEffects()
    })

    const cards = Array.from(container.querySelectorAll('[data-testid="review-card"]'))

    expect(cards).toHaveLength(2)
    expect(cards[0]?.querySelector('[data-testid="review-card-chip"]')?.textContent).toBe('fleeting')
    expect(cards[0]?.querySelector('[data-testid="review-card-open-action"]')?.textContent).toBe('Open in Workspace')
    expect(cards[1]?.querySelector('[data-testid="review-card-chip"]')?.textContent).toBe('literature')
    expect(cards[1]?.querySelector('[data-testid="review-card-open-action"]')?.textContent).toBe('Open in Workspace')
  })
})
