import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileChangeList } from '@/components/chat/message/FileChangeList'
import type { FileChange } from '@/types'

const edited: FileChange = { path: '/w/app.txt', before: 'a\n', after: 'b\n', isNew: false }
const created: FileChange = { path: '/w/new.txt', before: '', after: 'hi\n', isNew: true }

describe('FileChangeList', () => {
  it('shows how many files the reply changed', () => {
    render(<FileChangeList changes={[edited, created]} />)
    expect(screen.getByRole('button', { name: /changed 2 files/i })).toBeInTheDocument()
  })

  it('uses the singular for one file', () => {
    render(<FileChangeList changes={[edited]} />)
    expect(screen.getByRole('button', { name: /changed 1 file$/i })).toBeInTheDocument()
  })

  it('lists the files only after the summary is opened, and marks new files', async () => {
    const user = userEvent.setup()
    render(<FileChangeList changes={[edited, created]} />)
    expect(screen.queryByText('/w/app.txt')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /changed 2 files/i }))

    expect(screen.getByText('/w/app.txt')).toBeInTheDocument()
    expect(screen.getByText('/w/new.txt')).toBeInTheDocument()
    expect(screen.getByText('new')).toBeInTheDocument()
    expect(screen.getAllByText('new')).toHaveLength(1)
  })

  it('opens a file to show its before and after lines, colored by change', async () => {
    const user = userEvent.setup()
    const edit: FileChange = { path: '/w/app.txt', before: 'keep\nold\n', after: 'keep\nnew\n', isNew: false }
    render(<FileChangeList changes={[edit]} />)
    await user.click(screen.getByRole('button', { name: /changed 1 file$/i }))
    await user.click(screen.getByRole('button', { name: '/w/app.txt' }))

    expect(screen.getByText('old').closest('[data-diff-type]')).toHaveAttribute('data-diff-type', 'remove')
    expect(screen.getByText('new').closest('[data-diff-type]')).toHaveAttribute('data-diff-type', 'add')
    expect(screen.getByText('keep').closest('[data-diff-type]')).toHaveAttribute('data-diff-type', 'same')
  })

  it('says so instead of a diff when the file is too large to compare', async () => {
    const user = userEvent.setup()
    const lines = (prefix: string) => Array.from({ length: 3000 }, (_, i) => prefix + i).join('\n')
    const huge: FileChange = { path: '/w/big.txt', before: lines('a'), after: lines('b'), isNew: false }
    render(<FileChangeList changes={[huge]} />)
    await user.click(screen.getByRole('button', { name: /changed 1 file$/i }))
    await user.click(screen.getByRole('button', { name: '/w/big.txt' }))
    expect(screen.getByText(/too large to show a diff/i)).toBeInTheDocument()
  })
})
