export function middleTruncate(text: string, width: number, measure: (text: string) => number): string {
  if (measure(text) <= width) return text
  const ellipsis = '\u2026'
  if (measure(ellipsis) > width) return ''
  const characters = Array.from(text)
  const candidate = (count: number) => {
    const end = Math.ceil(count / 2)
    return characters.slice(0, count - end).join('') + ellipsis
      + characters.slice(characters.length - end).join('')
  }
  let low = 0
  let high = characters.length - 1
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (measure(candidate(mid)) <= width) low = mid
    else high = mid - 1
  }
  return candidate(low)
}
