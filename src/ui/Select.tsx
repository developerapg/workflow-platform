import { type SelectHTMLAttributes, forwardRef, useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: SelectOption[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, options, placeholder, id: externalId, ...props }, ref) => {
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
        <div className="relative">
          <select
            ref={ref}
            id={id}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={!!error}
            className={cn(
              'h-8 w-full appearance-none rounded-sm border bg-[var(--bg-input)] pl-3 pr-8 text-body text-[var(--text-primary)]',
              'border-[var(--border-default)] transition-colors',
              'focus:border-[var(--action-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--action-primary)]',
              error && 'border-[var(--state-error)] focus:border-[var(--state-error)] focus:ring-[var(--state-error)]',
              props.disabled && 'cursor-not-allowed opacity-50',
              className,
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            aria-hidden
          />
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-caption text-[var(--state-error-text)]">
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-caption text-[var(--text-muted)]">{hint}</p>
        )}
      </div>
    )
  },
)
Select.displayName = 'Select'
