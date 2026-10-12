import { describe, it, expect } from 'vitest'
import { clearPreviewPatch, streamEventPatch, type StreamState } from '../streamEvents'
import type { SSEEventData } from '@/types'

const session = {
  id: 's1',
  title: 'New',
  messages: [],
  tokenUsage: { inputTokens: 0, outputTokens: 0 },
} as never

function stateWith(messages: StreamState['messages']): StreamState {
  return { messages, sessions: [session], activeId: 's1' }
}

const reply = (content = '') => ({ id: 'a1', role: 'assistant' as const, content })

describe('streamEventPatch', () => {
  it('appends streamed text to the last message', () => {
    const patch = streamEventPatch(stateWith([reply('Hel')]), {
      event: 'text',
      data: { content: 'lo' },
    } as SSEEventData)
    expect(patch.messages?.[0].content).toBe('Hello')
  })

  it('adds a tool call to the last message and marks the agent as calling a tool', () => {
    const event = {
      event: 'tool_call',
      data: { tool_call_id: 't1', tool_name: 'bash', arguments: { command: 'ls' } },
    } as SSEEventData
    const patch = streamEventPatch(stateWith([reply()]), event)
    expect(patch.messages?.[0].toolCalls).toEqual([
      { toolCallId: 't1', toolName: 'bash', arguments: { command: 'ls' } },
    ])
    expect(patch.agentStatus).toBe('tool_calling')
  })

  it('adds a tool result to the last message', () => {
    const event = {
      event: 'tool_result',
      data: { tool_call_id: 't1', output: 'ok', is_error: false },
    } as SSEEventData
    const patch = streamEventPatch(stateWith([reply()]), event)
    expect(patch.messages?.[0].toolResults).toEqual([{ toolCallId: 't1', output: 'ok', isError: false }])
  })

  it('updates token usage on the store and on the active session', () => {
    const event = { event: 'usage', data: { input_tokens: 5, output_tokens: 7 } } as SSEEventData
    const patch = streamEventPatch(stateWith([reply()]), event)
    expect(patch.tokenUsage).toEqual({ inputTokens: 5, outputTokens: 7 })
    expect(patch.sessions?.[0]).toMatchObject({ tokenUsage: { inputTokens: 5, outputTokens: 7 } })
  })

  it('keeps an execution preview for the card to show', () => {
    const event = {
      event: 'execution_preview',
      data: { preview_id: 'x', steps: ['Edit a'], has_write_ops: true },
    } as SSEEventData
    const patch = streamEventPatch(stateWith([reply()]), event)
    expect(patch.executionPreview).toEqual({
      previewId: 'x',
      steps: ['Edit a'],
      hasWriteOps: true,
      canRemember: false,
    })
  })

  it('removes the empty reply placeholder on error and sets the error', () => {
    const event = { event: 'error', data: { message: 'out of usage' } } as SSEEventData
    const patch = streamEventPatch(stateWith([{ id: 'u1', role: 'user', content: 'hi' }, reply()]), event)
    expect(patch.messages).toEqual([{ id: 'u1', role: 'user', content: 'hi' }])
    expect(patch.error).toBe('out of usage')
    expect(patch.agentStatus).toBe('idle')
  })

  it('keeps a reply that already has text when an error arrives', () => {
    const event = { event: 'error', data: { message: 'boom' } } as SSEEventData
    const patch = streamEventPatch(stateWith([reply('partial answer')]), event)
    expect(patch.messages?.[0].content).toBe('partial answer')
  })

  it('goes back to idle when done', () => {
    const patch = streamEventPatch(stateWith([reply()]), { event: 'done', data: {} } as SSEEventData)
    expect(patch).toEqual({ agentStatus: 'idle' })
  })

  it('changes nothing for an unknown event', () => {
    const patch = streamEventPatch(stateWith([reply()]), {
      event: 'something_new',
      data: {},
    } as unknown as SSEEventData)
    expect(patch).toEqual({})
  })
})

describe('streamEventPatch: file_change', () => {
  const fileChange = (path: string, before: string, after: string, isNew = false) =>
    ({
      event: 'file_change',
      data: { path, before, after, is_new: isNew },
    }) as SSEEventData

  it('attaches the change to the last message, with camelCase fields', () => {
    const patch = streamEventPatch(stateWith([reply()]), fileChange('/w/a.txt', 'old\n', 'new\n'))
    expect(patch.messages?.[0].fileChanges).toEqual([
      { path: '/w/a.txt', before: 'old\n', after: 'new\n', isNew: false },
    ])
  })

  it('keeps the first before and the last after when one file changes twice in a reply', () => {
    const once = streamEventPatch(stateWith([reply()]), fileChange('/w/a.txt', 'v0', 'v1'))
    const twice = streamEventPatch(stateWith(once.messages ?? []), fileChange('/w/a.txt', 'v1', 'v2'))
    expect(twice.messages?.[0].fileChanges).toEqual([
      { path: '/w/a.txt', before: 'v0', after: 'v2', isNew: false },
    ])
  })

  it('lists different files in the order they changed', () => {
    const first = streamEventPatch(stateWith([reply()]), fileChange('/w/a.txt', 'a0', 'a1'))
    const second = streamEventPatch(stateWith(first.messages ?? []), fileChange('/w/b.txt', '', 'b1', true))
    expect(second.messages?.[0].fileChanges).toEqual([
      { path: '/w/a.txt', before: 'a0', after: 'a1', isNew: false },
      { path: '/w/b.txt', before: '', after: 'b1', isNew: true },
    ])
  })

  it('does not touch changes already on an earlier message', () => {
    const earlier = {
      ...reply('old reply'),
      id: 'a0',
      fileChanges: [{ path: '/w/a.txt', before: 'x', after: 'y', isNew: false }],
    }
    const patch = streamEventPatch(stateWith([earlier, reply()]), fileChange('/w/b.txt', '', 'z', true))
    expect(patch.messages?.[0].fileChanges).toEqual(earlier.fileChanges)
    expect(patch.messages?.[1].fileChanges).toEqual([
      { path: '/w/b.txt', before: '', after: 'z', isNew: true },
    ])
  })
})

describe('clearPreviewPatch', () => {
  const preview = (previewId: string) => ({ previewId, steps: ['step'], hasWriteOps: true })

  it('clears the card that was answered', () => {
    expect(clearPreviewPatch({ executionPreview: preview('a') }, 'a')).toEqual({ executionPreview: null })
  })

  it('keeps a newer card that arrived before the answer to the old one was handled', () => {
    expect(clearPreviewPatch({ executionPreview: preview('b') }, 'a')).toEqual({})
  })

  it('does nothing when no card is showing', () => {
    expect(clearPreviewPatch({ executionPreview: null }, 'a')).toEqual({})
  })
})

describe('streamEventPatch: execution_preview remember option', () => {
  it('keeps whether the step can be allowed from now on', () => {
    const patch = streamEventPatch(stateWith([reply()]), {
      event: 'execution_preview',
      data: { preview_id: 'pv-1', steps: ['Run npm test'], has_write_ops: true, can_remember: true },
    } as SSEEventData)
    expect(patch.executionPreview).toEqual({
      previewId: 'pv-1',
      steps: ['Run npm test'],
      hasWriteOps: true,
      canRemember: true,
    })
  })
})
