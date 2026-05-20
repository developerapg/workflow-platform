import { type TextareaHTMLAttributes, forwardRef, useId } from 'react'
import { cn } from '@/lib/cn'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id: externalId, rows = 3, ...props }, ref) => {
    const generatedId = useId()
    const id = externalId ?? generatedId
    const errorId = `${id}-error`

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-label uppercase text-[var(--text-tertiary)]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={!!error}
          className={cn(
            'w-full resize-y rounded-sm border bg-[var(--bg-input)] px-3 py-2 text-body text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
            'border-[var(--border-default)] transition-colors',
            'focus:border-[var(--action-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--action-primary)]',
            error && 'border-[var(--state-error)] focus:border-[var(--state-error)] focus:ring-[var(--state-error)]',
            props.disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
          {...props}
        />
        {hint && !error && (
          <p className="text-caption text-[var(--text-muted)]">{hint}</p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-caption text-[var(--state-error-text)]">
            {error}
          </p>
        )}
      </div>
    )
  },
)
Textarea.displayName = 'Textarea'
