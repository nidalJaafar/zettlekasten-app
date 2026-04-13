import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database, Note } from '@zettelkasten/core'
import NoteWorkspace from './NoteWorkspace'
import { createNote, getLinkedNoteIds, getNoteById, updateNote } from '@zettelkasten/core'
import { promoteFleetingToLiterature, saveLiteratureAsPermanent, syncNoteLinks } from '../../lib/note-workflow'

vi.mock('@zettelkasten/core', () => ({
  createNote: vi.fn(),
  getLinkedNoteIds: vi.fn(),
  getNoteById: vi.fn(),
  updateNote: vi.fn(),
}))

vi.mock('../../lib/note-workflow', () => ({
  promoteFleetingToLiterature: vi.fn(),
  saveLiteratureAsPermanent: vi.fn(),
  syncNoteLinks: vi.fn(),
}))

vi.mock('./WorkspaceRail', () => ({
  default: ({ activeNoteId }: { activeNoteId: string | null }) => <div>Rail active: {activeNoteId ?? 'none'}</div>,
}))

vi.mock('./ContextGraph', () => ({
  default: () => <div>ContextGraph</div>,
}))

vi.mock('./DocumentPane', () => ({
  default: ({
    title,
    content,
    saveState,
    readOnly,
    onTitleChange,
    onContentChange,
  }: {
    title: string
    content: string
    saveState: 'saved' | 'dirty' | 'saving' | 'error'
    readOnly?: boolean
    onTitleChange: (value: string) => void
    onContentChange: (value: string) => void
  }) => (
    <div>
      <div>Pane title: {title}</div>
      <div>Pane content: {content}</div>
      <div>Pane save state: {saveState}</div>
      <div>Pane mode: {readOnly ? 'readonly' : 'editable'}</div>
      {!readOnly && <button onClick={() => onTitleChange('Updated title')}>Change title</button>}
      {!readOnly && <button onClick={() => onContentChange('Updated body')}>Change body</button>}
    </div>
  ),
}))

vi.mock('./NoteContextPane', () => ({
  default: ({
    note,
    draftType,
    sourceId,
    linkedIds,
    onSourceIdChange,
    onToggleLink,
    onPromoteToLiterature,
    onSaveAsPermanent,
  }: {
    note: Note | null
    draftType: 'literature' | 'permanent' | null
    sourceId: string | null
    linkedIds: string[]
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
      <button onClick={() => onSourceIdChange('source-picked')}>Pick source</button>
      <button onClick={() => onToggleLink('existing-link')}>Toggle existing link</button>
      <button onClick={() => onToggleLink('link-picked')}>Toggle picked link</button>
      <button onClick={onPromoteToLiterature}>Promote note</button>
      <button onClick={onSaveAsPermanent}>Save note</button>
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

describe('NoteWorkspace', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
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
    vi.mocked(updateNote).mockResolvedValue(undefined)
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
    vi.mocked(syncNoteLinks).mockResolvedValue(undefined)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
      await flushEffects()
    })
    container.remove()
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

    await act(async () => {
      const buttons = Array.from(container.querySelectorAll('button'))
      buttons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
      buttons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushEffects()
    })

    expect(container.textContent).toContain('Pane save state: dirty')

    await act(async () => {
      vi.advanceTimersByTime(449)
    })
    expect(updateNote).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1)
      await flushEffects()
    })

    expect(updateNote).toHaveBeenCalledWith(db, 'note-1', {
      title: 'Updated title',
      content: 'Updated body',
      source_id: 'source-1',
    })
    expect(container.textContent).toContain('Pane save state: saved')
  })

  it('stays in saving state without scheduling duplicate saves while a save is in flight', async () => {
    const db = createFakeDb()
    let resolveSave: (() => void) | null = null
    vi.mocked(updateNote).mockImplementation(() => new Promise<void>((resolve) => {
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
      const buttons = Array.from(container.querySelectorAll('button'))
      buttons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushEffects()
    })

    expect(container.textContent).toContain('Pane save state: dirty')

    await act(async () => {
      vi.advanceTimersByTime(450)
      await flushEffects()
    })

    expect(updateNote).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Pane save state: saving')

    await act(async () => {
      vi.advanceTimersByTime(1000)
      await flushEffects()
    })

    expect(updateNote).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Pane save state: saving')

    await act(async () => {
      resolveSave?.()
      await flushEffects()
    })

    expect(container.textContent).toContain('Pane save state: saved')
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
    expect(container.textContent).toContain('Pane mode: editable')
    expect(updateNote).not.toHaveBeenCalled()
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

    vi.mocked(updateNote).mockImplementation(() => new Promise<void>((resolve) => {
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
      const buttons = Array.from(container.querySelectorAll('button'))
      buttons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
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
      const buttons = Array.from(container.querySelectorAll('button'))
      buttons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushEffects()
    })

    expect(container.textContent).toContain('Pane save state: dirty')

    await act(async () => {
      resolveFirstSave?.()
      await flushEffects()
    })

    expect(container.textContent).toContain('Pane title: Updated title')
    expect(container.textContent).toContain('Pane save state: dirty')
    expect(updateNote).toHaveBeenCalledTimes(1)
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
})
