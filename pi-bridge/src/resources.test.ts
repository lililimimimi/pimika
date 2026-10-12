import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSessionResources } from './resources.js'

describe('createSessionResources', () => {
  it('gives the loader and the session the same settings manager, as the SDK default does', async () => {
    const root = mkdtempSync(join(tmpdir(), 'resources-'))
    try {
      const { resourceLoader, settingsManager } = await createSessionResources({
        cwd: root,
        agentDir: join(root, 'agent'),
        extensionFactories: [],
      })
      // The loader keeps its settings manager in a private field; read it to check the sharing
      const loaderSettings = (resourceLoader as unknown as { settingsManager: unknown }).settingsManager
      assert.equal(loaderSettings, settingsManager)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
