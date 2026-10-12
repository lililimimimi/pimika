/**
 * Line-by-line diff of two texts, from the longest common subsequence of their lines.
 * Pure, so it can be tested without rendering.
 */

export type DiffLine = {
  type: 'same' | 'add' | 'remove'
  text: string
}

/**
 * Largest table the comparison may build (lines of before × lines of after, after trimming
 * the unchanged start and end). Past this, the diff is skipped rather than using lots of memory.
 */
export const MAX_DIFF_CELLS = 4_000_000

function toLines(text: string): string[] {
  if (text === '') return []
  return text.replace(/\n$/, '').split('\n')
}

/**
 * Diff of `before` against `after`. Returns null when the middle part that actually changed
 * is too large to compare.
 */
export function diffLines(before: string, after: string): DiffLine[] | null {
  const a = toLines(before)
  const b = toLines(after)

  // Unchanged start and end lines need no table
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }

  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)
  const middle = diffMiddle(midA, midB)
  if (!middle) return null

  const head: DiffLine[] = a.slice(0, start).map((text) => ({ type: 'same', text }))
  const tail: DiffLine[] = a.slice(endA).map((text) => ({ type: 'same', text }))
  return [...head, ...middle, ...tail]
}

function diffMiddle(a: string[], b: string[]): DiffLine[] | null {
  const n = a.length
  const m = b.length
  if (n * m > MAX_DIFF_CELLS) return null

  // lcs[i][j] = length of the common subsequence of a[i..] and b[j..]
  const width = m + 1
  const lcs = new Uint32Array((n + 1) * width)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * width + j] =
        a[i] === b[j]
          ? lcs[(i + 1) * width + j + 1] + 1
          : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1])
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] })
      i++
      j++
    } else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
      out.push({ type: 'remove', text: a[i] })
      i++
    } else {
      out.push({ type: 'add', text: b[j] })
      j++
    }
  }
  while (i < n) out.push({ type: 'remove', text: a[i++] })
  while (j < m) out.push({ type: 'add', text: b[j++] })
  return out
}
