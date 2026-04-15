import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database, Note } from '@zettelkasten/core'
import NoteWorkspace from './NoteWorkspace'
import { createNote, getLinkedNoteIds, getNoteById, softDeleteNote } from '@zettelkasten/core'
import {
  promoteFleetingToLiterature,
  saveLiteratureAsPermanent,
  savePersistedNote,
  syncNoteLinks,
} from '../../lib/note-workflow'

vi.mock('@zettelkasten/core', () => ({
  createNote: vi.fn(),
  getLinkedNoteIds: vi.fn(),
  getNoteById: vi.fn(),
  softDeleteNote: vi.fn(),
}))

vi.mock('../../lib/note-workflow', () => ({
  promoteFleetingToLiterature: vi.fn(),
  saveLiteratureAsPermanent: vi.fn(),
  savePersistedNote: vi.fn(),
  syncNoteLinks: vi.fn(),
}))

vi.mock('./WorkspaceRail', () => ({
  default: ({
    activeNoteId,
    onOpenNoteId,
  }: {
    activeNoteId: string | null
    onOpenNoteId: (noteId: string) => Promise<void>
  }) => (
    <div>
      <div>Rail active: {activeNoteId ?? 'none'}</div>
      <button onClick={() => { void onOpenNoteId('note-2') }}>Open rail note</button>
    </div>
  ),
}))

vi.mock('./ContextGraph', () => ({
  default: ({ onOpenNoteId }: { onOpenNoteId: (noteId: string) => void }) => (
    <div>
      <div>ContextGraph</div>
      <button onClick={() => onOpenNoteId('context-note-2')}>Open context note</button>
    </div>
  ),
}))

vi.mock('./DocumentPane', () => ({
  default: ({
    title,
    content,
    saveState,
    defaultMode,
    readOnly,
    onTitleChange,
    onContentChange,
    onLinkClick,
    wikilinkOptions,
    onCreateWikilinkNote,
  }: {
    title: string
    content: string
    saveState: 'saved' | 'dirty' | 'saving' | 'error'
    defaultMode?: 'preview' | 'code'
    readOnly?: boolean
    onTitleChange: (value: string) => void
    onContentChange: (value: string) => void
    onLinkClick?: (value: string) => void
    wikilinkOptions?: Array<{ id: string; title: string }>
    onCreateWikilinkNote?: (title: string) => Promise<{ id: string; title: string }>
  }) => (
    <div>
      <div>Pane title: {title}</div>
      <div>Pane content: {content}</div>
      <div>Pane save state: {saveState}</div>
      <div>Pane default mode: {defaultMode ?? 'none'}</div>
      <div>Pane mode: {readOnly ? 'readonly' : 'editable'}</div>
      {!readOnly && <button onClick={() => onTitleChange('Updated title')}>Change title</button>}
      {!readOnly && <button onClick={() => onContentChange('Updated body')}>Change body</button>}
      {onLinkClick && <button onClick={() => onLinkClick('Linked note')}>Open linked note</button>}
      {wikilinkOptions && <div>Pane wikilink options: {wikilinkOptions.map((o) => o.title).join(', ')}</div>}
      {onCreateWikilinkNote && <button onClick={() => { void onCreateWikilinkNote('New note') }}>Create wikilink note</button>}
    </div>
  ),
}))

vi.mock('./NoteContextPane', () => ({
  default: ({
    note,
    draftType,
    sourceId,
    linkedIds,
    error,
    onDeleteNote,
    onSourceIdChange,
    onToggleLink,
    onPromoteToLiterature,
    onSaveAsPermanent,
  }: {
    note: Note | null
    draftType: 'literature' | 'permanent' | null
    sourceId: string | null
    linkedIds: string[]
    error: string | null
    onDeleteNote?: () => void
    onSourceIdChange: (value: string | null) => void
    onToggleLink: (value: string) => void
    onPromoteToLiterature: () => void
    onSaveAsPermanent: () => void
  }) => (
    <div>
      <div>Context note type: {note?.type ?? 'draft'}</div>
      <div>Context draft type: {draftType ?? 'none'}</div>
      <div>Context source: {sourceId ?? 'none'}</div>
      <div>Context links: {linkedIds.join(',') || 'none'}</div>
      <div>Context error: {error ?? 'none'}</div>
      <button onClick={() => onSourceIdChange('source-picked')}>Pick source</button>
      <button onClick={() => onToggleLink('existing-link')}>Toggle existing link</button>
      <button onClick={() => onToggleLink('link-picked')}>Toggle picked link</button>
      <button onClick={onPromoteToLiterature}>Promote note</button>
      <button onClick={onSaveAsPermanent}>Save note</button>
      {onDeleteNote && <button onClick={onDeleteNote}>Delete note</button>}
    </div>
  ),
}))

