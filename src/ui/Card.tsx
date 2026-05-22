import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { ArtifactState } from './StatusFrame'

// UX Spec §3.5 — artifact state border + glow on cards
const stateBorder: Record<ArtifactState, string> = {
  configured: 'border-[var(--state-success)]/50',
  warning:    'border-[var(--state-warning)]/50',
  error:      'border-[var(--state-error)]/50',
  draft:      'border-[var(--border-default)] border-dashed',
}

const stateGlow: Record<ArtifactState, string> = {
  configured: '[box-shadow:var(--state-success-glow)]',
  warning:    '[box-shadow:var(--state-warning-glow)]',
  error:      '[box-shadow:var(--state-error-glow)]',
  draft:      '',
}

const dotColor: Record<ArtifactState, string> = {
  configured: 'bg-[var(--state-success)]',
  warning:    'bg-[var(--state-warning)]',
  error:      'bg-[var(--state-error)]',
  draft:      'bg-[var(--state-neutral)]',
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  artifactState?: ArtifactState
  dot?: boolean
  interactive?: boolean
  children: ReactNode
}

export function Card({ artifactState, dot, interactive, children, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'relative rounded-lg border bg-[var(--bg-surface)] p-4 transition-all',
        artifactState ? stateBorder[artifactState] : 'border-[var(--border-subtle)]',
        artifactState ? stateGlow[artifactState] : '',
        interactive && 'cursor-pointer hover:bg-[var(--bg-surface-elevated)]',
        className,
      )}
      {...props}
    >
      {children}
      {dot && artifactState && (
        <span
          aria-hidden
          className={cn('absolute right-2 top-2 h-1.5 w-1.5 rounded-full', dotColor[artifactState])}
        />
      )}
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
