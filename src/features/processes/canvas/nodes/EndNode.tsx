import { Handle, Position, type NodeProps } from 'reactflow'

const HANDLE_CLASS = [
  '!h-2 !w-2 !rounded-full !border !border-[var(--state-error)] !bg-transparent',
  '!opacity-0 group-hover/node:!opacity-100 !transition-opacity',
].join(' ')

export function EndNode({ selected }: NodeProps) {
  return (
    // group/node wrapper needed for handle hover CSS (no NodeShell since end has no onAddNext)
    <div className="group/node relative flex h-14 w-14 items-center justify-center">
      <div
        className={[
          'relative flex h-14 w-14 items-center justify-center rounded-full border-2 bg-[var(--bg-surface)] transition-all',
          selected
            ? 'border-[var(--state-error)] shadow-[0_0_12px_var(--state-error)]'
            : 'border-[var(--state-error)]/60 [box-shadow:var(--state-error-glow)] hover:border-[var(--state-error)]',
        ].join(' ')}
        title="Fin"
      >
        {/* Double-border indicator (BPMN convention, PD-140) */}
        <div className="h-4 w-4 rounded-full border-2 border-[var(--state-error)] bg-[var(--state-error)]" />
        {/* State dot — always configured */}
        <span aria-hidden className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--state-success)]" />

        {/* Target-only handles on all 4 sides (PD-70, PD-72) */}
        <Handle type="target" position={Position.Top}    id="top"    className={HANDLE_CLASS} />
        <Handle type="target" position={Position.Right}  id="right"  className={HANDLE_CLASS} />
        <Handle type="target" position={Position.Bottom} id="bottom" className={HANDLE_CLASS} />
        <Handle type="target" position={Position.Left}   id="left"   className={HANDLE_CLASS} />
      </div>
    </div>
  )
}
