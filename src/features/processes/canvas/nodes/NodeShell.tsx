import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Plus, User, Terminal, GitBranch, Circle, AlertTriangle } from 'lucide-react'
import type { NodeType } from '@/api/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Direction = 'top' | 'right' | 'bottom' | 'left'

// ── Node type registry (PD-25) ────────────────────────────────────────────────

const NODE_COLOR: Record<string, string> = {
  start:             '#10b981',
  human_task:        '#2563eb',
  script_task:       '#8b5cf6',
  exclusive_gateway: '#f59e0b',
  end:               '#ef4444',
}

const NODE_LABEL: Record<string, string> = {
  start:             'Inicio',
  human_task:        'Tarea humana',
  script_task:       'Script',
  exclusive_gateway: 'Gateway',
  end:               'Fin',
}

const EndIcon = () => (
  <span className="relative flex h-3.5 w-3.5 items-center justify-center rounded-full border-[1.5px] border-current">
    <span className="h-2 w-2 rounded-full bg-current" />
  </span>
)

const NODE_ICON: Record<string, ReactNode> = {
  start:             <Circle size={14} fill="currentColor" strokeWidth={0} />,
  human_task:        <User size={14} />,
  script_task:       <Terminal size={14} />,
  exclusive_gateway: <GitBranch size={14} />,
  end:               <EndIcon />,
}

const POPOVER_ITEMS: { type: NodeType; mvp?: boolean }[] = [
  { type: 'start' },
  { type: 'human_task' },
  { type: 'script_task',        mvp: true },
  { type: 'exclusive_gateway',  mvp: true },
  { type: 'end' },
]

// ── Button positioning by direction ──────────────────────────────────────────

const BTN_POSITION: Record<Direction, string> = {
  top:    'absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[calc(100%+6px)]',
  right:  'absolute right-0 top-1/2 translate-x-[calc(100%+6px)] -translate-y-1/2',
  bottom: 'absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[calc(100%+6px)]',
  left:   'absolute left-0 top-1/2 -translate-x-[calc(100%+6px)] -translate-y-1/2',
}

const POPOVER_POSITION: Record<Direction, string> = {
  top:    'absolute bottom-8 left-1/2 -translate-x-1/2',
  right:  'absolute left-8 top-1/2 -translate-y-1/2',
  bottom: 'absolute top-8 left-1/2 -translate-x-1/2',
  left:   'absolute right-8 top-1/2 -translate-y-1/2',
}

const DIRECTIONS: Direction[] = ['top', 'right', 'bottom', 'left']

// ── NodeShell ─────────────────────────────────────────────────────────────────

interface NodeShellProps {
  children: ReactNode
  /** Called when user picks a node type from the directional "+" popover */
  onAddNext?: (type: NodeType, direction: Direction) => void
  /** Whether a start node already exists — disables that option (PD-46) */
  hasStart?: boolean
  /** Sides that already have an outgoing edge — hides the "+" button for that side */
  occupiedSides?: Direction[]
  /** Whether an edge endpoint is currently being dragged — suppresses all "+" buttons */
  isDraggingEdge?: boolean
}

export function NodeShell({
  children,
  onAddNext,
  hasStart = false,
  occupiedSides = [],
  isDraggingEdge = false,
}: NodeShellProps) {
  const [openDirection, setOpenDirection] = useState<Direction | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // PD-49: close on click outside
  useEffect(() => {
    if (!openDirection) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDirection(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openDirection])

  // PD-49: close on Esc
  useEffect(() => {
    if (!openDirection) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenDirection(null) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [openDirection])

  // Close popover when edge dragging starts
  useEffect(() => {
    if (isDraggingEdge) setOpenDirection(null)
  }, [isDraggingEdge])

  if (!onAddNext) return <>{children}</>

  return (
    <div className="group/node relative" ref={containerRef}>
      {children}

      {/* 4 directional "+" buttons (PD-43..PD-50) */}
      {DIRECTIONS.map((dir) => {
        const occupied = occupiedSides.includes(dir)
        const isOpen = openDirection === dir
        const hidden = occupied || isDraggingEdge

        return (
          <div key={dir} className={BTN_POSITION[dir]}>
            {/* Button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                setOpenDirection((v) => (v === dir ? null : dir))
              }}
              className={[
                'nodrag nopan flex h-6 w-6 items-center justify-center rounded-full',
                'border border-[var(--action-primary)] bg-[var(--bg-surface)]',
                'text-[var(--action-primary)] shadow-sm',
                'hover:bg-[var(--action-primary)] hover:text-white',
                'transition-all duration-150',
                hidden
                  ? 'pointer-events-none opacity-0'
                  : 'opacity-0 group-hover/node:opacity-100 scale-75 group-hover/node:scale-100',
                isOpen ? '!opacity-100 !scale-100 !bg-[var(--action-primary)] !text-white' : '',
              ].join(' ')}
              title={`Agregar nodo hacia ${dir === 'top' ? 'arriba' : dir === 'bottom' ? 'abajo' : dir === 'left' ? 'la izquierda' : 'la derecha'}`}
              aria-label={`Agregar nodo conectado hacia ${dir}`}
              aria-expanded={isOpen}
            >
              <Plus size={12} aria-hidden />
            </button>

            {/* Popover — only rendered for the active direction */}
            {isOpen && (
              <div
                className={[
                  'nodrag nopan z-50',
                  POPOVER_POSITION[dir],
                  'absolute min-w-[168px] rounded-lg border border-[var(--border-subtle)]',
                  'bg-[var(--bg-surface)] shadow-lg py-1',
                ].join(' ')}
                role="menu"
                aria-label="Tipo de nodo"
              >
                <p className="px-3 pb-1 pt-1.5 text-label uppercase text-[var(--text-tertiary)]">
                  Agregar nodo
                </p>
                {POPOVER_ITEMS.map(({ type, mvp }) => {
                  const color = NODE_COLOR[type]
                  const disabled = type === 'start' && hasStart
                  return (
                    <button
                      key={type}
                      role="menuitem"
                      disabled={disabled}
                      onClick={(e) => {
                        e.stopPropagation()
                        const d = openDirection!
                        setOpenDirection(null)
                        onAddNext(type, d)
                      }}
                      className={[
                        'nodrag nopan flex w-full items-center gap-2.5 px-3 py-1.5 text-left',
                        'transition-colors',
                        disabled
                          ? 'cursor-not-allowed opacity-40'
                          : 'hover:bg-[var(--bg-surface-elevated)] cursor-pointer',
                      ].join(' ')}
                      title={disabled ? 'Ya existe un nodo Inicio' : undefined}
                    >
                      <div
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md"
                        style={{ background: `${color}1F`, color }}
                      >
                        {NODE_ICON[type]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="truncate text-body-sm font-medium text-[var(--text-primary)]">
                            {NODE_LABEL[type]}
                          </span>
                          {mvp && (
                            <AlertTriangle
                              size={10}
                              className="flex-shrink-0 text-[var(--state-warning-text)]"
                              aria-label="No ejecutable en MVP"
                            />
                          )}
                        </div>
                        <span className="truncate font-mono text-tiny text-[var(--text-muted)]">
                          {type}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
