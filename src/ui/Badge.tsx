import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

// UX Spec §3.5 — 4 artifact states + semantic variants
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-tiny font-semibold uppercase tracking-wide',
  {
    variants: {
      variant: {
        // Artifact states (UX Spec §3.5)
        configured: 'bg-[var(--state-success-bg)] text-[var(--state-success-text)] border border-[var(--state-success)]/30',
        warning: 'bg-[var(--state-warning-bg)] text-[var(--state-warning-text)] border border-[var(--state-warning)]/30',
        error: 'bg-[var(--state-error-bg)] text-[var(--state-error-text)] border border-[var(--state-error)]/30',
        draft: 'bg-[var(--state-neutral-bg)] text-[var(--text-muted)] border border-[var(--state-neutral)]/30',
        // Generic semantic
        success: 'bg-[var(--state-success-bg)] text-[var(--state-success-text)]',
        info: 'bg-[var(--action-bg-subtle)] text-[var(--action-text)]',
        neutral: 'bg-[var(--state-neutral-bg)] text-[var(--text-tertiary)]',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode
  className?: string
  dot?: boolean
}

const dotColor: Record<NonNullable<BadgeProps['variant']>, string> = {
  configured: 'bg-[var(--state-success)]',
  warning: 'bg-[var(--state-warning)]',
  error: 'bg-[var(--state-error)]',
  draft: 'bg-[var(--state-neutral)]',
  success: 'bg-[var(--state-success)]',
  info: 'bg-[var(--action-primary)]',
  neutral: 'bg-[var(--state-neutral)]',
}

export function Badge({ variant = 'neutral', children, className, dot }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotColor[variant])} aria-hidden />}
      {children}
    </span>
  )
}
