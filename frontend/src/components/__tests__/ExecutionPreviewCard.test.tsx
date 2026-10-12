import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExecutionPreviewCard } from '@/components/chat/ExecutionPreviewCard'
import { APP_ERROR_EVENT, type AppErrorDetail } from '@/lib/appError'

const confirmPreview = vi.fn()
const cancelPreview = vi.fn()
vi.mock('@/services/api/chat', () => ({
  confirmPreview: (id: string, remember: boolean) => confirmPreview(id, remember),
  cancelPreview: (id: string) => cancelPreview(id),
}))

const preview = { previewId: 'pv-1', steps: ['Edit README.md'], hasWriteOps: true }

afterEach(() => {
  confirmPreview.mockReset()
  cancelPreview.mockReset()
})

describe('ExecutionPreviewCard', () => {
  it('reports the answered preview id once the confirm succeeds', async () => {
    confirmPreview.mockResolvedValue(undefined)
    const onDone = vi.fn()
    render(<ExecutionPreviewCard preview={preview} onDone={onDone} />)

    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('pv-1'))
    expect(confirmPreview).toHaveBeenCalledWith('pv-1', false)
  })

  it('shows an error when the confirm fails, instead of failing silently', async () => {
    confirmPreview.mockRejectedValue(new Error('Preview not found'))
    const onDone = vi.fn()
    const errors: AppErrorDetail[] = []
    const listener = (e: Event) => errors.push((e as CustomEvent<AppErrorDetail>).detail)
    window.addEventListener(APP_ERROR_EVENT, listener)

    render(<ExecutionPreviewCard preview={preview} onDone={onDone} />)
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('pv-1'))
    window.removeEventListener(APP_ERROR_EVENT, listener)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toMatch(/could not confirm/i)
    expect(errors[0].detail).toBe('Preview not found')
  })
})

describe('ExecutionPreviewCard with a new preview after an answer', () => {
  it('enables Continue again for the new preview, even though the card instance is reused', async () => {
    // The first confirm never returns in this test, so the card stays busy after the click
    confirmPreview.mockReturnValue(new Promise(() => {}))
    const onDone = vi.fn()
    const first = { previewId: 'pv-1', steps: ['Edit a.txt'], hasWriteOps: true }
    const second = { previewId: 'pv-2', steps: ['Edit b.txt'], hasWriteOps: true }

    const { rerender } = render(<ExecutionPreviewCard preview={first} onDone={onDone} />)
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()

    // The agent asks again: the same card now shows the new step
    rerender(<ExecutionPreviewCard preview={second} onDone={onDone} />)

    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled()
  })
})

describe('ExecutionPreviewCard allow-from-now-on choice', () => {
  const bashPreview = { previewId: 'pv-5', steps: ['Run npm test'], hasWriteOps: true, canRemember: true }

  it('shows the choice only for shell commands', () => {
    const { unmount } = render(<ExecutionPreviewCard preview={bashPreview} onDone={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: /allow this command in this project/i })).toBeInTheDocument()
    unmount()
    render(<ExecutionPreviewCard preview={{ ...bashPreview, canRemember: false }} onDone={vi.fn()} />)
    expect(screen.queryByRole('checkbox', { name: /allow this command/i })).not.toBeInTheDocument()
  })

  it('confirms with remember set when the box is ticked', async () => {
    confirmPreview.mockResolvedValue(undefined)
    const onDone = vi.fn()
    render(<ExecutionPreviewCard preview={bashPreview} onDone={onDone} />)

    await userEvent.click(screen.getByRole('checkbox', { name: /allow this command in this project/i }))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('pv-5'))
    expect(confirmPreview).toHaveBeenCalledWith('pv-5', true)
  })
})
