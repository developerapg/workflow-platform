import { type ReactNode } from 'react'
import { Plus } from 'lucide-react'

interface NodeShellProps {
  children: ReactNode
  /** Called when the user clicks "+" to add a connected next node */
  onAddNext?: () => void
}

/**
 * Wrapper that shows the contextual "+" button on hover using CSS group/group-hover
 * (PD-43: pure CSS, no React state; PD-44: button area includes tolerante zone so
 * the cursor doesn't "lose" the button when moving from node to button).
 */
export function NodeShell({ children, onAddNext }: NodeShellProps) {
  if (!onAddNext) return <>{children}</>

  return (
    <div className="group/node relative">
      {children}

      {/*
        The button is always in the DOM but hidden via opacity.
        Because it's inside group/node, hovering the button keeps the group hovered.
        -right-9 positions it partially overlapping the node edge (PD-40).
        The invisible p-2 padding extends the hover tolerance zone (PD-44).
      */}
      <div
        className="absolute -right-9 top-1/2 -translate-y-1/2 p-1.5"
        aria-hidden="false"
      >
        <button
          onMouseDown={(e) => {
            e.stopPropagation()
            onAddNext()
          }}
          className={[
            'flex h-6 w-6 items-center justify-center rounded-full',
            'border border-[var(--action-primary)] bg-[var(--bg-surface)]',
            'text-[var(--action-primary)] shadow-sm',
            'hover:bg-[var(--action-primary)] hover:text-white',
            'transition-all duration-150',
            // Hidden by default, visible when the group (node area + this button) is hovered
            'opacity-0 group-hover/node:opacity-100',
            'scale-75 group-hover/node:scale-100',
          ].join(' ')}
          title="Agregar nodo conectado"
          aria-label="Agregar nodo conectado al actual"
        >
          <Plus size={12} aria-hidden />
        </button>
      </div>
    </div>
  )
}
