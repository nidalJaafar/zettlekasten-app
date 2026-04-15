import { describe, expect, it } from 'vitest'
import {
  extractWikilinkTitles,
  rewriteTitleBasedWikilinks,
  getActiveWikilinkQuery,
  insertWikilinkSelection,
  getWikilinkText,
} from '../src/wikilinks'

describe('extractWikilinkTitles', () => {
  it('extracts simple wikilinks', () => {
    expect(extractWikilinkTitles('See [[Alpha]] and [[Beta]]')).toEqual(['Alpha', 'Beta'])
  })

  it('extracts wikilinks with aliases', () => {
    expect(extractWikilinkTitles('[[Alpha|display text]]')).toEqual(['Alpha'])
  })

  it('returns empty array when no wikilinks', () => {
    expect(extractWikilinkTitles('No links here')).toEqual([])
  })

  it('handles multiple identical titles', () => {
    expect(extractWikilinkTitles('[[Foo]] and [[Foo]] again')).toEqual(['Foo', 'Foo'])
  })
})

describe('rewriteTitleBasedWikilinks', () => {
  it('renames matching wikilinks', () => {
    expect(rewriteTitleBasedWikilinks('See [[Old Title]] here', 'Old Title', 'New Title'))
      .toBe('See [[New Title]] here')
  })

  it('preserves aliases when renaming', () => {
    expect(rewriteTitleBasedWikilinks('[[Old|display]]', 'Old', 'New'))
      .toBe('[[New|display]]')
  })

  it('does not rename non-matching wikilinks', () => {
    expect(rewriteTitleBasedWikilinks('[[Other]] and [[Old]]', 'Old', 'New'))
      .toBe('[[Other]] and [[New]]')
  })

  it('returns unchanged when old equals new', () => {
    expect(rewriteTitleBasedWikilinks('[[Same]]', 'Same', 'Same')).toBe('[[Same]]')
  })

  it('returns unchanged when old title is empty', () => {
    expect(rewriteTitleBasedWikilinks('[[Foo]]', '', 'Bar')).toBe('[[Foo]]')
  })
})

describe('getActiveWikilinkQuery', () => {
  it('detects open wikilink at cursor', () => {
    const result = getActiveWikilinkQuery('See [[Al', 8)
    expect(result).toEqual({ from: 4, to: 8, query: 'Al' })
  })

  it('returns null when no open wikilink', () => {
    expect(getActiveWikilinkQuery('No link', 7)).toBeNull()
  })

  it('returns null when wikilink is already closed', () => {
    expect(getActiveWikilinkQuery('See [[Alpha]] done', 14)).toBeNull()
  })

  it('returns null when query spans multiple lines', () => {
    expect(getActiveWikilinkQuery('See [[\nline', 10)).toBeNull()
  })

  it('finds the nearest open bracket', () => {
    const result = getActiveWikilinkQuery('[[Alpha]] and [[Bet', 20)
    expect(result).toEqual({ from: 14, to: 20, query: 'Bet' })
  })
})

describe('insertWikilinkSelection', () => {
  it('replaces open wikilink with completed one', () => {
    const query = getActiveWikilinkQuery('See [[Al', 8)!
    const result = insertWikilinkSelection('See [[Al', query, 'Alpha Note')
    expect(result.value).toBe('See [[Alpha Note]]')
    expect(result.cursor).toBe(18)
  })

  it('preserves text after the replaced portion', () => {
    const query = getActiveWikilinkQuery('[[Al more text', 4)!
    const result = insertWikilinkSelection('[[Al more text', query, 'Alpha')
    expect(result.value).toBe('[[Alpha]] more text')
  })
})

describe('getWikilinkText', () => {
  it('returns the text before the pipe', () => {
    expect(getWikilinkText('Alpha|display')).toBe('Alpha')
  })

  it('returns the full text when no pipe', () => {
    expect(getWikilinkText('Alpha')).toBe('Alpha')
  })

  it('trims whitespace', () => {
    expect(getWikilinkText(' Alpha ')).toBe('Alpha')
  })
})
