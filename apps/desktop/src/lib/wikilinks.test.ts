import { describe, expect, it } from 'vitest'
import { getWikilinkTarget, getActiveWikilinkQuery, insertWikilinkSelection } from './wikilinks'

describe('getWikilinkTarget', () => {
  it('resolves a wikilink when the event target is the inner text node', () => {
    const link = document.createElement('span')
    link.dataset.wikilink = 'Alpha Note'
    link.textContent = 'Alpha Note'

    const textNode = link.firstChild
    expect(textNode).toBeTruthy()
    expect(getWikilinkTarget(textNode)).toBe('Alpha Note')
  })
})

describe('getActiveWikilinkQuery', () => {
  it('detects an open wikilink query after double brackets', () => {
    expect(getActiveWikilinkQuery('See [[Al', 8)).toEqual({
      from: 4,
      to: 8,
      query: 'Al',
    })
  })

  it('returns null when the cursor is outside an unfinished wikilink', () => {
    expect(getActiveWikilinkQuery('See [[Alpha]] next', 5)).toBeNull()
  })

  it('returns null when there are no double brackets', () => {
    expect(getActiveWikilinkQuery('Just text', 9)).toBeNull()
  })

  it('returns null for completed wikilinks with no open query', () => {
    expect(getActiveWikilinkQuery('See [[Done]]', 12)).toBeNull()
  })

  it('detects a query starting right after the brackets', () => {
    expect(getActiveWikilinkQuery('[[', 2)).toEqual({
      from: 0,
      to: 2,
      query: '',
    })
  })

  it('returns null when the query spans multiple lines', () => {
    expect(getActiveWikilinkQuery('[[foo\nbar', 9)).toBeNull()
  })
})

describe('insertWikilinkSelection', () => {
  it('replaces the active query with a completed wikilink', () => {
    expect(insertWikilinkSelection('See [[Al', { from: 4, to: 8, query: 'Al' }, 'Alpha Note')).toEqual({
      value: 'See [[Alpha Note]]',
      cursor: 18,
    })
  })

  it('replaces text after the cursor correctly', () => {
    expect(insertWikilinkSelection('[[he world', { from: 0, to: 5, query: 'he ' }, 'Hello')).toEqual({
      value: '[[Hello]]world',
      cursor: 9,
    })
  })
})
