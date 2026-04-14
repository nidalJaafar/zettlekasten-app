import { describe, expect, it } from 'vitest'
import { FONT } from './theme'

describe('theme fonts', () => {
  it('uses the same Poppins stack for all UI text tokens', () => {
    expect(FONT.display).toBe(FONT.ui)
    expect(FONT.ui).toContain('Poppins')
  })

  it('uses Fira Code for markdown and code text', () => {
    expect(FONT.mono).toContain('Fira Code')
  })
})
