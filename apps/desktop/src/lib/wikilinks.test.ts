import { describe, expect, it } from 'vitest'
import { getWikilinkTarget } from './wikilinks'

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
