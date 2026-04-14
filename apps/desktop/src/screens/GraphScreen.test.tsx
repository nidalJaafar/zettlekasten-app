import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Note, NoteLink } from '@zettelkasten/core'
import GraphScreen from './GraphScreen'

const graphCanvasState = vi.hoisted(() => ({
  mountCount: 0,
  unmountCount: 0,
  lastProps: null as null | {
    notes: Note[]
    links: NoteLink[]
    focusNoteId?: string
    selectedNoteId?: string
    onNodeClick: (note: Note) => void
  },
}))

vi.mock('@zettelkasten/core', () => ({
  getNotesByType: vi.fn(),
  getAllLinks: vi.fn(),
}))

vi.mock('../components/GraphCanvas', async () => {
  const React = await import('react')

  return {
    default: ({ notes, links, focusNoteId, selectedNoteId, onNodeClick }: typeof graphCanvasState.lastProps) => {
      React.useEffect(() => {
        graphCanvasState.mountCount += 1
        return () => {
          graphCanvasState.unmountCount += 1
        }
      }, [])

      graphCanvasState.lastProps = { notes, links, focusNoteId, selectedNoteId, onNodeClick }

      return (
        <div data-testid="graph-canvas">
          <button onClick={() => onNodeClick(notes[0])}>Select first</button>
          <button onClick={() => onNodeClick(notes[1])}>Select second</button>
        </div>
      )
    },
  }
})

import { getAllLinks, getNotesByType } from '@zettelkasten/core'

const notes: Note[] = [
  {
    id: 'note-1',
    title: 'First note',
    content: 'First content',
    type: 'permanent',
    created_at: 1,
    updated_at: 1,
    source_id: null,
    own_words_confirmed: 1,
    processed_at: null,
    deleted_at: null,
  },
  {
    id: 'note-2',
    title: 'Second note',
    content: 'Second content',
    type: 'permanent',
    created_at: 2,
    updated_at: 2,
    source_id: null,
    own_words_confirmed: 1,
    processed_at: null,
    deleted_at: null,
  },
]

const links: NoteLink[] = [
  {
    from_note_id: 'note-1',
    to_note_id: 'note-2',
  },
]

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

function clickButton(container: HTMLDivElement, label: string) {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent === label)
  if (!button) {
    throw new Error(`Missing button: ${label}`)
  }

  button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('GraphScreen', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    graphCanvasState.mountCount = 0
    graphCanvasState.unmountCount = 0
    graphCanvasState.lastProps = null

    vi.mocked(getNotesByType).mockResolvedValue(notes)
    vi.mocked(getAllLinks).mockResolvedValue(links)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
      await flushEffects()
    })
    container.remove()
    vi.clearAllMocks()
  })

  it('keeps the graph mounted while inspector selection changes', async () => {
    await act(async () => {
      root.render(<GraphScreen db={createFakeDb() as any} onOpenNoteId={vi.fn(async () => {})} />)
      await flushEffects()
    })

    expect(graphCanvasState.mountCount).toBe(1)
    expect(graphCanvasState.unmountCount).toBe(0)
    expect(graphCanvasState.lastProps?.focusNoteId).toBeUndefined()
    expect(graphCanvasState.lastProps?.selectedNoteId).toBeUndefined()
    const initialNotesRef = graphCanvasState.lastProps?.notes
    const initialLinksRef = graphCanvasState.lastProps?.links

    await act(async () => {
      clickButton(container, 'Select first')
      await flushEffects()
    })

    expect(container.textContent).toContain('First note')
    expect(container.textContent).toContain('First content')
    expect(graphCanvasState.mountCount).toBe(1)
    expect(graphCanvasState.unmountCount).toBe(0)
    expect(graphCanvasState.lastProps?.selectedNoteId).toBe('note-1')
    expect(graphCanvasState.lastProps?.focusNoteId).toBeUndefined()
    expect(graphCanvasState.lastProps?.notes).toBe(initialNotesRef)
    expect(graphCanvasState.lastProps?.links).toBe(initialLinksRef)

    await act(async () => {
      clickButton(container, 'Select second')
      await flushEffects()
    })

    expect(container.textContent).toContain('Second note')
    expect(container.textContent).toContain('Second content')
    expect(graphCanvasState.mountCount).toBe(1)
    expect(graphCanvasState.unmountCount).toBe(0)
    expect(graphCanvasState.lastProps?.selectedNoteId).toBe('note-2')
    expect(graphCanvasState.lastProps?.focusNoteId).toBeUndefined()
    expect(graphCanvasState.lastProps?.notes).toBe(initialNotesRef)
    expect(graphCanvasState.lastProps?.links).toBe(initialLinksRef)
  })

  it('passes parent-driven workspace selection as graph focus', async () => {
    await act(async () => {
      root.render(
        <GraphScreen
          db={createFakeDb() as any}
          workspaceTarget={{ mode: 'note', noteId: 'note-2' }}
          onOpenNoteId={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    expect(container.textContent).toContain('Second note')
    expect(container.textContent).toContain('Second content')
    expect(graphCanvasState.mountCount).toBe(1)
    expect(graphCanvasState.unmountCount).toBe(0)
    expect(graphCanvasState.lastProps?.selectedNoteId).toBe('note-2')
    expect(graphCanvasState.lastProps?.focusNoteId).toBe('note-2')
  })

  it('clears the inspector without remounting the graph when dismissed', async () => {
    await act(async () => {
      root.render(<GraphScreen db={createFakeDb() as any} onOpenNoteId={vi.fn(async () => {})} />)
      await flushEffects()
    })

    await act(async () => {
      clickButton(container, 'Select first')
      await flushEffects()
    })

    expect(container.textContent).toContain('First note')

    await act(async () => {
      clickButton(container, '✕')
      await flushEffects()
    })

    expect(container.textContent).not.toContain('First note')
    expect(container.textContent).not.toContain('First content')
    expect(graphCanvasState.mountCount).toBe(1)
    expect(graphCanvasState.unmountCount).toBe(0)
    expect(graphCanvasState.lastProps?.selectedNoteId).toBeUndefined()
    expect(graphCanvasState.lastProps?.focusNoteId).toBeUndefined()
  })
})
