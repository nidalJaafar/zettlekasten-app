import { describe, expect, it } from 'vitest'
import type { Note, NoteLink } from '@zettelkasten/core'
import { buildNeighborhood } from './graph'

function makeNote(id: string): Note {
  return {
    id,
    type: 'permanent',
    title: id,
    content: '',
    created_at: 0,
    updated_at: 0,
    source_id: null,
    own_words_confirmed: 0,
    deleted_at: null,
    processed_at: null,
  }
}

function makeLink(from: string, to: string): NoteLink {
  return { from_note_id: from, to_note_id: to, created_at: 0 }
}

describe('buildNeighborhood', () => {
  it('returns only the focus node when no links exist', () => {
    const notes = [makeNote('a'), makeNote('b'), makeNote('c')]
    const result = buildNeighborhood('a', notes, [])
    expect(result.notes.map((n) => n.id)).toEqual(['a'])
    expect(result.links).toEqual([])
  })

  it('returns empty when focusNoteId is not in notes', () => {
    const notes = [makeNote('a')]
    const result = buildNeighborhood('missing', notes, [])
    expect(result.notes).toEqual([])
    expect(result.links).toEqual([])
  })

  it('returns direct neighbors at depth 1', () => {
    const notes = [makeNote('a'), makeNote('b'), makeNote('c'), makeNote('d')]
    const links = [makeLink('a', 'b'), makeLink('a', 'c')]
    const result = buildNeighborhood('a', notes, links, 1)
    const ids = new Set(result.notes.map((n) => n.id))
    expect(ids).toEqual(new Set(['a', 'b', 'c']))
    expect(result.links).toEqual([makeLink('a', 'b'), makeLink('a', 'c')])
  })

  it('follows links bidirectionally', () => {
    const notes = [makeNote('a'), makeNote('b'), makeNote('c')]
    const links = [makeLink('b', 'a')]
    const result = buildNeighborhood('a', notes, links, 1)
    const ids = new Set(result.notes.map((n) => n.id))
    expect(ids).toEqual(new Set(['a', 'b']))
    expect(result.links).toEqual([makeLink('b', 'a')])
  })

  it('expands to depth 2', () => {
    const notes = [makeNote('a'), makeNote('b'), makeNote('c'), makeNote('d')]
    const links = [makeLink('a', 'b'), makeLink('b', 'c'), makeLink('c', 'd')]
    const result = buildNeighborhood('a', notes, links, 2)
    const ids = new Set(result.notes.map((n) => n.id))
    expect(ids).toEqual(new Set(['a', 'b', 'c']))
    expect(result.links).toEqual([makeLink('a', 'b'), makeLink('b', 'c')])
  })

  it('defaults maxDepth to 1', () => {
    const notes = [makeNote('a'), makeNote('b'), makeNote('c')]
    const links = [makeLink('a', 'b'), makeLink('b', 'c')]
    const result = buildNeighborhood('a', notes, links)
    const ids = new Set(result.notes.map((n) => n.id))
    expect(ids).toEqual(new Set(['a', 'b']))
  })

  it('only includes links between visited nodes', () => {
    const notes = [makeNote('a'), makeNote('b'), makeNote('c'), makeNote('d')]
    const links = [
      makeLink('a', 'b'),
      makeLink('b', 'c'),
      makeLink('c', 'd'),
    ]
    const result = buildNeighborhood('a', notes, links, 1)
    expect(result.links).toEqual([makeLink('a', 'b')])
  })

  it('handles cycles without infinite loop', () => {
    const notes = [makeNote('a'), makeNote('b'), makeNote('c')]
    const links = [makeLink('a', 'b'), makeLink('b', 'c'), makeLink('c', 'a')]
    const result = buildNeighborhood('a', notes, links, 2)
    const ids = new Set(result.notes.map((n) => n.id))
    expect(ids).toEqual(new Set(['a', 'b', 'c']))
    expect(result.links).toHaveLength(3)
  })
})
