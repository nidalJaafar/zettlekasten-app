import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Note } from '@zettelkasten/core'
import App from './App'
import { getDb } from './db'
import { getAllLinks, getNoteById, getNotesByType, runMigrations } from '@zettelkasten/core'

vi.mock('./db', () => ({
  getDb: vi.fn(),
}))

vi.mock('@zettelkasten/core', () => ({
  getAllLinks: vi.fn(),
  getNoteById: vi.fn(),
  getNotesByType: vi.fn(),
  runMigrations: vi.fn(),
}))

vi.mock('./screens/InboxScreen', () => ({
  default: () => <div>Inbox Screen</div>,
}))

vi.mock('./screens/ReviewScreen', () => ({
  default: () => <div>Review Screen</div>,
}))

vi.mock('./screens/LibraryScreen', () => ({
  default: () => <div>Library Screen</div>,
}))

vi.mock('./components/GraphCanvas', () => ({
  default: ({
    notes,
    onNodeClick,
  }: {
    notes: Note[]
    onNodeClick: (note: Note) => void
  }) => (
    <button onClick={() => onNodeClick(notes[0])}>Select Graph Note</button>
  ),
}))

vi.mock('./components/workspace/NoteWorkspace', () => ({
  default: ({
    target,
  }: {
    target: { mode: 'note'; noteId: string } | { mode: 'draft'; noteType: 'literature' | 'permanent' } | null
  }) => <div>Workspace target: {describeTarget(target)}</div>,
}))

function describeTarget(target: { mode: 'note'; noteId: string } | { mode: 'draft'; noteType: 'literature' | 'permanent' } | null) {
  if (!target) return 'none'
  return target.mode === 'note' ? `note:${target.noteId}` : `draft:${target.noteType}`
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

describe('App workspace routing', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    vi.mocked(getDb).mockResolvedValue(createFakeDb())
    vi.mocked(runMigrations).mockResolvedValue(undefined)
    vi.mocked(getNotesByType).mockImplementation(async (_, type) => {
      if (type === 'permanent') {
        return [{ id: 'note-1', title: 'One', content: 'Body', type: 'permanent' } as Note]
      }
      return []
    })
    vi.mocked(getAllLinks).mockResolvedValue([])
    vi.mocked(getNoteById).mockResolvedValue(null)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
      await flushEffects()
    })
    container.remove()
    vi.clearAllMocks()
  })

  async function renderApp() {
    await act(async () => {
      root.render(<App />)
      await flushEffects()
    })
  }

  it('routes review events into the workspace note target', async () => {
    const note = { id: 'note-1', title: 'One', content: '', type: 'fleeting' } as Note

    await renderApp()

    await act(async () => {
      window.dispatchEvent(new CustomEvent('zettel:review', { detail: note }))
      await flushEffects()
    })

    expect(container.textContent).toContain('Workspace target: note:note-1')
  })

  it('shares the selected workspace target with graph and reopens notes by id', async () => {
    const note = { id: 'note-1', title: 'One', content: '', type: 'permanent' } as Note
    vi.mocked(getNoteById).mockImplementation(async (_, noteId) => ({
      id: String(noteId),
      title: noteId === 'note-1' ? 'One' : 'Two',
      content: '',
      type: 'permanent',
    } as Note))

    await renderApp()

    await act(async () => {
      window.dispatchEvent(new CustomEvent('zettel:review', { detail: note }))
      await flushEffects()
    })

    const graphButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Graph'))
    expect(graphButton).toBeTruthy()

    await act(async () => {
      graphButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushEffects()
    })

    expect(container.textContent).toContain('One')

    const openButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Open')
    expect(openButton).toBeTruthy()

    await act(async () => {
      openButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushEffects()
    })

    expect(getNoteById).toHaveBeenCalledWith(expect.any(Object), 'note-1')
    expect(container.textContent).toContain('Workspace target: note:note-1')
  })

  it('routes new literature events into a workspace draft target', async () => {
    await renderApp()

    await act(async () => {
      window.dispatchEvent(new Event('zettel:new-literature'))
      await flushEffects()
    })

    expect(container.textContent).toContain('Workspace target: draft:literature')
  })
})
