import { type ReactNode, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Prevent closing when clicking backdrop */
  persistent?: boolean
}

const sizeMap = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

export function Modal({ open, onClose, title, children, footer, size = 'md', persistent }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) dialog.showModal()
    } else {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleClose = () => onClose()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !persistent) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose, persistent])

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (!persistent && e.target === e.currentTarget) onClose()
      }}
      className={cn(
        'w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0 shadow-xl',
        'backdrop:bg-black/50 backdrop:backdrop-blur-sm',
        'open:flex open:flex-col',
        sizeMap[size],
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
        <h2 className="text-h2 text-[var(--text-primary)]">{title}</h2>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-primary)]"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

      {/* Footer */}
      {footer && (
        <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-3">
          {footer}
        </div>
      )}
    </dialog>
  )
}
