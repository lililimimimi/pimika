import { describe, it, expect } from 'vitest'
import { recordsToMessages, stopUnfinishedTools } from '../messageConversion'
import type { SessionRecord } from '@/lib/schemas'

const meta = { type: 'meta', id: 's1', title: 'chat' } as SessionRecord

describe('recordsToMessages', () => {
  it('restores a reply with its tool calls, results and file changes', () => {
    const records = [
      meta,
      { type: 'message', role: 'user', content: 'fix it' },
      {
        type: 'message',
        role: 'assistant',
        content: 'Done.',
        tool_calls: [{ tool_call_id: 't1', tool_name: 'edit', arguments: { path: 'a.txt' } }],
        tool_results: [{ tool_call_id: 't1', output: 'ok', is_error: false }],
        file_changes: [{ path: '/w/a.txt', before: 'old\n', after: 'new\n', is_new: false }],
      },
    ] as SessionRecord[]

    const [, reply] = recordsToMessages(records)

    expect(reply).toEqual({
      id: 'restored-2',
      role: 'assistant',
      content: 'Done.',
      toolCalls: [{ toolCallId: 't1', toolName: 'edit', arguments: { path: 'a.txt' } }],
      toolResults: [{ toolCallId: 't1', output: 'ok', isError: false }],
      fileChanges: [{ path: '/w/a.txt', before: 'old\n', after: 'new\n', isNew: false }],
    })
  })

  it('keeps a reply that has tool calls but no text', () => {
    const records = [
      meta,
      {
        type: 'message',
        role: 'assistant',
        content: '',
        tool_calls: [{ tool_call_id: 't1', tool_name: 'bash', arguments: { command: 'ls' } }],
      },
    ] as SessionRecord[]

    const messages = recordsToMessages(records)

    expect(messages).toHaveLength(1)
    expect(messages[0].toolCalls).toEqual([
      { toolCallId: 't1', toolName: 'bash', arguments: { command: 'ls' } },
    ])
  })

  it('leaves a plain text reply without tool fields', () => {
    const records = [meta, { type: 'message', role: 'assistant', content: 'Just text.' }] as SessionRecord[]

    const [reply] = recordsToMessages(records)

    expect(reply).toEqual({ id: 'restored-1', role: 'assistant', content: 'Just text.' })
  })
})

describe('stopUnfinishedTools', () => {
  it('gives every tool call without a result a result saying it was stopped', () => {
    const messages = [
      {
        id: 'a1',
        role: 'assistant' as const,
        content: 'Working',
        toolCalls: [
          { toolCallId: 't1', toolName: 'bash', arguments: {} },
          { toolCallId: 't2', toolName: 'bash', arguments: {} },
        ],
        toolResults: [{ toolCallId: 't1', output: 'ok', isError: false }],
      },
    ]

    const [reply] = stopUnfinishedTools(messages)

    expect(reply.toolResults).toEqual([
      { toolCallId: 't1', output: 'ok', isError: false },
      { toolCallId: 't2', output: 'Stopped before it finished', isError: true },
    ])
  })

  it('leaves messages with no unfinished tool calls as they are', () => {
    const messages = [{ id: 'u1', role: 'user' as const, content: 'hi' }]
    expect(stopUnfinishedTools(messages)).toEqual(messages)
  })
})
