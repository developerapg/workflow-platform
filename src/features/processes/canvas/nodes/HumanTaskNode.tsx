import { Handle, Position, type NodeProps } from 'reactflow'
import { User } from 'lucide-react'
import type { ArtifactState } from '@/ui'
import type { NodeType } from '@/api/types'
import type { Direction } from './NodeShell'
import { NodeShell } from './NodeShell'

interface HumanTaskData {
  name: string
  label: string
  formName?: string
  nodeState?: ArtifactState
  onAddNext?: (type: NodeType, direction: Direction) => void
  hasStart?: boolean
  occupiedSides?: Direction[]
  isDraggingEdge?: boolean
}

const stateBorder: Record<ArtifactState, string> = {
  configured: 'border-[var(--state-success)]/60 [box-shadow:var(--state-success-glow)]',
  warning:    'border-[var(--state-warning)]/60 [box-shadow:var(--state-warning-glow)]',
  error:      'border-[var(--state-error)]/60 [box-shadow:var(--state-error-glow)]',
  draft:      'border-[var(--border-default)] border-dashed',
}

const stateDot: Record<ArtifactState, string> = {
  configured: 'bg-[var(--state-success)]',
  warning:    'bg-[var(--state-warning)]',
  error:      'bg-[var(--state-error)]',
  draft:      'bg-[var(--state-neutral)]',
}

const HANDLE_CLASS = [
  '!h-2 !w-2 !rounded-full !border !border-[var(--action-primary)] !bg-transparent',
  '!opacity-0 group-hover/node:!opacity-100 !transition-opacity',
].join(' ')

export function HumanTaskNode({ data, selected }: NodeProps<HumanTaskData>) {
  const state = data.nodeState ?? 'draft'

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
            ? 'border-[var(--action-primary)] shadow-[0_0_12px_rgba(37,99,235,0.5)]'
            : stateBorder[state],
        ].join(' ')}
      >
        {/* State dot (PD-222) */}
        <span
          aria-hidden
          className={`absolute right-2 top-2 h-1.5 w-1.5 rounded-full ${stateDot[state]}`}
        />

        {/* Bidirectional handles via connectionMode="loose" — 1 per side (PD-70, PD-72) */}
        <Handle type="source" position={Position.Top}    id="top"    className={HANDLE_CLASS} />
        <Handle type="source" position={Position.Right}  id="right"  className={HANDLE_CLASS} />
        <Handle type="source" position={Position.Bottom} id="bottom" className={HANDLE_CLASS} />
        <Handle type="source" position={Position.Left}   id="left"   className={HANDLE_CLASS} />

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--action-bg-subtle)]">
            <User size={14} className="text-[var(--action-text)]" aria-hidden />
          </div>
          <div className="min-w-0 pr-3">
            <p className="truncate text-body-sm font-semibold text-[var(--text-primary)]">
              {data.label || data.name}
            </p>
            {data.formName ? (
              <p className="truncate font-mono text-tiny text-[var(--text-muted)]">
                {data.formName}
              </p>
            ) : (
              <p className="truncate font-mono text-tiny text-[var(--state-error-text)]">
                sin formulario
              </p>
            )}
          </div>
        </div>
      </div>
    </NodeShell>
  )
}
