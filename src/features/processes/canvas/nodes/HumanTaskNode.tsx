import { Handle, Position, type NodeProps } from 'reactflow'
import { User } from 'lucide-react'
import type { ArtifactState } from '@/ui'
import { NodeShell } from './NodeShell'

interface HumanTaskData {
  name: string
  label: string
  formName?: string
  nodeState?: ArtifactState
  onAddNext?: () => void
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

export function HumanTaskNode({ data, selected }: NodeProps<HumanTaskData>) {
  const state = data.nodeState ?? 'draft'

  return (
    <NodeShell onAddNext={data.onAddNext}>
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

      {/* 4-direction handles (PD-70, PD-72) */}
      <Handle type="target" position={Position.Top} className="!bg-[var(--action-primary)]" />
      <Handle type="target" position={Position.Left} className="!bg-[var(--action-primary)]" />
      <Handle type="source" position={Position.Right} className="!bg-[var(--action-primary)]" />
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--action-primary)]" />

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
