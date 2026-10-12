/**
 * Commands the user chose to always allow in a project ("allow this command from now on").
 * Kept in a file, so the choice survives a restart. Matching is exact, after trimming the ends
 * and collapsing inner spaces: a longer command that merely starts the same does not match.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { log } from './logger.js'

type Approvals = Record<string, string[]>

function normalize(command: string): string {
  return command.trim().replace(/\s+/g, ' ')
}

export class ApprovalStore {
  private approvals: Approvals

  constructor(private readonly file: string) {
    this.approvals = this.load()
  }

  isApproved(projectPath: string, command: string): boolean {
    return (this.approvals[projectPath] ?? []).includes(normalize(command))
  }

  remember(projectPath: string, command: string): void {
    const list = this.approvals[projectPath] ?? []
    const entry = normalize(command)
    if (list.includes(entry)) return
    this.approvals[projectPath] = [...list, entry]
    this.save()
  }

  private load(): Approvals {
    if (!existsSync(this.file)) return {}
    try {
      return JSON.parse(readFileSync(this.file, 'utf8')) as Approvals
    } catch (err) {
      // A damaged file must not stop the bridge: approvals start empty, and this is logged
      log.warn(`cannot read approved commands from ${this.file}: ${String(err)}`)
      return {}
    }
  }

  private save(): void {
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file, JSON.stringify(this.approvals, null, 2) + '\n', 'utf8')
  }
}
