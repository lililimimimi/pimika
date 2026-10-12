import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { FileDiff } from '@/components/chat/message/FileDiff'
import type { FileChange } from '@/types'
import { cn } from '@/lib/utils'

// Files the agent changed while writing one reply, folded under a single line with the count.
// Opening a file shows its diff; only one file is open at a time.
export function FileChangeList({ changes }: { changes: FileChange[] }) {
  const [open, setOpen] = useState(false)
  const [openPath, setOpenPath] = useState<string | null>(null)
  const total = changes.length

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground/80 transition-colors cursor-pointer select-none"
      >
        <ChevronRight className={cn('h-3 w-3 transition-transform duration-150', open && 'rotate-90')} />
        <span>
          Changed {total} file{total > 1 ? 's' : ''}
        </span>
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1">
          {changes.map((change) => {
            const isOpen = openPath === change.path
            return (
              <li key={change.path}>
                <button
                  type="button"
                  onClick={() => setOpenPath(isOpen ? null : change.path)}
                  className="flex items-center gap-2 text-xs font-mono text-left hover:text-foreground/80 cursor-pointer"
                >
                  <ChevronRight
                    className={cn(
                      'h-3 w-3 shrink-0 transition-transform duration-150',
                      isOpen && 'rotate-90',
                    )}
                  />
                  <span className="break-all">{change.path}</span>
                  {change.isNew && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      new
                    </span>
                  )}
                </button>
                {isOpen && <FileDiff change={change} />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
