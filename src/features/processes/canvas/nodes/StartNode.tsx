import { Handle, Position, type NodeProps } from 'reactflow'
import type { NodeType } from '@/api/types'
import type { Direction } from './NodeShell'
import { NodeShell } from './NodeShell'

interface StartData {
  onAddNext?: (type: NodeType, direction: Direction) => void
  hasStart?: boolean
  occupiedSides?: Direction[]
  isDraggingEdge?: boolean
}

const HANDLE_CLASS = [
  '!h-2 !w-2 !rounded-full !border !border-[var(--action-primary)] !bg-transparent',
  '!opacity-0 group-hover/node:!opacity-100 !transition-opacity',
].join(' ')

export function StartNode({ data, selected }: NodeProps<StartData>) {
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
          'relative flex h-14 w-14 items-center justify-center rounded-full border-2 bg-[var(--bg-surface)] transition-all',
          selected
            ? 'border-[var(--state-success)] shadow-[0_0_12px_var(--state-success)]'
            : 'border-[var(--state-success)]/60 [box-shadow:var(--state-success-glow)] hover:border-[var(--state-success)]',
        ].join(' ')}
        title="Inicio"
      >
        <div className="h-4 w-4 rounded-full bg-[var(--state-success)]" />
        {/* State dot — always configured */}
        <span aria-hidden className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--state-success)]" />

        {/* Source-only handles on all 4 sides (PD-70, PD-72) */}
        <Handle type="source" position={Position.Top}    id="top"    className={HANDLE_CLASS} />
        <Handle type="source" position={Position.Right}  id="right"  className={HANDLE_CLASS} />
        <Handle type="source" position={Position.Bottom} id="bottom" className={HANDLE_CLASS} />
        <Handle type="source" position={Position.Left}   id="left"   className={HANDLE_CLASS} />
      </div>
    </NodeShell>
  )
}
