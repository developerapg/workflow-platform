import { Handle, Position, type NodeProps } from 'reactflow'

export function EndNode({ selected }: NodeProps) {
  return (
    <div
      className={[
        'relative flex h-14 w-14 items-center justify-center rounded-full border-2 bg-[var(--bg-surface)] transition-all',
        selected
          ? 'border-[var(--state-error)] shadow-[0_0_12px_var(--state-error)]'
          : 'border-[var(--state-error)]/60 [box-shadow:var(--state-error-glow)] hover:border-[var(--state-error)]',
      ].join(' ')}
      title="Fin"
    >
      {/* Double-border indicator (BPMN convention, PD-140) — red filled circle */}
      <div className="h-4 w-4 rounded-full border-2 border-[var(--state-error)] bg-[var(--state-error)]" />
      {/* State dot (PD-222) — always configured */}
      <span aria-hidden className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--state-success)]" />
      {/* Target-only handles (PD-70): top + left + right + bottom all as target */}
      <Handle type="target" position={Position.Top} className="!bg-[var(--state-error)]" />
      <Handle type="target" position={Position.Left} className="!bg-[var(--state-error)]" />
      <Handle type="target" position={Position.Right} className="!bg-[var(--state-error)]" />
      <Handle type="target" position={Position.Bottom} className="!bg-[var(--state-error)]" />
    </div>
  )
}
