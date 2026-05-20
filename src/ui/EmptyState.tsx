import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  secondaryAction?: ReactNode
}

export function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-8 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--bg-surface-elevated)] text-[var(--text-muted)]">
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-h2 text-[var(--text-primary)]">{title}</p>
        {description && (
          <p className="max-w-xs text-body text-[var(--text-secondary)]">{description}</p>
        )}
      </div>
      {(action || secondaryAction) && (
        <div className="flex items-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}