function createFakeDb(): Database {
  const recentNotes = [
    {
      id: 'note-1',
      type: 'literature',
      title: 'Loaded note',
      updated_at: 200,
    },
    {
      id: 'note-2',
      type: 'permanent',
      title: 'Older note',
      updated_at: 100,
    },
  ]

  async function query<T>(): Promise<T[]> {
    return recentNotes as T[]
  }

  return {
    execute: vi.fn(async () => {}),
    query,
    queryOne: vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('WHERE title = ?') && params?.[0] === 'Linked note') {
        return { id: 'linked-note-id' }
      }
      return null
    }),
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

function createStorage(): Storage {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key) {
      return store.get(key) ?? null
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key) {
      store.delete(key)
    },
    setItem(key, value) {
      store.set(key, value)
    },
  }
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  })
}

describe('NoteWorkspace', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('localStorage', createStorage())
    setViewportWidth(1280)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    vi.mocked(getNoteById).mockResolvedValue({
      id: 'note-1',
      type: 'literature',
      title: 'Loaded note',
      content: 'Loaded body',
      created_at: 1,
      updated_at: 2,
      source_id: 'source-1',
      own_words_confirmed: 1,
      deleted_at: null,
      processed_at: null,
    } as Note)
    vi.mocked(createNote).mockResolvedValue({
      id: 'created-note',
      type: 'literature',
      title: 'Created note',
      content: 'Created body',
      created_at: 1,
      updated_at: 1,
      source_id: 'source-picked',
      own_words_confirmed: 0,
      deleted_at: null,
      processed_at: null,
    } as Note)
    vi.mocked(getLinkedNoteIds).mockResolvedValue([])
    vi.mocked(softDeleteNote).mockResolvedValue(undefined)
    vi.mocked(promoteFleetingToLiterature).mockResolvedValue(undefined)
    vi.mocked(saveLiteratureAsPermanent).mockResolvedValue({
      id: 'permanent-created',
      type: 'permanent',
      title: 'Permanent note',
      content: 'Permanent body',
      created_at: 1,
      updated_at: 1,
      source_id: null,
      own_words_confirmed: 1,
      deleted_at: null,
      processed_at: null,
    } as Note)
    vi.mocked(savePersistedNote).mockResolvedValue(undefined)
    vi.mocked(syncNoteLinks).mockResolvedValue(undefined)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
      await flushEffects()
    })
    container.remove()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('loads a note target into the document pane and autosaves title and content changes', async () => {
    const db = createFakeDb()

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={vi.fn(async () => {})}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    expect(getNoteById).toHaveBeenCalledWith(db, 'note-1')
    expect(container.textContent).toContain('Rail active: note-1')
    expect(container.textContent).toContain('Pane title: Loaded note')
    expect(container.textContent).toContain('Pane content: Loaded body')
    expect(container.textContent).toContain('Pane default mode: preview')

    await act(async () => {
      clickButton(container, 'Change title')
      clickButton(container, 'Change body')
      await flushEffects()
    })

    expect(container.textContent).toContain('Pane save state: dirty')

    await act(async () => {
      vi.advanceTimersByTime(449)
    })
    expect(savePersistedNote).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1)
      await flushEffects()
    })

    expect(savePersistedNote).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ id: 'note-1', title: 'Loaded note' }),
      {
        title: 'Updated title',
        content: 'Updated body',
        source_id: 'source-1',
      }
    )
    expect(container.textContent).toContain('Pane save state: saved')
  })

  it('routes persisted autosaves through the note workflow helper when the title changes', async () => {
    const db = createFakeDb()

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={vi.fn(async () => {})}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    await act(async () => {
      clickButton(container, 'Change title')
      await flushEffects()
    })

    await act(async () => {
      vi.advanceTimersByTime(450)
      await flushEffects()
    })

    expect(savePersistedNote).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ id: 'note-1', title: 'Loaded note' }),
      {
        title: 'Updated title',
        content: 'Loaded body',
        source_id: 'source-1',
      }
    )
  })

  it('opens a linked note from the document pane by matching its title', async () => {
    const db = createFakeDb()
    const onOpenNoteId = vi.fn(async () => {})

    vi.mocked(getNoteById).mockResolvedValueOnce({
      id: 'note-1',
      type: 'literature',
      title: 'Loaded note',
      content: 'Body with [[Linked note]]',
      created_at: 1,
      updated_at: 2,
      source_id: 'source-1',
      own_words_confirmed: 1,
      deleted_at: null,
      processed_at: null,
    } as Note)

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={onOpenNoteId}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    await act(async () => {
      clickButton(container, 'Open linked note')
      await flushEffects()
    })

    expect(onOpenNoteId).toHaveBeenCalledWith('linked-note-id')
  })

  it('stays in saving state without scheduling duplicate saves while a save is in flight', async () => {
    const db = createFakeDb()
    let resolveSave: (() => void) | null = null
    vi.mocked(savePersistedNote).mockImplementation(() => new Promise<void>((resolve) => {
      resolveSave = resolve
    }))

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={vi.fn(async () => {})}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    await act(async () => {
      clickButton(container, 'Change title')
      await flushEffects()
    })

    expect(container.textContent).toContain('Pane save state: dirty')

    await act(async () => {
      vi.advanceTimersByTime(450)
      await flushEffects()
    })

    expect(savePersistedNote).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Pane save state: saving')

    await act(async () => {
      vi.advanceTimersByTime(1000)
      await flushEffects()
    })

    expect(savePersistedNote).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Pane save state: saving')

    await act(async () => {
      resolveSave?.()
      await flushEffects()
    })

    expect(container.textContent).toContain('Pane save state: saved')
  })

  it('renders draggable separators and restores persisted rail and context widths', async () => {
    const db = createFakeDb()
    localStorage.setItem('layout.workspace.rail.width', '310')
    localStorage.setItem('layout.workspace.context.width', '330')

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={vi.fn(async () => {})}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    const railPane = container.querySelector('[data-testid="workspace-rail-pane"]')
    const contextPane = container.querySelector('[data-testid="workspace-context-pane"]')
    const railHandle = container.querySelector('[data-testid="workspace-rail-resize-handle"]')
    const contextHandle = container.querySelector('[data-testid="workspace-context-resize-handle"]')

    expect(railPane).not.toBeNull()
    expect(contextPane).not.toBeNull()
    expect(railHandle?.getAttribute('role')).toBe('separator')
    expect(contextHandle?.getAttribute('role')).toBe('separator')
    expect((railPane as HTMLDivElement).style.width).toBe('310px')
    expect((contextPane as HTMLDivElement).style.width).toBe('330px')
  })

  it('updates workspace pane widths while dragging and persists the new values', async () => {
    const db = createFakeDb()

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={vi.fn(async () => {})}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    const railPane = container.querySelector('[data-testid="workspace-rail-pane"]')
    const contextPane = container.querySelector('[data-testid="workspace-context-pane"]')
    const railHandle = container.querySelector('[data-testid="workspace-rail-resize-handle"]')
    const contextHandle = container.querySelector('[data-testid="workspace-context-resize-handle"]')

    if (!(railPane instanceof HTMLDivElement) || !(contextPane instanceof HTMLDivElement)) {
      throw new Error('Missing workspace panes')
    }

    if (!(railHandle instanceof HTMLDivElement) || !(contextHandle instanceof HTMLDivElement)) {
      throw new Error('Missing workspace resize handles')
    }

    await act(async () => {
      railHandle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 240 }))
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 300 }))
    })

    expect(railPane.style.width).toBe('300px')
    expect(localStorage.getItem('layout.workspace.rail.width')).toBe('300')

    await act(async () => {
      contextHandle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 900 }))
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 840 }))
    })

    expect(contextPane.style.width).toBe('340px')
    expect(localStorage.getItem('layout.workspace.context.width')).toBe('340')

    await act(async () => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })
  })

  it('uses compact layout controls and hides supporting panes until opened on narrow screens', async () => {
    const db = createFakeDb()
    setViewportWidth(1150)

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={vi.fn(async () => {})}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
      window.dispatchEvent(new Event('resize'))
      await flushEffects()
    })

    expect(container.textContent).toContain('Pane title: Loaded note')
    expect(container.querySelector('[data-testid="workspace-rail-pane"]')).toBeNull()
    expect(container.querySelector('[data-testid="workspace-context-pane"]')).toBeNull()
    expect(container.querySelector('[data-testid="workspace-rail-resize-handle"]')).toBeNull()
    expect(container.querySelector('[data-testid="workspace-context-resize-handle"]')).toBeNull()
    expect(container.querySelector('[aria-label="Show notes panel"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Show context panel"]')).not.toBeNull()

    await act(async () => {
      ;(container.querySelector('[aria-label="Show notes panel"]') as HTMLButtonElement).click()
      await flushEffects()
    })

    expect(container.querySelector('[data-testid="workspace-rail-pane"]')).not.toBeNull()
    expect(container.textContent).toContain('Rail active: note-1')

    await act(async () => {
      ;(container.querySelector('[aria-label="Show context panel"]') as HTMLButtonElement).click()
      await flushEffects()
    })

    expect(container.querySelector('[data-testid="workspace-context-pane"]')).not.toBeNull()
    expect(container.textContent).toContain('ContextGraph')
  })

  it('restores the wide three-column layout after leaving compact mode', async () => {
    const db = createFakeDb()
    setViewportWidth(1150)

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={vi.fn(async () => {})}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    expect(container.querySelector('[data-testid="workspace-rail-pane"]')).toBeNull()
    expect(container.querySelector('[data-testid="workspace-context-pane"]')).toBeNull()

    await act(async () => {
      setViewportWidth(1280)
      window.dispatchEvent(new Event('resize'))
      await flushEffects()
    })

    expect(container.querySelector('[data-testid="workspace-rail-pane"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="workspace-context-pane"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="workspace-rail-resize-handle"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="workspace-context-resize-handle"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Show notes panel"]')).toBeNull()
    expect(container.querySelector('[aria-label="Show context panel"]')).toBeNull()
  })

  it('closes the compact rail drawer after opening a note from the rail', async () => {
    const db = createFakeDb()
    const onOpenNoteId = vi.fn(async () => {})
    setViewportWidth(900)

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={onOpenNoteId}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    await act(async () => {
      clickButton(container, 'Notes')
      await flushEffects()
    })

    expect(container.querySelector('[data-testid="workspace-rail-pane"]')).not.toBeNull()

    await act(async () => {
      clickButton(container, 'Open rail note')
      await flushEffects()
    })

    expect(onOpenNoteId).toHaveBeenCalledWith('note-2')
    expect(container.querySelector('[data-testid="workspace-rail-pane"]')).toBeNull()
  })

  it('closes the compact context drawer after opening a note from context', async () => {
    const db = createFakeDb()
    const onOpenNoteId = vi.fn(async () => {})
    setViewportWidth(900)

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={onOpenNoteId}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    await act(async () => {
      clickButton(container, 'Context')
      await flushEffects()
    })

    expect(container.querySelector('[data-testid="workspace-context-pane"]')).not.toBeNull()

    await act(async () => {
      clickButton(container, 'Open context note')
      await flushEffects()
    })

    expect(onOpenNoteId).toHaveBeenCalledWith('context-note-2')
    expect(container.querySelector('[data-testid="workspace-context-pane"]')).toBeNull()
  })

  it('closes the compact drawer when the backdrop is clicked', async () => {
    const db = createFakeDb()
    setViewportWidth(900)

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={vi.fn(async () => {})}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    await act(async () => {
      clickButton(container, 'Context')
      await flushEffects()
    })

    expect(container.querySelector('[data-testid="workspace-context-pane"]')).not.toBeNull()

    await act(async () => {
      ;(container.querySelector('[aria-label="Close workspace panel"]') as HTMLButtonElement).click()
      await flushEffects()
    })

    expect(container.querySelector('[data-testid="workspace-context-pane"]')).toBeNull()
  })

  it('shows persisted save helper errors after autosave fails', async () => {
    const db = createFakeDb()
    vi.mocked(savePersistedNote).mockRejectedValueOnce(
      new Error('Cannot propagate title-based wikilinks for ambiguous active titles.')
    )

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={vi.fn(async () => {})}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    await act(async () => {
      clickButton(container, 'Change title')
      await flushEffects()
    })

    await act(async () => {
      vi.advanceTimersByTime(450)
      await flushEffects()
    })

    expect(container.textContent).toContain('Pane save state: error')
    expect(container.textContent).toContain(
      'Context error: Cannot propagate title-based wikilinks for ambiguous active titles.'
    )
  })

  it('marks draft targets as unsaved instead of falsely reporting saved', async () => {
    const db = createFakeDb()

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'draft', noteType: 'literature' }}
          onOpenNoteId={vi.fn(async () => {})}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    expect(container.textContent).toContain('Pane save state: dirty')
    expect(container.textContent).toContain('Pane default mode: code')
    expect(container.textContent).toContain('Pane mode: editable')
    expect(savePersistedNote).not.toHaveBeenCalled()
    expect(container.textContent).not.toContain('Delete note')
  })

  it('passes preview mode to persisted note targets', async () => {
    const db = createFakeDb()

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={vi.fn(async () => {})}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    expect(container.textContent).toContain('Pane default mode: preview')
  })

  it('passes code mode to draft targets', async () => {
    const db = createFakeDb()

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'draft', noteType: 'literature' }}
          onOpenNoteId={vi.fn(async () => {})}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    expect(container.textContent).toContain('Pane default mode: code')
  })

  it('soft-deletes a saved note after confirmation, refreshes counts, and clears the active target', async () => {
    const db = createFakeDb()
    const onInboxCountChange = vi.fn(async () => {})
    const onOpenTarget = vi.fn()
    const confirmSpy = vi.fn(() => true)
    vi.stubGlobal('confirm', confirmSpy)

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={vi.fn(async () => {})}
          onOpenTarget={onOpenTarget}
          onInboxCountChange={onInboxCountChange}
        />
      )
      await flushEffects()
    })

    expect(container.textContent).toContain('Delete note')

    await act(async () => {
      clickButton(container, 'Delete note')
      await flushEffects()
    })

    expect(confirmSpy).toHaveBeenCalled()
    expect(softDeleteNote).toHaveBeenCalledWith(db, 'note-1')
    expect(onInboxCountChange).toHaveBeenCalled()
    expect(onOpenTarget).toHaveBeenCalledWith(null)
  })

  it('does not autosave after a dirty note is deleted before the debounce fires', async () => {
    const db = createFakeDb()
    const confirmSpy = vi.fn(() => true)
    vi.stubGlobal('confirm', confirmSpy)

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={vi.fn(async () => {})}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    await act(async () => {
      clickButton(container, 'Change title')
      await flushEffects()
    })

    expect(container.textContent).toContain('Pane save state: dirty')

    await act(async () => {
      clickButton(container, 'Delete note')
      await flushEffects()
    })

    await act(async () => {
      vi.advanceTimersByTime(450)
      await flushEffects()
    })

    await act(async () => {
      vi.advanceTimersByTime(450)
      await flushEffects()
    })

    expect(confirmSpy).toHaveBeenCalled()
    expect(softDeleteNote).toHaveBeenCalledWith(db, 'note-1')
    expect(savePersistedNote).not.toHaveBeenCalled()
  })

  it('resumes autosave after delete fails for a dirty note', async () => {
    const db = createFakeDb()
    const confirmSpy = vi.fn(() => true)
    vi.stubGlobal('confirm', confirmSpy)
    let rejectDelete: ((error: Error) => void) | null = null
    vi.mocked(softDeleteNote).mockImplementationOnce(() => new Promise<void>((_, reject) => {
      rejectDelete = reject
    }))

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={vi.fn(async () => {})}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    await act(async () => {
      clickButton(container, 'Change title')
      await flushEffects()
    })

    expect(container.textContent).toContain('Pane save state: dirty')

    await act(async () => {
      clickButton(container, 'Delete note')
      await flushEffects()
    })

    await act(async () => {
      rejectDelete?.(new Error('Delete failed'))
      await flushEffects()
    })

    await act(async () => {
      vi.advanceTimersByTime(450)
      await flushEffects()
    })

    expect(confirmSpy).toHaveBeenCalled()
    expect(softDeleteNote).toHaveBeenCalledWith(db, 'note-1')
    expect(savePersistedNote).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ id: 'note-1', title: 'Loaded note' }),
      {
        title: 'Updated title',
        content: 'Loaded body',
        source_id: 'source-1',
      }
    )
  })

  it('ignores stale save completion after switching to another target', async () => {
    const db = createFakeDb()
    let resolveFirstSave: (() => void) | null = null
    vi.mocked(getNoteById)
      .mockResolvedValueOnce({
        id: 'note-1',
        type: 'literature',
        title: 'Loaded note',
        content: 'Loaded body',
        created_at: 1,
        updated_at: 2,
        source_id: 'source-1',
        own_words_confirmed: 1,
        deleted_at: null,
        processed_at: null,
      } as Note)
      .mockResolvedValueOnce({
        id: 'note-2',
        type: 'permanent',
        title: 'Second note',
        content: 'Second body',
        created_at: 3,
        updated_at: 4,
        source_id: null,
        own_words_confirmed: 0,
        deleted_at: null,
        processed_at: null,
      } as Note)

    vi.mocked(savePersistedNote).mockImplementation(() => new Promise<void>((resolve) => {
      resolveFirstSave = resolve
    }))

    const noop = vi.fn(async () => {})

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={noop}
          onOpenTarget={vi.fn()}
          onInboxCountChange={noop}
        />
      )
      await flushEffects()
    })

    await act(async () => {
      clickButton(container, 'Change title')
      await flushEffects()
    })

    await act(async () => {
      vi.advanceTimersByTime(450)
      await flushEffects()
    })

    expect(container.textContent).toContain('Pane save state: saving')

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-2' }}
          onOpenNoteId={noop}
          onOpenTarget={vi.fn()}
          onInboxCountChange={noop}
        />
      )
      await flushEffects()
    })

    expect(container.textContent).toContain('Pane title: Second note')
    expect(container.textContent).toContain('Pane save state: saved')

    await act(async () => {
      clickButton(container, 'Change title')
      await flushEffects()
    })

    expect(container.textContent).toContain('Pane save state: dirty')

    await act(async () => {
      resolveFirstSave?.()
      await flushEffects()
    })

    expect(container.textContent).toContain('Pane title: Updated title')
    expect(container.textContent).toContain('Pane save state: dirty')
    expect(savePersistedNote).toHaveBeenCalledTimes(1)
  })

  it('creates a literature note from a draft target and opens it', async () => {
    const db = createFakeDb()
    const onOpenNoteId = vi.fn(async () => {})

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'draft', noteType: 'literature' }}
          onOpenNoteId={onOpenNoteId}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    await act(async () => {
      clickButton(container, 'Pick source')
      await flushEffects()
    })

    await act(async () => {
      clickButton(container, 'Promote note')
      await flushEffects()
    })

    expect(createNote).toHaveBeenCalledWith(db, {
      type: 'literature',
      title: '',
      content: '',
      source_id: 'source-picked',
    })
    expect(onOpenNoteId).toHaveBeenCalledWith('created-note')
  })

  it('promotes a loaded fleeting note and refreshes the inbox count', async () => {
    const db = createFakeDb()
    const onInboxCountChange = vi.fn(async () => {})
    vi.mocked(getNoteById).mockResolvedValueOnce({
      id: 'note-1',
      type: 'fleeting',
      title: 'Quick note',
      content: 'Raw body',
      created_at: 1,
      updated_at: 2,
      source_id: null,
      own_words_confirmed: 0,
      deleted_at: null,
      processed_at: null,
    } as Note)

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={vi.fn(async () => {})}
          onOpenTarget={vi.fn()}
          onInboxCountChange={onInboxCountChange}
        />
      )
      await flushEffects()
    })

    await act(async () => {
      clickButton(container, 'Pick source')
      await flushEffects()
    })

    await act(async () => {
      clickButton(container, 'Promote note')
      await flushEffects()
    })

    expect(promoteFleetingToLiterature).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ id: 'note-1', type: 'fleeting' }),
      'Quick note',
      'Raw body',
      'source-picked'
    )
    expect(onInboxCountChange).toHaveBeenCalled()
  })

  it('loads and updates links for a permanent note', async () => {
    const db = createFakeDb()
    vi.mocked(getLinkedNoteIds).mockResolvedValueOnce(['existing-link'])
    vi.mocked(getNoteById).mockResolvedValueOnce({
      id: 'note-1',
      type: 'permanent',
      title: 'Permanent note',
      content: 'Saved body',
      created_at: 1,
      updated_at: 2,
      source_id: null,
      own_words_confirmed: 1,
      deleted_at: null,
      processed_at: null,
    } as Note)

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={vi.fn(async () => {})}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    expect(getLinkedNoteIds).toHaveBeenCalledWith(db, 'note-1')
    expect(container.textContent).toContain('Context links: existing-link')

    await act(async () => {
      clickButton(container, 'Toggle existing link')
      await flushEffects()
    })

    await act(async () => {
      clickButton(container, 'Toggle picked link')
      await flushEffects()
    })

    await act(async () => {
      clickButton(container, 'Save note')
      await flushEffects()
    })

    expect(syncNoteLinks).toHaveBeenCalledWith(db, 'note-1', ['link-picked'])
  })

  it('flushes pending literature edits before saving as permanent', async () => {
    const db = createFakeDb()
    const onOpenNoteId = vi.fn(async () => {})

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={onOpenNoteId}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    await act(async () => {
      clickButton(container, 'Change title')
      clickButton(container, 'Change body')
      clickButton(container, 'Pick source')
      await flushEffects()
    })

    await act(async () => {
      vi.advanceTimersByTime(449)
      await flushEffects()
    })

    expect(savePersistedNote).not.toHaveBeenCalled()

    await act(async () => {
      clickButton(container, 'Save note')
      await flushEffects()
    })

    await act(async () => {
      vi.advanceTimersByTime(1000)
      await flushEffects()
    })

    expect(savePersistedNote).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        id: 'note-1',
        type: 'literature',
        title: 'Loaded note',
        content: 'Loaded body',
        source_id: 'source-1',
      }),
      {
        title: 'Updated title',
        content: 'Updated body',
        source_id: 'source-picked',
      }
    )
    expect(saveLiteratureAsPermanent).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        id: 'note-1',
        type: 'literature',
        title: 'Updated title',
        content: 'Updated body',
        source_id: 'source-picked',
      }),
      'Updated title',
      'Updated body',
      [],
      true
    )
    expect(savePersistedNote).toHaveBeenCalledTimes(1)
    expect(onOpenNoteId).toHaveBeenCalledWith('permanent-created')
  })

  it('waits for an in-flight autosave before promoting literature to permanent', async () => {
    const db = createFakeDb()
    const onOpenNoteId = vi.fn(async () => {})
    let resolveFirstSave: (() => void) | null = null

    vi.mocked(savePersistedNote).mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveFirstSave = resolve
    }))

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={onOpenNoteId}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    await act(async () => {
      clickButton(container, 'Change title')
      clickButton(container, 'Change body')
      clickButton(container, 'Pick source')
      await flushEffects()
    })

    await act(async () => {
      vi.advanceTimersByTime(450)
      await flushEffects()
    })

    expect(savePersistedNote).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Pane save state: saving')

    await act(async () => {
      clickButton(container, 'Save note')
      await flushEffects()
    })

    expect(savePersistedNote).toHaveBeenCalledTimes(1)
    expect(saveLiteratureAsPermanent).not.toHaveBeenCalled()

    await act(async () => {
      resolveFirstSave?.()
      await flushEffects()
    })

    expect(savePersistedNote).toHaveBeenCalledTimes(1)
    expect(saveLiteratureAsPermanent).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        id: 'note-1',
        type: 'literature',
        title: 'Updated title',
        content: 'Updated body',
        source_id: 'source-picked',
      }),
      'Updated title',
      'Updated body',
      [],
      true
    )
    expect(onOpenNoteId).toHaveBeenCalledWith('permanent-created')
  })

  it('passes wikilink suggestions from existing notes into the document pane', async () => {
    const db = createFakeDb()

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={vi.fn(async () => {})}
          onOpenTarget={vi.fn()}
          onInboxCountChange={vi.fn(async () => {})}
        />
      )
      await flushEffects()
    })

    expect(container.textContent).toContain('Pane wikilink options')
    expect(container.textContent).toContain('Loaded note')
    expect(container.textContent).toContain('Older note')
  })

  it('creates a new fleeting note from the wikilink picker and refreshes options', async () => {
    const db = createFakeDb()
    const onInboxCountChange = vi.fn(async () => {})

    await act(async () => {
      root.render(
        <NoteWorkspace
          db={db}
          target={{ mode: 'note', noteId: 'note-1' }}
          onOpenNoteId={vi.fn(async () => {})}
          onOpenTarget={vi.fn()}
          onInboxCountChange={onInboxCountChange}
        />
      )
      await flushEffects()
    })

    await act(async () => {
      clickButton(container, 'Create wikilink note')
      await flushEffects()
    })

    expect(createNote).toHaveBeenCalledWith(db, { type: 'fleeting', title: 'New note' })
    expect(onInboxCountChange).toHaveBeenCalled()
  })
})
