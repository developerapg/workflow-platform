import { Handle, Position, type NodeProps } from 'reactflow'
import { NodeShell } from './NodeShell'

interface StartData {
  onAddNext?: () => void
}

export function StartNode({ data, selected }: NodeProps<StartData>) {
  return (
    <NodeShell onAddNext={data.onAddNext}>
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
      {/* State dot (PD-222) — always configured */}
      <span aria-hidden className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--state-success)]" />
      {/* Source-only handles (PD-70): bottom + right */}
      <Handle type="source" position={Position.Right} className="!bg-[var(--state-success)]" />
      <Handle type="source" id="bottom" position={Position.Bottom} className="!bg-[var(--state-success)]" />
    </div>
    </NodeShell>
  )
}
