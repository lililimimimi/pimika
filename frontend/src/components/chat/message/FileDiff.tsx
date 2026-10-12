import { useMemo } from 'react'
import { diffLines, type DiffLine } from '@/lib/lineDiff'
import type { FileChange } from '@/types'
import { cn } from '@/lib/utils'

const MARK: Record<DiffLine['type'], string> = { same: ' ', add: '+', remove: '-' }

// Before and after of one file, line by line: added lines green, removed lines red
export function FileDiff({ change }: { change: FileChange }) {
  const lines = useMemo(() => diffLines(change.before, change.after), [change.before, change.after])

  if (lines === null) {
    return <p className="mt-1.5 text-xs text-muted-foreground">File is too large to show a diff.</p>
  }

  return (
    <div className="mt-1.5 max-h-80 overflow-auto rounded-md border border-border font-mono text-xs leading-relaxed">
      {lines.map((line, idx) => (
        <div
          key={idx}
          data-diff-type={line.type}
          className={cn(
            'flex whitespace-pre px-2',
            line.type === 'add' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
            line.type === 'remove' && 'bg-red-500/10 text-red-700 dark:text-red-400',
          )}
        >
          <span className="w-3 shrink-0 select-none">{MARK[line.type]}</span>
          <span>{line.text || ' '}</span>
        </div>
      ))}
    </div>
  )
}
