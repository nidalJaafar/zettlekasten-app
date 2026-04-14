import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Note } from '@zettelkasten/core'
import { getNotesByType } from '@zettelkasten/core'
import ReviewScreen from './ReviewScreen'
import { FONT, typeColor } from '../theme'

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

function toRgb(hex: string): string {
  const normalized = hex.replace('#', '')
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgb(${red}, ${green}, ${blue})`
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

  it('renders each redesigned card as a horizontal row with an accent strip and integrated action metadata', async () => {
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

    for (const [index, card] of cards.entries()) {
      expect((card as HTMLElement).style.flexDirection).toBe('row')

      const accent = card.querySelector('[data-testid="review-card-accent"]') as HTMLElement | null
      const metadata = card.querySelector('[data-testid="review-card-meta"]') as HTMLElement | null
      const preview = card.querySelector('[data-testid="review-card-preview"]') as HTMLElement | null
      const chip = card.querySelector('[data-testid="review-card-chip"]')
      const action = card.querySelector('[data-testid="review-card-open-action"]')

      expect(accent).toBeTruthy()
      expect(accent?.style.width).toBe('6px')
      expect(metadata).toBeTruthy()
      expect(metadata?.textContent).toContain(index === 0 ? 'fleeting' : 'literature')
      expect(metadata?.textContent).toContain('Open in Workspace')
      expect(metadata?.querySelector('[data-testid="review-card-chip"]')).toBe(chip)
      expect(metadata?.querySelector('[data-testid="review-card-open-action"]')).toBe(action)
      expect(preview).toBeTruthy()
    }
  })

  it('keeps note-type accents inside the library-style review shell', async () => {
    const db = createFakeDb()
    vi.mocked(getNotesByType).mockResolvedValue([
      makeNote({ id: 'fleeting-1', title: 'Fleeting accent', type: 'fleeting' }),
    ])
    db.query.mockResolvedValue([
      makeNote({ id: 'lit-3', title: 'Literature accent', type: 'literature' }),
    ])

    await act(async () => {
      root.render(
        <ReviewScreen db={db as any} onOpenNoteId={vi.fn(async () => {})} />
      )
      await flushEffects()
    })

    const cards = Array.from(container.querySelectorAll('[data-testid="review-card"]'))

    expect(cards).toHaveLength(2)

    for (const [index, card] of cards.entries()) {
      const noteType = index === 0 ? 'fleeting' : 'literature'
      const accent = card.querySelector('[data-testid="review-card-accent"]') as HTMLElement | null
      const chip = card.querySelector('[data-testid="review-card-chip"]') as HTMLElement | null
      const expectedColor = toRgb(typeColor(noteType))

      expect(accent).toBeTruthy()
      expect(accent?.style.background).toBe(expectedColor)
      expect(chip).toBeTruthy()
      expect(chip?.style.color).toBe(expectedColor)
    }
  })
})
