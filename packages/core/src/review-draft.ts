import type { Note } from './types'

export type ReviewDraft = {
  noteId: string
  title: string
  content: string
  sourceId: string | null
  ownWords: boolean
  linkedIds: string[]
  roundTripComplete: boolean
}

function getActiveReviewDraft(note: Note, draft: ReviewDraft | null): ReviewDraft | null {
  return draft?.noteId === note.id ? draft : null
}

export function getInitialReviewState(note: Note, draft: ReviewDraft | null): {
  title: string
  content: string
  sourceId: string | null
  ownWords: boolean
  linkedIds: string[]
} {
  const activeDraft = getActiveReviewDraft(note, draft)

  return {
    title: activeDraft?.title ?? note.title,
    content: activeDraft?.content ?? note.content,
    sourceId: activeDraft?.sourceId ?? note.source_id,
    ownWords: activeDraft?.ownWords ?? note.own_words_confirmed === 1,
    linkedIds: activeDraft?.linkedIds ?? [],
  }
}

export function consumeReviewDraft(note: Note, draft: ReviewDraft | null): {
  initialState: ReturnType<typeof getInitialReviewState>
  remainingDraft: ReviewDraft | null
} {
  return {
    initialState: getInitialReviewState(note, draft),
    remainingDraft: consumeCompletedReviewDraft(note, draft),
  }
}

export function consumeCompletedReviewDraft(note: Note, draft: ReviewDraft | null): ReviewDraft | null {
  const activeDraft = getActiveReviewDraft(note, draft)
  return activeDraft?.roundTripComplete ? null : draft
}

export function getCompletedReviewDraftLinkedIds(note: Note, draft: ReviewDraft | null): string[] | null {
  const activeDraft = getActiveReviewDraft(note, draft)
  return activeDraft?.roundTripComplete ? activeDraft.linkedIds : null
}

export function getInitialLinkPickerSelection(draft: ReviewDraft | null): string[] {
  return draft?.linkedIds ?? []
}

export function mergeLinkedIdsIntoReviewDraft(draft: ReviewDraft, linkedIds: string[]): ReviewDraft {
  return {
    ...draft,
    linkedIds,
    roundTripComplete: draft.roundTripComplete,
  }
}
