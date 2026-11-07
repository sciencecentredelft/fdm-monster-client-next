import { describe, expect, it } from 'vitest'
import { middleTruncate } from '@/utils/middle-truncate.util'

describe('middleTruncate', () => {
  const measure = (text: string) => Array.from(text).length * 10

  it('retains exact-fit and short names', () => {
    expect(middleTruncate('part.gcode', 100, measure)).toBe('part.gcode')
    expect(middleTruncate('part.gcode', 300, measure)).toBe('part.gcode')
  })

  it('removes the middle while keeping the start and extension within the measured width', () => {
    const result = middleTruncate('prefix-very-long-middle-part.gcode', 140, measure)
    expect(result).toBe('prefix\u2026t.gcode')
    expect(measure(result)).toBeLessThanOrEqual(140)
    expect(result.endsWith('.gcode')).toBe(true)
    expect(measure(result.replace('\u2026', 'ab'))).toBeGreaterThan(140)
  })

  it('uses measured character widths rather than a character-count approximation', () => {
    const variableMeasure = (text: string) => Array.from(text).reduce((sum, character) => sum + (character === 'W' ? 20 : 5), 0)
    const text = 'WWWW-narrow-middle.gcode'
    for (const width of [30, 60, 100, 150]) {
      const result = middleTruncate(text, width, variableMeasure)
      expect(variableMeasure(result)).toBeLessThanOrEqual(width)
      expect(result).toContain('\u2026')
    }
  })

  it('does not split Unicode code points', () => {
    expect(middleTruncate('\u{1F600}\u{1F600}middle\u{1F600}\u{1F600}', 50, measure))
      .toBe('\u{1F600}\u{1F600}\u2026\u{1F600}\u{1F600}')
  })

  it('handles widths too small for text', () => {
    expect(middleTruncate('long.gcode', 10, measure)).toBe('\u2026')
    expect(middleTruncate('long.gcode', 9, measure)).toBe('')
  })
})
