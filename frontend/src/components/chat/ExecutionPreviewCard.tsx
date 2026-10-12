/**
 * ExecutionPreviewCard
 *
 * Shown when the agent emits an `execution_preview` SSE event before its
 * first write tool call. Displays the planned steps and lets the user
 * confirm or cancel. It stays until the user answers.
 */
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { confirmPreview, cancelPreview } from '@/services/api/chat'
import { reportError } from '@/lib/appError'

export type ExecutionPreview = {
  previewId: string
  steps: string[]
  hasWriteOps: boolean
  /** A shell command, so the user can allow it from now on */
  canRemember?: boolean
}

type Props = {
  preview: ExecutionPreview
  /** Called with the answered preview's id, so only that card is cleared */
  onDone: (previewId: string) => void
}

export function ExecutionPreviewCard({ preview, onDone }: Props) {
  const [busy, setBusy] = useState(false)
  const [remember, setRemember] = useState(false)

  // A new step can arrive while the last click is still busy, and this card instance is reused for it
  useEffect(() => {
    setBusy(false)
  }, [preview.previewId])

  async function handleConfirm() {
    setBusy(true)
    try {
      await confirmPreview(preview.previewId, remember)
    } catch (err) {
      reportError('Could not confirm this step. Stop the reply and try again.', err)
    } finally {
      onDone(preview.previewId)
    }
  }

  async function handleCancel() {
    setBusy(true)
    try {
      await cancelPreview(preview.previewId)
    } catch (err) {
      reportError('Could not cancel this step. Stop the reply and try again.', err)
    } finally {
      onDone(preview.previewId)
    }
  }

  return (
    <Card className="p-4 border border-border/60 bg-muted/30 rounded-2xl space-y-3">
      <p className="text-sm font-medium text-foreground">The agent plans to run the following:</p>

      <ol className="space-y-1 pl-1">
        {preview.steps.map((step, i) => (
          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
            <span className="shrink-0 text-sm font-mono text-muted-foreground pt-0.5">{i + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {preview.canRemember && (
        <label className="flex items-center gap-2 text-sm text-foreground/80">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            disabled={busy}
          />
          Allow this command in this project from now on
        </label>
      )}

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={handleConfirm} disabled={busy} className="rounded-xl">
          Continue
        </Button>
        <Button size="sm" variant="outline" onClick={handleCancel} disabled={busy} className="rounded-xl">
          Cancel
        </Button>
      </div>
    </Card>
  )
}
