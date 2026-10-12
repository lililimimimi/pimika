import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/api/models', () => ({
  fetchDefaultModel: vi.fn(),
  saveSelectedModel: vi.fn(),
}))

import { fetchDefaultModel, saveSelectedModel } from '@/services/api/models'
import { useChatStore } from '../chatStore'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('model choice', () => {
  it('saves the picked model to the backend, so every window starts with it', () => {
    vi.mocked(saveSelectedModel).mockResolvedValue(undefined)
    useChatStore.getState().setModel('deepseek', 'deepseek-chat')
    expect(saveSelectedModel).toHaveBeenCalledWith('deepseek', 'deepseek-chat')
    expect(useChatStore.getState().model).toBe('deepseek-chat')
  })

  it('takes the model from the backend at startup, even when the browser remembers another one', async () => {
    localStorage.setItem('provider', 'deepseek')
    localStorage.setItem('model', 'old-model')
    vi.mocked(fetchDefaultModel).mockResolvedValue({ provider: 'pi', model: 'claude-sonnet-4-5' })

    await useChatStore.getState().initProvider()

    expect(fetchDefaultModel).toHaveBeenCalled()
    expect(useChatStore.getState().provider).toBe('pi')
    expect(useChatStore.getState().model).toBe('claude-sonnet-4-5')
  })
})
