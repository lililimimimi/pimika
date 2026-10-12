/**
 * Resource loader for one chat session. It builds the loader the same way the SDK does by
 * default, with one shared settings manager, and adds our extensions and project rules.
 */

import { DefaultResourceLoader, SettingsManager } from '@earendil-works/pi-coding-agent'
import type { ExtensionFactory } from '@earendil-works/pi-coding-agent'

export async function createSessionResources(options: {
  cwd: string
  agentDir: string
  extensionFactories: ExtensionFactory[]
  /** Project and global rules, injected into the system prompt */
  rules?: string
}) {
  // One settings manager for the loader and the session, as the SDK's default setup shares one
  const settingsManager = SettingsManager.create(options.cwd, options.agentDir)
  const resourceLoader = new DefaultResourceLoader({
    cwd: options.cwd,
    agentDir: options.agentDir,
    settingsManager,
    extensionFactories: options.extensionFactories,
    appendSystemPrompt: options.rules ? [options.rules] : undefined,
  })
  await resourceLoader.reload()
  return { resourceLoader, settingsManager }
}
