import { useState } from 'react'
import { AlertCircle, ChevronDown } from 'lucide-react'
import { Button } from './Button'

interface ErrorStateProps {
  title?: string
  message?: string
  detail?: string
  onRetry?: () => void
}

export function ErrorState({
  title = 'No fue posible cargar los datos',
  message,
  detail,
  onRetry,
}: ErrorStateProps) {
  const [showDetail, setShowDetail] = useState(false)

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-[var(--state-error)]/30 bg-[var(--state-error-bg)] p-6 text-center">
      <AlertCircle size={24} className="text-[var(--state-error)]" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-body font-medium text-[var(--text-primary)]">{title}</p>
        {message && <p className="text-body-sm text-[var(--text-secondary)]">{message}</p>}
      </div>
      <div className="flex items-center gap-2">
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        )}
        {detail && (
          <button
            onClick={() => setShowDetail((v) => !v)}
            className="flex items-center gap-1 text-caption text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          >
            Ver detalles <ChevronDown size={12} className={showDetail ? 'rotate-180' : ''} aria-hidden />
          </button>
        )}
      </div>
      {showDetail && detail && (
        <pre className="mt-1 w-full overflow-auto rounded bg-[var(--bg-canvas)] p-3 text-left font-mono text-caption text-[var(--text-muted)]">
          {detail}
        </pre>
      )}
    </div>
  )
}
