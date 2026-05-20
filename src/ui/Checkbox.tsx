import { type InputHTMLAttributes, forwardRef, useId } from 'react'
import { cn } from '@/lib/cn'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  description?: string
  error?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, error, id: externalId, ...props }, ref) => {
    const generatedId = useId()
    const id = externalId ?? generatedId

    return (
      <div className="flex items-start gap-2">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          aria-invalid={!!error}
          className={cn(
            'mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer rounded-sm border border-[var(--border-default)]',
            'accent-[var(--action-primary)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action-primary)] focus-visible:ring-offset-1',
            props.disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
          {...props}
        />
        {(label || description) && (
          <div className="flex flex-col gap-0.5">
            {label && (
              <label htmlFor={id} className="cursor-pointer text-body text-[var(--text-primary)]">
                {label}
              </label>
            )}
            {description && (
              <p className="text-caption text-[var(--text-muted)]">{description}</p>
            )}
            {error && (
              <p role="alert" className="text-caption text-[var(--state-error-text)]">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    )
  },
)
Checkbox.displayName = 'Checkbox'
