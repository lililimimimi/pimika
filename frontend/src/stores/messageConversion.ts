import type { SessionRecord } from '@/lib/schemas'
/**
 * Converts messages between the chat screen and the API / saved session records.
 * Pure functions: no store state, so they are easy to test on their own.
 */
import type { ContentPart } from '@/services/api/chat'
import type { Message } from '@/types'
import { parseDataUrl, stripImageMarker } from '@/lib/image'

/** Builds the API content for a message: plain text, or text + image parts. */
export function toApiContent(m: Message, includeImages: boolean): string | ContentPart[] {
  const images = includeImages ? (m.images ?? []) : []
  if (images.length === 0) return m.content
  const parts: ContentPart[] = m.content ? [{ type: 'text', text: m.content }] : []
  for (const image of images) {
    const { mediaType, data } = parseDataUrl(image.dataUrl)
    parts.push({ type: 'image', image: { media_type: mediaType, data } })
  }
  return parts
}

/** Converts stored session records into chat messages (text only). */
export function recordsToMessages(records: SessionRecord[]): Message[] {
  let counter = 0
  return records
    .filter((r) => r.type === 'message')
    .map((r): Message => {
      const id = `restored-${++counter}`
      const content = r.content || ''
      // A failed turn is saved as "Error: <text>"; show it as an error, not as a reply
      if (r.role === 'assistant' && content.startsWith('Error: ')) {
        return { id, role: 'assistant', content: '', error: content.slice('Error: '.length) }
      }
      const message: Message = {
        id,
        role: r.role === 'user' ? 'user' : 'assistant',
        content: stripImageMarker(content),
      }
      // Only the fields that were saved, so a plain text reply stays as it was
      if (r.tool_calls?.length) {
        message.toolCalls = r.tool_calls.map((tc) => ({
          toolCallId: tc.tool_call_id,
          toolName: tc.tool_name,
          arguments: tc.arguments,
        }))
      }
      if (r.tool_results?.length) {
        message.toolResults = r.tool_results.map((tr) => ({
          toolCallId: tr.tool_call_id,
          output: tr.output,
          isError: tr.is_error,
        }))
      }
      if (r.file_changes?.length) {
        message.fileChanges = r.file_changes.map((fc) => ({
          path: fc.path,
          before: fc.before,
          after: fc.after,
          isNew: fc.is_new,
        }))
      }
      return message
    })
}

/**
 * After Stop, a tool call that never got a result would show as running forever. Give each one
 * a result that says it was stopped, so the card shows the end of the call.
 */
export function stopUnfinishedTools(messages: Message[]): Message[] {
  const last = messages[messages.length - 1]
  if (!last?.toolCalls?.length) return messages
  const finished = new Set((last.toolResults ?? []).map((tr) => tr.toolCallId))
  const stopped = last.toolCalls
    .filter((tc) => !finished.has(tc.toolCallId))
    .map((tc) => ({ toolCallId: tc.toolCallId, output: 'Stopped before it finished', isError: true }))
  if (stopped.length === 0) return messages
  return [...messages.slice(0, -1), { ...last, toolResults: [...(last.toolResults ?? []), ...stopped] }]
}
