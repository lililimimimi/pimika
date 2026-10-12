import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { captureBeforeChange, finishChange, recordBeforeChange } from './file-changes.js'

describe('captureBeforeChange', () => {
  let root: string

  before(() => {
    root = mkdtempSync(join(tmpdir(), 'file-changes-'))
    writeFileSync(join(root, 'app.txt'), 'line one\nline two\n')
  })

  after(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('records the content before an edit of an existing file', async () => {
    const change = await captureBeforeChange(root, 'edit', { path: 'app.txt' })
    assert.deepEqual(change, {
      path: join(root, 'app.txt'),
      before: 'line one\nline two\n',
      is_new: false,
    })
  })

  it('marks a write to a missing file as a new file with empty before-content', async () => {
    const change = await captureBeforeChange(root, 'write', { path: 'fresh/new.txt' })
    assert.deepEqual(change, {
      path: join(root, 'fresh/new.txt'),
      before: '',
      is_new: true,
    })
  })

  it('returns null for tools that do not change files', async () => {
    assert.equal(await captureBeforeChange(root, 'read', { path: 'app.txt' }), null)
    assert.equal(await captureBeforeChange(root, 'bash', { command: 'rm app.txt' }), null)
  })

  it('returns null when an edit call has no path', async () => {
    assert.equal(await captureBeforeChange(root, 'edit', {}), null)
  })
})

describe('pending file changes', () => {
  let root: string

  before(() => {
    root = mkdtempSync(join(tmpdir(), 'pending-changes-'))
    writeFileSync(join(root, 'notes.md'), 'draft\n')
  })

  after(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('pairs the before-content with the content after the tool call ends', async () => {
    const pending = new Map()
    await recordBeforeChange(pending, root, 'call-1', 'edit', { path: 'notes.md' })
    writeFileSync(join(root, 'notes.md'), 'final\n')
    assert.deepEqual(finishChange(pending, 'call-1', false), {
      path: join(root, 'notes.md'),
      before: 'draft\n',
      after: 'final\n',
      is_new: false,
    })
    assert.equal(pending.size, 0, 'finishing removes the entry')
  })

  it('reports nothing when the tool call failed, since the file was not changed', async () => {
    const pending = new Map()
    await recordBeforeChange(pending, root, 'call-3', 'edit', { path: 'notes.md' })
    assert.equal(finishChange(pending, 'call-3', true), undefined)
    assert.equal(pending.size, 0)
  })

  it('stores nothing for a read-only tool call', async () => {
    const pending = new Map()
    await recordBeforeChange(pending, root, 'call-2', 'read', { path: 'notes.md' })
    assert.equal(pending.size, 0)
  })
})
