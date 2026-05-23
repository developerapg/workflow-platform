import { Handle, Position, type NodeProps } from 'reactflow'
import { AlertTriangle } from 'lucide-react'
import type { NodeType } from '@/api/types'
import type { Direction } from './NodeShell'
import { NodeShell } from './NodeShell'

interface GatewayData {
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

export function ExclusiveGatewayNode({ data, selected }: NodeProps<GatewayData>) {
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
    <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
      {/* Diamond shape — always warning state for gateway (PD-222) */}
      <div
        className={[
          'absolute inset-0 rotate-45 rounded-md border-2 bg-[var(--bg-surface)] transition-all',
          selected
            ? 'border-[var(--state-warning)] shadow-[0_0_12px_rgba(245,158,11,0.4)]'
            : 'border-[var(--state-warning)]/50 [box-shadow:var(--state-warning-glow)]',
        ].join(' ')}
      />

      {/* State dot (PD-222) */}
      <span
        aria-hidden
        className="absolute right-1 top-1 z-20 h-1.5 w-1.5 rounded-full bg-[var(--state-warning)]"
      />

      {/* Content (not rotated) */}
      <div className="relative z-10 flex flex-col items-center">
        <span className="text-lg font-bold text-[var(--text-secondary)]">✕</span>
        <span
          className="flex items-center gap-0.5 rounded-sm bg-[var(--state-warning-bg)] px-1 text-tiny font-semibold text-[var(--state-warning-text)]"
          title="No ejecutable en MVP"
        >
          <AlertTriangle size={8} aria-hidden /> MVP
        </span>
      </div>

      {/* Label below */}
      {(data.label || data.name) && (
        <div className="absolute top-full mt-1 w-24 text-center">
          <p className="truncate text-tiny text-[var(--text-muted)]">{data.label || data.name}</p>
        </div>
      )}

      {/* Bidirectional handles via connectionMode="loose" — 1 per side (PD-70, PD-72) */}
      <Handle type="source" position={Position.Top}    id="top"    className={HANDLE_CLASS} style={{ top: -4 }} />
      <Handle type="source" position={Position.Right}  id="right"  className={HANDLE_CLASS} style={{ right: -4 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={HANDLE_CLASS} style={{ bottom: -4 }} />
      <Handle type="source" position={Position.Left}   id="left"   className={HANDLE_CLASS} style={{ left: -4 }} />
    </div>
    </NodeShell>
  )
}
