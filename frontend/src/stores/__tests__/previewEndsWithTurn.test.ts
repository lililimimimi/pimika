import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useChatStore } from '../chatStore'

const encoder = new TextEncoder()

function sseResponse(lines: string[]) {
  const body = new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line + '\n\n'))
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

describe('a confirmation card left over when the turn ends', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).endsWith('/api/chat')) {
          return new Response(JSON.stringify({ session_id: 's1', persist_id: 'p1' }), { status: 200 })
        }
        // The bridge asks for a confirmation, then the turn ends without answering it
        return sseResponse([
          'data: {"event":"execution_preview","data":{"preview_id":"pv-9","steps":["Run ls"],"has_write_ops":true}}',
        ])
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('clears the card once the stream has ended, so it does not stay as "Awaiting approval"', async () => {
    await useChatStore.getState().sendMessage('list files')

    expect(useChatStore.getState().isStreaming).toBe(false)
    expect(useChatStore.getState().executionPreview).toBeNull()
  })
})
