import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ApprovalStore } from './approvals.js'

describe('ApprovalStore', () => {
  let dir: string
  let file: string

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'approvals-'))
    file = join(dir, 'approved-commands.json')
  })

  after(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('approves a command only for the project where it was approved', () => {
    const store = new ApprovalStore(file)
    store.remember('/work/web', 'npm test')
    assert.equal(store.isApproved('/work/web', 'npm test'), true)
    assert.equal(store.isApproved('/work/other', 'npm test'), false)
  })

  it('matches the exact command, ignoring extra spaces around it', () => {
    const store = new ApprovalStore(file)
    store.remember('/work/web', 'npm   run build')
    assert.equal(store.isApproved('/work/web', '  npm run build '), true)
    assert.equal(store.isApproved('/work/web', 'npm run build && rm -rf x'), false)
  })

  it('keeps approvals on disk, so they survive a restart', () => {
    const own = join(dir, 'restart.json')
    new ApprovalStore(own).remember('/work/web', 'npm run lint')
    const reloaded = new ApprovalStore(own)
    assert.equal(reloaded.isApproved('/work/web', 'npm run lint'), true)
    const saved = JSON.parse(readFileSync(own, 'utf8'))
    assert.deepEqual(saved['/work/web'], ['npm run lint'])
  })

  it('treats a missing file as no approvals', () => {
    const store = new ApprovalStore(join(dir, 'missing.json'))
    assert.equal(store.isApproved('/work/web', 'npm test'), false)
  })
})
