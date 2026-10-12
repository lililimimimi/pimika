import { describe, it, expect } from 'vitest'
import { diffLines, MAX_DIFF_CELLS } from '@/lib/lineDiff'

describe('diffLines', () => {
  it('marks a changed line as removed then added, and keeps the rest', () => {
    expect(diffLines('a\nb\nc\n', 'a\nB\nc\n')).toEqual([
      { type: 'same', text: 'a' },
      { type: 'remove', text: 'b' },
      { type: 'add', text: 'B' },
      { type: 'same', text: 'c' },
    ])
  })

  it('shows a new file as all lines added', () => {
    expect(diffLines('', 'x\ny\n')).toEqual([
      { type: 'add', text: 'x' },
      { type: 'add', text: 'y' },
    ])
  })

  it('shows an emptied file as all lines removed', () => {
    expect(diffLines('x\ny\n', '')).toEqual([
      { type: 'remove', text: 'x' },
      { type: 'remove', text: 'y' },
    ])
  })

  it('reports only same lines when nothing changed', () => {
    expect(diffLines('one\ntwo', 'one\ntwo')).toEqual([
      { type: 'same', text: 'one' },
      { type: 'same', text: 'two' },
    ])
  })

  it('finds an inserted line in the middle without marking the others', () => {
    expect(diffLines('a\nc\n', 'a\nb\nc\n')).toEqual([
      { type: 'same', text: 'a' },
      { type: 'add', text: 'b' },
      { type: 'same', text: 'c' },
    ])
  })

  it('gives up on files too large to compare line by line', () => {
    const side = Array.from({ length: 3000 }, (_, i) => `line ${i}`).join('\n')
    const other = Array.from({ length: 3000 }, (_, i) => `changed ${i}`).join('\n')
    expect(3000 * 3000).toBeGreaterThan(MAX_DIFF_CELLS)
    expect(diffLines(side, other)).toBeNull()
  })
})
