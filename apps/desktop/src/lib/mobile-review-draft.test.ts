import { describe, expect, it } from 'vitest'
import { getInitialReviewState, type ReviewDraft } from '../../../mobile/src/lib/note-workflow'
import type { Note } from '@zettelkasten/core'

function createNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    type: 'literature',
    title: 'Saved title',
    content: 'Saved content',
    source_id: 'source-1',
    own_words_confirmed: 0,
    processed_at: null,
    deleted_at: null,
    created_at: 1,
    updated_at: 1,
    ...overrides,
  }
}

describe('mobile review draft helpers', () => {
  it('prefers the pending draft for the active note', () => {
    const note = createNote()
    const draft: ReviewDraft = {
      noteId: note.id,
      title: 'Draft title',
      content: 'Draft content',
      sourceId: 'source-2',
      ownWords: true,
      linkedIds: ['perm-1', 'perm-2'],
    }

    expect(getInitialReviewState(note, draft)).toEqual({
      title: 'Draft title',
      content: 'Draft content',
      sourceId: 'source-2',
      ownWords: true,
      linkedIds: ['perm-1', 'perm-2'],
    })
  })

  it('falls back to persisted note values for a different draft note id', () => {
    const note = createNote({ own_words_confirmed: 1 })
    const draft: ReviewDraft = {
      noteId: 'other-note',
      title: 'Draft title',
      content: 'Draft content',
      sourceId: 'source-2',
      ownWords: false,
      linkedIds: ['perm-1'],
    }

    expect(getInitialReviewState(note, draft)).toEqual({
      title: 'Saved title',
      content: 'Saved content',
      sourceId: 'source-1',
      ownWords: true,
      linkedIds: [],
    })
  })
})
