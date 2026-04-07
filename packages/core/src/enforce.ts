import type { Note, PromotionContext, Result, NoteType } from './types'

export function canPromoteToLiterature(note: Note): Result {
  if (note.type !== 'fleeting') {
    return { ok: false, reason: 'Only fleeting notes can be promoted to literature notes.' }
  }
  if (!note.source_id) {
    return { ok: false, reason: 'Attach a source before promoting to a literature note.' }
  }
  return { ok: true }
}

export function canSavePermanentNote(
  note: Pick<Note, 'own_words_confirmed'>,
  context: PromotionContext
): Result {
  if (!note.own_words_confirmed) {
    return { ok: false, reason: 'Confirm this note is written in your own words.' }
  }
  if (context.totalPermanentNotes > 0 && context.linkedPermanentNoteIds.length === 0) {
    return { ok: false, reason: 'Link to at least one existing permanent note.' }
  }
  return { ok: true }
}

export function validatePromotion(from: NoteType, to: NoteType): Result {
  if (from === to) {
    return { ok: false, reason: 'Promotion must move a note forward to the next stage.' }
  }
  if (from === 'fleeting' && to === 'literature') return { ok: true }
  if (from === 'literature' && to === 'permanent') return { ok: true }
  if (from === 'fleeting' && to === 'permanent') {
    return {
      ok: false,
      reason: 'Fleeting notes cannot skip to permanent. Process through literature first.',
    }
  }
  return { ok: false, reason: 'Notes can only move forward one stage at a time.' }
}
