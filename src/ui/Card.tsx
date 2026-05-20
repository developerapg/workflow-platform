import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

// UX Spec §3.5 — artifact state glow colors
type ArtifactState = 'configured' | 'warning' | 'error' | 'draft'

const stateBorder: Record<ArtifactState, string> = {
  configured: 'border-[var(--state-success)]/40',
  warning: 'border-[var(--state-warning)]/40',
  error: 'border-[var(--state-error)]/40',
  draft: 'border-[var(--border-default)] border-dashed',
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  artifactState?: ArtifactState
  interactive?: boolean
  children: ReactNode
}

export function Card({ artifactState, interactive, children, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-[var(--bg-surface)] p-4 transition-colors',
        artifactState ? stateBorder[artifactState] : 'border-[var(--border-subtle)]',
        interactive && 'cursor-pointer hover:bg-[var(--bg-surface-elevated)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/** Icon block inside a card (colored square + icon) */
export function CardIconBlock({
  icon,
  color = '#60A5FA',
}: {
  icon: ReactNode
  color?: string
}) {
  return (
    <div
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md"
      style={{ background: `${color}1A`, color }}
      aria-hidden
    >
      {icon}
    </div>
  )
}

/** New / create card variant (dashed border, centered content) */
export function CreateCard({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-default)] p-4 text-[var(--text-muted)] transition-colors hover:border-[var(--action-primary)] hover:text-[var(--action-text)]',
        props.className,
      )}
      role="button"
      tabIndex={0}
      {...props}
    >
      {children}
    </div>
  )
}
