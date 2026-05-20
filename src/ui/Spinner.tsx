import { cn } from '@/lib/cn'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
  'aria-hidden'?: boolean
}

const sizeMap = { sm: 'h-3.5 w-3.5', md: 'h-5 w-5', lg: 'h-7 w-7' }

export function Spinner({ size = 'md', label, className, 'aria-hidden': ariaHidden }: SpinnerProps) {
  return (
    <span
      role={ariaHidden ? undefined : 'status'}
      aria-hidden={ariaHidden}
      aria-label={!ariaHidden ? (label ?? 'Cargando…') : undefined}
      className={cn('inline-block animate-spin rounded-full border-2 border-current border-t-transparent', sizeMap[size], className)}
    />
  )
}
