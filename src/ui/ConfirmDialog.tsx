import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { Input } from './Input'

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  /** If provided, user must type this string to confirm (destructive guard) */
  confirmText?: string
  confirmLabel?: string
  loading?: boolean
  variant?: 'danger' | 'primary'
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  confirmLabel = 'Confirmar',
  loading,
  variant = 'danger',
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const canConfirm = !confirmText || typed === confirmText

  const handleClose = () => {
    setTyped('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={handleClose} disabled={!!loading}>
            Cancelar
          </Button>
          <Button
            variant={variant}
            size="sm"
            disabled={!canConfirm}
            {...(loading !== undefined ? { loading } : {})}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <AlertTriangle
            size={20}
            className="mt-0.5 flex-shrink-0 text-[var(--state-error)]"
            aria-hidden
          />
          <p className="text-body text-[var(--text-secondary)]">{message}</p>
        </div>

        {confirmText && (
          <Input
            label={`Escribe "${confirmText}" para confirmar`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmText}
            autoComplete="off"
          />
        )}
      </div>
    </Modal>
  )
}
