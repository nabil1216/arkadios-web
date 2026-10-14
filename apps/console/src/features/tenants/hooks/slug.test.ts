import { describe, expect, it } from 'vitest'
import { slugify } from './slug'

describe('slugify', () => {
  it.each([
    ['Harbor Lane Advisors', 'harbor-lane-advisors'],
    ['Marlow & Finch Partners', 'marlow-and-finch-partners'],
    ['  Spaces   everywhere  ', 'spaces-everywhere'],
    ['Under_score & Dots.Co', 'under-score-and-dots-co'],
    ['Ünïcode Wealth', 'n-code-wealth'],
    ['---', ''],
    ['', ''],
  ])('%j becomes %j', (name, slug) => {
    expect(slugify(name)).toBe(slug)
  })

  it('stops at 30 characters without leaving a trailing hyphen', () => {
    const slug = slugify('Sterling Hollow Family Office Trust Company')
    expect(slug.length).toBeLessThanOrEqual(30)
    expect(slug).toBe('sterling-hollow-family-office')
    expect(slugify('a'.repeat(29) + ' bbb')).toBe('a'.repeat(29))
  })
})
