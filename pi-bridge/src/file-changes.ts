/**
 * Records what a file looked like before and after the agent changed it, so the frontend
 * can show a diff of each turn. Independent of git: the content is read straight from disk.
 */

import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { log } from './logger.js'

/** A file change captured before its tool call runs */
export type BeforeChange = {
  /** Absolute path of the file the tool is about to change */
  path: string
  /** Content before the change; empty for a new file */
  before: string
  /** True when the file did not exist before the change */
  is_new: boolean
}

/** A finished file change: what the file looked like before and after one tool call */
export type FileChange = BeforeChange & {
  /** Content after the tool call; empty if the file no longer exists */
  after: string
}

type ToolArgs = Record<string, unknown>

/** Only these tools write whole files by path; shell commands are not tracked here. */
const FILE_WRITE_TOOLS = new Set(['edit', 'write'])

/** Changes captured before a tool call runs, waiting for its result, keyed by tool call id */
export type PendingChanges = Map<string, BeforeChange>

/**
 * Read the target file's current content for an edit or write call about to run.
 * Returns null for tools that do not change files, or calls with no path.
 * Errors other than "file does not exist" are thrown, not hidden.
 */
export async function captureBeforeChange(
  cwd: string,
  toolName: string,
  args: ToolArgs,
): Promise<BeforeChange | null> {
  if (!FILE_WRITE_TOOLS.has(toolName)) return null
  const target = pickPath(args)
  if (!target) return null

  const path = resolve(cwd, target)
  try {
    const before = await readFile(path, 'utf8')
    return { path, before, is_new: false }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { path, before: '', is_new: true }
    }
    throw err
  }
}

/**
 * Capture the before-content of a file change and hold it until the tool call ends.
 * A failure here is logged and skipped: the agent keeps running, it just gets no diff
 * for this one call.
 */
export async function recordBeforeChange(
  pending: PendingChanges,
  cwd: string,
  toolCallId: string,
  toolName: string,
  args: ToolArgs,
): Promise<void> {
  try {
    const change = await captureBeforeChange(cwd, toolName, args)
    if (change) pending.set(toolCallId, change)
  } catch (err) {
    log.warn(`cannot record before-content for ${toolName} (${toolCallId}): ${String(err)}`)
  }
}

/**
 * Finish the change held for a tool call: remove it from pending, and read the file's
 * content after the call. A failed call left the file as it was, so it yields nothing.
 * Like recordBeforeChange, a read failure is logged and skipped rather than failing the turn.
 */
export function finishChange(
  pending: PendingChanges,
  toolCallId: string,
  isError: boolean,
): FileChange | undefined {
  const change = pending.get(toolCallId)
  pending.delete(toolCallId)
  if (!change || isError) return undefined
  try {
    return { ...change, after: readCurrent(change.path) }
  } catch (err) {
    log.warn(`cannot read after-content for ${change.path} (${toolCallId}): ${String(err)}`)
    return undefined
  }
}

function readCurrent(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return ''
    throw err
  }
}

function pickPath(args: ToolArgs): string | undefined {
  const value = args.path ?? args.file_path ?? args.filePath
  return typeof value === 'string' && value.length > 0 ? value : undefined
}
