import { describe, it, expect } from 'vitest'
import { canPromoteToLiterature, canSavePermanentNote, validatePromotion } from '../src/enforce'
import type { Note, PromotionContext } from '../src/types'

const base: Note = {
  id: 'n1',
  type: 'fleeting',
  title: 'Test',
  content: '',
  created_at: 1000,
  updated_at: 1000,
  source_id: null,
  own_words_confirmed: 0,
  deleted_at: null,
}

describe('canPromoteToLiterature', () => {
  it('fails when note is not fleeting', () => {
    const r = canPromoteToLiterature({ ...base, type: 'literature' })
    expect(r.ok).toBe(false)
    expect((r as { ok: false; reason: string }).reason).toMatch(/only fleeting/i)
  })

  it('fails when source is not attached', () => {
    const r = canPromoteToLiterature(base)
    expect(r.ok).toBe(false)
    expect((r as { ok: false; reason: string }).reason).toMatch(/attach a source/i)
  })

  it('passes when fleeting and source attached', () => {
    const r = canPromoteToLiterature({ ...base, source_id: 'src-1' })
    expect(r.ok).toBe(true)
  })
})

describe('canSavePermanentNote', () => {
  const withLinks: PromotionContext = { linkedPermanentNoteIds: ['n2'], totalPermanentNotes: 1 }
  const noLinks: PromotionContext = { linkedPermanentNoteIds: [], totalPermanentNotes: 3 }
  const emptyGraph: PromotionContext = { linkedPermanentNoteIds: [], totalPermanentNotes: 0 }

  it('fails when own_words_confirmed is 0', () => {
    const r = canSavePermanentNote({ own_words_confirmed: 0 }, withLinks)
    expect(r.ok).toBe(false)
    expect((r as { ok: false; reason: string }).reason).toMatch(/own words/i)
  })

  it('fails when no links and permanent notes exist', () => {
    const r = canSavePermanentNote({ own_words_confirmed: 1 }, noLinks)
    expect(r.ok).toBe(false)
    expect((r as { ok: false; reason: string }).reason).toMatch(/link to at least one/i)
  })

  it('passes when own words confirmed and links provided', () => {
    const r = canSavePermanentNote({ own_words_confirmed: 1 }, withLinks)
    expect(r.ok).toBe(true)
  })

  it('waives link requirement when graph is empty (bootstrap)', () => {
    const r = canSavePermanentNote({ own_words_confirmed: 1 }, emptyGraph)
    expect(r.ok).toBe(true)
  })
})

describe('validatePromotion', () => {
  it('blocks fleeting → permanent skip', () => {
    const r = validatePromotion('fleeting', 'permanent')
    expect(r.ok).toBe(false)
  })

  it('allows fleeting → literature', () => {
    const r = validatePromotion('fleeting', 'literature')
    expect(r.ok).toBe(true)
  })

  it('allows literature → permanent', () => {
    const r = validatePromotion('literature', 'permanent')
    expect(r.ok).toBe(true)
  })
})
