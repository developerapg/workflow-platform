import { ChevronLeft, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { Input, Select, Button, Textarea } from '@/ui'
import type { ProcessNode, ContextVariable, FormDefinition } from '@/api/types'
import type { Edge } from 'reactflow'
import { technicalNameSchema } from '@/lib/schemas'

// ── Process-level properties ───────────────────────────────────────────────────

interface ProcessPanelProps {
  name: string
  description: string
  contextVariables: ContextVariable[]
  onNameChange: (v: string) => void
  onDescriptionChange: (v: string) => void
  onVariablesChange: (vars: ContextVariable[]) => void
}

function ProcessPanel({
  name, description, contextVariables,
  onNameChange, onDescriptionChange, onVariablesChange,
}: ProcessPanelProps) {
  const addVar = () => {
    onVariablesChange([
      ...contextVariables,
      {
        id: `var-${crypto.randomUUID()}`,
        name: '',
        label: '',
        data_type: 'string',
        entity_ref: null,
        initial_value: null,
        scope: 'process',
      },
    ])
  }

  const updateVar = (idx: number, patch: Partial<ContextVariable>) => {
    onVariablesChange(contextVariables.map((v, i) => (i === idx ? { ...v, ...patch } : v)))
  }

  const removeVar = (idx: number) => {
    onVariablesChange(contextVariables.filter((_, i) => i !== idx))
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Nombre técnico"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="nombre_proceso"
        hint="snake_case"
      />
      <Input
        label="Descripción"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="Describe el propósito del proceso"
      />

      {/* Context variables */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-label uppercase text-[var(--text-tertiary)]">
            Variables de contexto ({contextVariables.length})
          </span>
          <Button variant="ghost" size="sm" onClick={addVar}>
            <Plus size={12} aria-hidden /> Agregar
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {contextVariables.map((v, i) => (
            <div
              key={v.id}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] p-2"
            >
              <div className="flex items-start gap-1">
                <div className="flex flex-1 flex-col gap-1.5">
                  <input
                    type="text"
                    value={v.name}
                    onChange={(e) => updateVar(i, { name: e.target.value })}
                    placeholder="nombre_var"
                    className="h-6 w-full rounded-sm border border-[var(--border-default)] bg-[var(--bg-input)] px-2 font-mono text-caption text-[var(--text-primary)] focus:border-[var(--action-primary)] focus:outline-none"
                  />
                  <Select
                    options={[
                      { value: 'string', label: 'Texto' },
                      { value: 'integer', label: 'Entero' },
                      { value: 'decimal', label: 'Decimal' },
                      { value: 'boolean', label: 'Booleano' },
                      { value: 'date', label: 'Fecha' },
                      { value: 'uuid', label: 'UUID' },
                    ]}
                    value={v.data_type === 'entity_ref' ? 'string' : v.data_type}
                    onChange={(e) =>
                      updateVar(i, { data_type: e.target.value as ContextVariable['data_type'] })
                    }
                  />
                </div>
                <button
                  onClick={() => removeVar(i)}
                  className="mt-0.5 rounded p-0.5 text-[var(--text-muted)] hover:bg-[var(--state-error-bg)] hover:text-[var(--state-error-text)]"
                  aria-label="Eliminar variable"
                >
                  <Trash2 size={12} aria-hidden />
                </button>
              </div>
            </div>
          ))}
          {contextVariables.length === 0 && (
            <p className="text-caption text-[var(--text-muted)]">Sin variables</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Node properties ────────────────────────────────────────────────────────────

interface OutgoingTransition {
  id: string
  label: string
}

interface NodePanelProps {
  node: ProcessNode
  forms: FormDefinition[]
  outgoingTransitions: OutgoingTransition[]
  onChange: (updated: Partial<ProcessNode> & { config?: ProcessNode['config'] }) => void
}

function NodePanel({ node, forms, outgoingTransitions, onChange }: NodePanelProps) {
  const nameError = technicalNameSchema.safeParse(node.name).error?.errors[0]?.message

  const formOptions = [
    { value: '', label: '— Sin formulario —' },
    ...forms.map((f) => ({ value: f.id_object, label: f.object_name })),
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* Type badge */}
      <div className="rounded-md bg-[var(--bg-surface-elevated)] px-3 py-2">
        <p className="text-label uppercase text-[var(--text-tertiary)]">Tipo</p>
        <p className="font-mono text-body-sm text-[var(--text-primary)]">{node.node_type}</p>
      </div>

      <Input
        label="Nombre visible"
        value={node.display_name ?? ''}
        onChange={(e) => onChange({ display_name: e.target.value })}
        placeholder="Ej. Aprobación del jefe"
        hint="Etiqueta mostrada en el canvas"
      />

      <Input
        label="Nombre técnico"
        value={node.name}
        onChange={(e) => onChange({ name: e.target.value })}
        {...(nameError ? { error: nameError } : {})}
        placeholder="nombre_nodo"
        hint="snake_case — se autogenera del nombre visible"
      />

      <Input
        label="Descripción"
        value={node.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Propósito del nodo"
      />

      {/* human_task config (PD-182, PD-444) */}
      {node.node_type === 'human_task' && node.config._type === 'human_task' && (() => {
        const cfg = node.config
        const missingForm = !cfg.form_ref
        return (
          <>
            <Select
              label="Formulario *"
              options={formOptions}
              value={cfg.form_ref}
              onChange={(e) => onChange({ config: { ...cfg, form_ref: e.target.value } })}
              {...(missingForm ? { error: 'Requerido — sin formulario el nodo no está configurado' } : {})}
            />
            <Select
              label="Tipo de asignación"
              options={[
                { value: 'role', label: 'Rol' },
                { value: 'user', label: 'Usuario' },
                { value: 'variable', label: 'Variable de contexto' },
              ]}
              value={cfg.assignment.type}
              onChange={(e) =>
                onChange({ config: { ...cfg, assignment: { type: e.target.value as 'role' | 'user' | 'variable', value: cfg.assignment.value } } })
              }
            />
            <Input
              label={cfg.assignment.type === 'role' ? 'Rol' : cfg.assignment.type === 'user' ? 'Usuario' : 'Variable'}
              value={cfg.assignment.value}
              onChange={(e) =>
                onChange({ config: { ...cfg, assignment: { ...cfg.assignment, value: e.target.value } } })
              }
              placeholder={cfg.assignment.type === 'role' ? 'employee, manager, hr…' : cfg.assignment.type === 'user' ? 'user_id…' : 'nombre_variable…'}
            />
            <Input
              label="Plazo (días)"
              type="number"
              value={cfg.due_in ?? ''}
              onChange={(e) =>
                onChange({ config: { ...cfg, due_in: e.target.value ? Number(e.target.value) : null } })
              }
              placeholder="Sin plazo"
              hint="Días desde que se asigna la tarea"
            />
          </>
        )
      })()}

      {/* script_task config (PD-182) */}
      {node.node_type === 'script_task' && node.config._type === 'script_task' && (() => {
        const cfg = node.config
        return (
          <>
            <div className="flex items-start gap-2 rounded-md bg-[var(--state-warning-bg)] px-3 py-2 text-caption text-[var(--state-warning-text)]">
              <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" aria-hidden />
              No ejecutable en el motor MVP v1.0
            </div>
            <Select
              label="Lenguaje"
              options={[{ value: 'javascript', label: 'JavaScript' }]}
              value={cfg.language}
              onChange={(e) => onChange({ config: { ...cfg, language: e.target.value } })}
            />
            <Textarea
              label="Código fuente"
              value={cfg.source}
              onChange={(e) => onChange({ config: { ...cfg, source: e.target.value } })}
              placeholder="// Tu código aquí…"
              rows={8}
            />
          </>
        )
      })()}

      {/* exclusive_gateway config (PD-182) */}
      {node.node_type === 'exclusive_gateway' && node.config._type === 'exclusive_gateway' && (() => {
        const cfg = node.config
        const transitionOptions = [
          { value: '', label: '— Sin default —' },
          ...outgoingTransitions.map((t) => ({ value: t.id, label: t.label || t.id })),
        ]
        return (
          <>
            <div className="flex items-start gap-2 rounded-md bg-[var(--state-warning-bg)] px-3 py-2 text-caption text-[var(--state-warning-text)]">
              <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" aria-hidden />
              No ejecutable en el motor MVP v1.0
            </div>
            <Select
              label="Transición por defecto"
              options={transitionOptions}
              value={cfg.default_transition_id ?? ''}
              onChange={(e) =>
                onChange({ config: { ...cfg, default_transition_id: e.target.value || null } })
              }
              hint="Se toma si ninguna condición se cumple"
            />
          </>
        )
      })()}

      {/* end config (PD-182) */}
      {node.node_type === 'end' && node.config._type === 'end' && (() => {
        const cfg = node.config
        return (
          <Input
            label="Etiqueta de resultado"
            value={cfg.result_label}
            onChange={(e) => onChange({ config: { ...cfg, result_label: e.target.value } })}
            placeholder="Completado"
          />
        )
      })()}
    </div>
  )
}

// ── Edge properties ────────────────────────────────────────────────────────────

interface EdgePanelProps {
  edge: Edge
  onChange: (patch: Partial<Edge & { label: string; data: Record<string, unknown> }>) => void
}

function EdgePanel({ edge, onChange }: EdgePanelProps) {
  const condition = (edge.data as Record<string, unknown> | undefined)?.condition as string ?? ''
  const hasCondition = !!condition

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Etiqueta"
        value={typeof edge.label === 'string' ? edge.label : ''}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="Ej: Aprobado"
      />
      <Input
        label="Condición"
        value={condition}
        onChange={(e) =>
          onChange({ data: { ...(edge.data as Record<string, unknown> ?? {}), condition: e.target.value } })
        }
        placeholder="Expresión de condición"
        hint="El motor MVP no evalúa condiciones"
      />
      {hasCondition && (
        <div className="rounded-md bg-[var(--state-warning-bg)] px-3 py-2 text-caption text-[var(--state-warning-text)]">
          ⚠ Las condiciones no se evalúan en el motor MVP
        </div>
      )}
    </div>
  )
}

// ── ProcessPropertiesPanel ─────────────────────────────────────────────────────

export type Selection =
  | { type: 'none' }
  | { type: 'node'; node: ProcessNode }
  | { type: 'edge'; edge: Edge }

interface Props {
  selection: Selection
  processName: string
  processDescription: string
  contextVariables: ContextVariable[]
  forms: FormDefinition[]
  /** Outgoing transitions from the selected node — needed for gateway default_transition_id */
  outgoingTransitions: OutgoingTransition[]
  collapsed: boolean
  onToggleCollapse: () => void
  onProcessNameChange: (v: string) => void
  onProcessDescriptionChange: (v: string) => void
  onContextVariablesChange: (vars: ContextVariable[]) => void
  onNodeChange: (nodeId: string, patch: Partial<ProcessNode> & { config?: ProcessNode['config'] }) => void
  onEdgeChange: (edgeId: string, patch: Partial<Edge & { label: string; data: Record<string, unknown> }>) => void
}

export function ProcessPropertiesPanel({
  selection, processName, processDescription, contextVariables, forms, outgoingTransitions,
  collapsed, onToggleCollapse,
  onProcessNameChange, onProcessDescriptionChange, onContextVariablesChange,
  onNodeChange, onEdgeChange,
}: Props) {
  return (
    <aside
      className={[
        'flex flex-shrink-0 flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-all',
        collapsed ? 'w-10' : 'w-72',
      ].join(' ')}
    >
      {collapsed ? (
        <button
          onClick={onToggleCollapse}
          className="flex h-full w-full flex-col items-center justify-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          aria-label="Expandir propiedades"
          title="Propiedades"
        >
          <ChevronLeft size={16} aria-hidden />
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2">
            <span className="text-label font-semibold uppercase text-[var(--text-tertiary)]">
              {selection.type === 'node'
                ? 'Nodo'
                : selection.type === 'edge'
                  ? 'Conexión'
                  : 'Proceso'}
            </span>
            <button
              onClick={onToggleCollapse}
              className="rounded p-0.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-primary)]"
              aria-label="Colapsar propiedades"
            >
              <ChevronLeft size={14} className="rotate-180" aria-hidden />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {selection.type === 'none' && (
              <ProcessPanel
                name={processName}
                description={processDescription}
                contextVariables={contextVariables}
                onNameChange={onProcessNameChange}
                onDescriptionChange={onProcessDescriptionChange}
                onVariablesChange={onContextVariablesChange}
              />
            )}

            {selection.type === 'node' && (
              <NodePanel
                node={selection.node}
                forms={forms}
                outgoingTransitions={outgoingTransitions}
                onChange={(patch) => onNodeChange(selection.node.id_node, patch)}
              />
            )}

            {selection.type === 'edge' && (
              <EdgePanel
                edge={selection.edge}
                onChange={(patch) => onEdgeChange(selection.edge.id, patch)}
              />
            )}
          </div>
        </>
      )}
    </aside>
  )
}
