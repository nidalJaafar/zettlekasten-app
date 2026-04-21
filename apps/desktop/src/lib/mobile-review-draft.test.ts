import { describe, expect, it } from 'vitest'
import {
  consumeReviewDraft,
  getInitialLinkPickerSelection,
  getInitialReviewState,
  mergeLinkedIdsIntoReviewDraft,
  type ReviewDraft,
} from '../../../mobile/src/lib/note-workflow'
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
      roundTripComplete: false,
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
      roundTripComplete: false,
    }

    expect(getInitialReviewState(note, draft)).toEqual({
      title: 'Saved title',
      content: 'Saved content',
      sourceId: 'source-1',
      ownWords: true,
      linkedIds: [],
    })
  })

  it('clears a consumed draft for the active note', () => {
    const note = createNote()
    const draft: ReviewDraft = {
      noteId: note.id,
      title: 'Draft title',
      content: 'Draft content',
      sourceId: 'source-2',
      ownWords: true,
      linkedIds: ['perm-1'],
      roundTripComplete: true,
    }

    expect(consumeReviewDraft(note, draft)).toEqual({
      initialState: {
        title: 'Draft title',
        content: 'Draft content',
        sourceId: 'source-2',
        ownWords: true,
        linkedIds: ['perm-1'],
      },
      remainingDraft: null,
    })
  })

  it('seeds link picker selection from the pending draft', () => {
    expect(getInitialLinkPickerSelection({
      noteId: 'note-1',
      title: 'Draft title',
      content: 'Draft content',
      sourceId: 'source-2',
      ownWords: true,
      linkedIds: ['perm-1', 'perm-2'],
      roundTripComplete: false,
    })).toEqual(['perm-1', 'perm-2'])
  })

  it('preserves a completed round-trip flag when merging picker ids back into the draft', () => {
    const draft: ReviewDraft = {
      noteId: 'note-1',
      title: 'Draft title',
      content: 'Draft content',
      sourceId: 'source-2',
      ownWords: true,
      linkedIds: ['perm-1'],
      roundTripComplete: true,
    }

    expect(mergeLinkedIdsIntoReviewDraft(draft, ['perm-2'])).toEqual({
      ...draft,
      linkedIds: ['perm-2'],
      roundTripComplete: true,
    })
  })
})
