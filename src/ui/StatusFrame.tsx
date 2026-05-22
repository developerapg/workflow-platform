import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

// UX Spec §3.5 — 4 canonical artifact states
export type ArtifactState = 'configured' | 'warning' | 'error' | 'draft'

const frameBorder: Record<ArtifactState, string> = {
  configured: 'border border-[var(--state-success)]/50',
  warning:    'border border-[var(--state-warning)]/50',
  error:      'border border-[var(--state-error)]/50',
  draft:      'border border-dashed border-[var(--border-default)]',
}

// box-shadow-based glow using CSS variables defined in tokens.css
const frameGlow: Record<ArtifactState, string> = {
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

export interface StatusFrameProps extends HTMLAttributes<HTMLDivElement> {
  state: ArtifactState
  dot?: boolean
  children: ReactNode
}

/**
 * Wrapper that applies UX Spec §3.5 visual state to any configurable element:
 * colored border + glow + optional 6px corner dot.
 */
export function StatusFrame({ state, dot = false, children, className, ...props }: StatusFrameProps) {
  return (
    <div
      className={cn(
        'relative rounded-lg transition-shadow',
        frameBorder[state],
        frameGlow[state],
        className,
      )}
      {...props}
    >
      {children}
      {dot && (
        <span
          aria-hidden
          className={cn(
            'absolute right-2 top-2 h-1.5 w-1.5 rounded-full',
            dotColor[state],
          )}
        />
      )}
    </div>
  )
}
