import { Handle, Position, type NodeProps } from 'reactflow'
import { Terminal, AlertTriangle } from 'lucide-react'
import type { NodeType } from '@/api/types'
import type { Direction } from './NodeShell'
import { NodeShell } from './NodeShell'

interface ScriptTaskData {
  name: string
  label: string
  onAddNext?: (type: NodeType, direction: Direction) => void
  hasStart?: boolean
  occupiedSides?: Direction[]
  isDraggingEdge?: boolean
}

const HANDLE_CLASS = [
  '!h-2 !w-2 !rounded-full !border !border-[var(--action-primary)] !bg-transparent',
  '!opacity-0 group-hover/node:!opacity-100 !transition-opacity',
].join(' ')

export function ScriptTaskNode({ data, selected }: NodeProps<ScriptTaskData>) {
  return (
    <NodeShell
      {...(data.onAddNext
        ? {
            onAddNext: data.onAddNext,
            hasStart: data.hasStart,
            occupiedSides: data.occupiedSides,
            isDraggingEdge: data.isDraggingEdge,
          }
        : {})}
    >
      <div
        className={[
          'relative min-w-[160px] max-w-[200px] rounded-xl border-2 bg-[var(--bg-surface)] px-4 py-3 transition-all',
          selected
            ? 'border-[var(--state-warning)] shadow-[0_0_12px_rgba(245,158,11,0.4)]'
            : 'border-[var(--state-warning)]/50 [box-shadow:var(--state-warning-glow)]',
        ].join(' ')}
      >
        {/* State dot — always warning for script_task (PD-222) */}
        <span aria-hidden className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--state-warning)]" />

        {/* Bidirectional handles via connectionMode="loose" — 1 per side (PD-70, PD-72) */}
        <Handle type="source" position={Position.Top}    id="top"    className={HANDLE_CLASS} />
        <Handle type="source" position={Position.Right}  id="right"  className={HANDLE_CLASS} />
        <Handle type="source" position={Position.Bottom} id="bottom" className={HANDLE_CLASS} />
        <Handle type="source" position={Position.Left}   id="left"   className={HANDLE_CLASS} />

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--state-neutral-bg)]">
            <Terminal size={14} className="text-[var(--text-muted)]" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-body-sm font-semibold text-[var(--text-primary)]">
              {data.label || data.name}
            </p>
          </div>
          <span
            className="flex items-center gap-0.5 rounded-sm bg-[var(--state-warning-bg)] px-1 py-0.5 text-tiny font-semibold text-[var(--state-warning-text)]"
            title="No ejecutable en MVP"
          >
            <AlertTriangle size={9} aria-hidden /> MVP
          </span>
        </div>
      </div>
    </NodeShell>
  )
}
