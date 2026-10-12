import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AgentSession } from '@earendil-works/pi-coding-agent'
import { ApprovalStore } from './approvals.js'
import { PreviewRegistry } from './preview.js'

export const sessions = new Map<string, AgentSession>()

export const previewRegistry = new PreviewRegistry()

/** Commands the user allowed from now on, per project (kept in the Pi agent folder) */
export const approvals = new ApprovalStore(join(homedir(), '.pi', 'agent', 'approved-commands.json'))
