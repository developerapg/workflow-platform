import { type DragEvent } from 'react'
import { User, Terminal, GitBranch, Circle, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import type { NodeType } from '@/api/types'

// End node icon: concentric circles (BPMN double-border convention, PD-140)
const EndIcon = () => (
  <span className="relative flex h-3.5 w-3.5 items-center justify-center rounded-full border-[1.5px] border-current">
    <span className="h-2 w-2 rounded-full bg-current" />
  </span>
)

// PD-25: type-specific colors for palette cards
const NODE_COLOR: Record<string, string> = {
  start:              '#10b981',
  human_task:         '#2563eb',
  script_task:        '#8b5cf6',
  exclusive_gateway:  '#f59e0b',
  end:                '#ef4444',
}

const NODE_ICON: Record<string, React.ReactNode> = {
  start:              <Circle size={14} fill="currentColor" strokeWidth={0} />,
  human_task:         <User size={14} />,
  script_task:        <Terminal size={14} />,
  exclusive_gateway:  <GitBranch size={14} />,
  end:                <EndIcon />,
}

const NODE_LABEL: Record<string, string> = {
  start:             'Inicio',
  human_task:        'Tarea humana',
  script_task:       'Script',
  exclusive_gateway: 'Gateway',
  end:               'Fin',
}

// PD-22: start is disabled when the process already has one
const PALETTE_ITEMS: { type: NodeType; mvp?: boolean }[] = [
  { type: 'start' },
  { type: 'human_task' },
  { type: 'script_task', mvp: true },
  { type: 'exclusive_gateway', mvp: true },
  { type: 'end' },
]

interface NodePaletteProps {
  hasStart: boolean
  collapsed: boolean
  onToggleCollapse: () => void
  onAddNode: (type: NodeType) => void
}

export function NodePalette({ hasStart, collapsed, onToggleCollapse, onAddNode }: NodePaletteProps) {
  const handleDragStart = (e: DragEvent<HTMLButtonElement>, type: NodeType) => {
    e.dataTransfer.setData('application/reactflow-nodetype', type)
    e.dataTransfer.effectAllowed = 'move'
  }

  if (collapsed) {
    return (
      <aside className="flex w-8 flex-shrink-0 flex-col items-center gap-2 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] pt-3">
        <button
          onClick={onToggleCollapse}
          className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-primary)]"
          aria-label="Expandir paleta"
          title="Expandir paleta"
        >
          <ChevronRight size={14} />
        </button>
        {PALETTE_ITEMS.map(({ type }) => {
          const color = NODE_COLOR[type]
          const disabled = type === 'start' && hasStart
          return (
            <div
              key={type}
              title={NODE_LABEL[type]}
              style={{ color, opacity: disabled ? 0.4 : 1 }}
              className="flex h-6 w-6 items-center justify-center"
            >
              {NODE_ICON[type]}
            </div>
          )
        })}
      </aside>
    )
  }

  return (
    <aside className="flex w-52 flex-shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <p className="text-label uppercase text-[var(--text-tertiary)]">Nodos</p>
        <button
          onClick={onToggleCollapse}
          className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-primary)]"
          aria-label="Colapsar paleta"
          title="Colapsar paleta"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Node cards (PD-24..PD-27) */}
      <div className="flex flex-col gap-1 px-2 pb-3">
        {PALETTE_ITEMS.map(({ type, mvp }) => {
          const color = NODE_COLOR[type]
          const disabled = type === 'start' && hasStart
          return (
            <button
              key={type}
              disabled={disabled}
              draggable={!disabled}
              onDragStart={(e) => !disabled && handleDragStart(e, type)}
              onClick={() => !disabled && onAddNode(type)}
              title={disabled ? 'Ya existe un nodo Inicio' : NODE_LABEL[type]}
              className={[
                'flex items-center gap-2.5 rounded-md border px-2 py-2 text-left transition-colors',
                disabled
                  ? 'cursor-not-allowed opacity-40 border-[var(--border-subtle)] bg-transparent'
                  : 'cursor-grab border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-default)] hover:bg-[var(--bg-surface-elevated)] active:cursor-grabbing',
              ].join(' ')}
            >
              {/* Color icon block (PD-25) */}
              <div
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md"
                style={{ background: `${color}1F`, color }}
              >
                {NODE_ICON[type]}
              </div>

              {/* Label + technical name */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="truncate text-body-sm font-medium text-[var(--text-primary)]">
                    {NODE_LABEL[type]}
                  </p>
                  {mvp && (
                    <span
                      className="flex items-center gap-0.5 rounded-sm bg-[var(--state-warning-bg)] px-0.5 text-tiny font-semibold text-[var(--state-warning-text)]"
                      title="No ejecutable en MVP"
                    >
                      <AlertTriangle size={8} aria-hidden />
                    </span>
                  )}
                </div>
                <p className="truncate font-mono text-tiny text-[var(--text-muted)]">{type}</p>
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
