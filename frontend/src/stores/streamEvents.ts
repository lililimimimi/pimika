/**
 * Turns one streamed event from the backend into the store fields it changes.
 * Pure: it reads the state it is given and returns a patch, so it can be tested without a store.
 */
import type { ExecutionPreview } from '@/components/chat/ExecutionPreviewCard'
import type { FileChange, Message, SSEEventData, TokenUsage, ToolCall, ToolResult } from '@/types'
import type { AgentStatus, SessionSnapshot } from '@/stores/chatStore'

/** The parts of the store a stream event can read */
export type StreamState = {
  messages: Message[]
  sessions: SessionSnapshot[]
  activeId: string
}

/** The store fields one event can change */
export type StreamPatch = Partial<{
  messages: Message[]
  agentStatus: AgentStatus
  lastEventAt: number
  tokenUsage: TokenUsage
  sessions: SessionSnapshot[]
  executionPreview: ExecutionPreview | null
  error: string | null
}>

/** Returns a copy of the list with its last message changed */
function changeLast(messages: Message[], change: (m: Message) => Message): Message[] {
  const updated = [...messages]
  const lastIdx = messages.length - 1
  updated[lastIdx] = change(updated[lastIdx])
  return updated
}

/**
 * Adds a change to a reply's list. A file already in the list keeps its first "before" and
 * its "isNew", and takes the newer "after", so one file shows once, from its start to its end.
 */
function mergeFileChange(list: FileChange[], change: FileChange): FileChange[] {
  if (!list.some((c) => c.path === change.path)) return [...list, change]
  return list.map((c) => (c.path === change.path ? { ...c, after: change.after } : c))
}

export function streamEventPatch(state: StreamState, event: SSEEventData): StreamPatch {
  switch (event.event) {
    case 'text':
      return {
        messages: changeLast(state.messages, (m) => ({ ...m, content: m.content + event.data.content })),
      }

    case 'tool_call': {
      const tc: ToolCall = {
        toolCallId: event.data.tool_call_id,
        toolName: event.data.tool_name,
        arguments: event.data.arguments,
      }
      return {
        messages: changeLast(state.messages, (m) => ({ ...m, toolCalls: [...(m.toolCalls ?? []), tc] })),
        agentStatus: 'tool_calling',
        lastEventAt: Date.now(),
      }
    }

    case 'tool_result': {
      const tr: ToolResult = {
        toolCallId: event.data.tool_call_id,
        output: event.data.output,
        isError: event.data.is_error,
      }
      return {
        messages: changeLast(state.messages, (m) => ({ ...m, toolResults: [...(m.toolResults ?? []), tr] })),
      }
    }

    case 'file_change': {
      const change: FileChange = {
        path: event.data.path,
        before: event.data.before,
        after: event.data.after,
        isNew: event.data.is_new,
      }
      return {
        messages: changeLast(state.messages, (m) => ({
          ...m,
          fileChanges: mergeFileChange(m.fileChanges ?? [], change),
        })),
      }
    }

    case 'usage': {
      const usage: TokenUsage = {
        inputTokens: event.data.input_tokens,
        outputTokens: event.data.output_tokens,
      }
      return {
        tokenUsage: usage,
        sessions: state.sessions.map((s) => (s.id === state.activeId ? { ...s, tokenUsage: usage } : s)),
      }
    }

    case 'execution_preview': {
      const ep: ExecutionPreview = {
        previewId: event.data.preview_id as string,
        steps: event.data.steps as string[],
        hasWriteOps: event.data.has_write_ops as boolean,
        canRemember: event.data.can_remember === true,
      }
      return { executionPreview: ep }
    }

    case 'error': {
      // Drop the empty reply placeholder, so a failed turn leaves no blank bubble
      const last = state.messages[state.messages.length - 1]
      const empty = last?.role === 'assistant' && !last.content && !last.toolCalls?.length
      return {
        messages: empty ? state.messages.slice(0, -1) : state.messages,
        error: event.data.message,
        agentStatus: 'idle',
      }
    }

    case 'done':
      return { agentStatus: 'idle' }

    default:
      return {}
  }
}

/**
 * Clears the execution preview card only when it is the one that was answered. A newer card
 * may already have arrived (the agent asks again right after an answer), and must stay.
 */
export function clearPreviewPatch(
  state: { executionPreview: ExecutionPreview | null },
  previewId: string,
): StreamPatch {
  return state.executionPreview?.previewId === previewId ? { executionPreview: null } : {}
}
