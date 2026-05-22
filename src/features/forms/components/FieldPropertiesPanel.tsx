import { ChevronLeft } from 'lucide-react'
import { Input, Select, Checkbox, Textarea } from '@/ui'
import type { FormField, ComponentType } from '@/api/types'
import type { EnrichedField } from '../types'
import { DATA_TYPE_LABEL } from '@/lib/dataTypeColors'

const COMPONENT_OPTIONS: { value: ComponentType; label: string }[] = [
  { value: 'text_input', label: 'Texto corto' },
  { value: 'number_input', label: 'Número' },
  { value: 'date_picker', label: 'Selector de fecha' },
  { value: 'date_time_picker', label: 'Selector de fecha/hora' },
  { value: 'checkbox', label: 'Casilla de verificación' },
  { value: 'select', label: 'Selector desplegable' },
  { value: 'textarea', label: 'Área de texto' },
  { value: 'lookup', label: 'Búsqueda/lookup' },
]

interface Props {
  selected: EnrichedField | null
  collapsed: boolean
  onToggleCollapse: () => void
  onChange: (updated: FormField) => void
}

export function FieldPropertiesPanel({ selected, collapsed, onToggleCollapse, onChange }: Props) {
  const { field, attribute } = selected ?? {}

  const update = (patch: Partial<FormField>) => {
    if (!field) return
    onChange({ ...field, ...patch })
  }

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
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2">
            <span className="text-label font-semibold uppercase text-[var(--text-tertiary)]">
              Propiedades
            </span>
            <button
              onClick={onToggleCollapse}
              className="rounded p-0.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-primary)]"
              aria-label="Colapsar propiedades"
            >
              <ChevronLeft size={14} className="rotate-180" aria-hidden />
            </button>
          </div>

          {/* Content */}
          {!field ? (
            <div className="flex flex-1 items-center justify-center px-4 text-center">
              <p className="text-body-sm text-[var(--text-muted)]">
                Selecciona un campo para editar sus propiedades
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {/* Attribute meta (read-only) */}
              <div className="mb-3 rounded-md bg-[var(--bg-surface-elevated)] px-3 py-2">
                <p className="mb-0.5 text-label uppercase text-[var(--text-tertiary)]">Atributo</p>
                <p className="font-mono text-body-sm text-[var(--text-primary)]">
                  {field.x_path ?? field.attribute_ref}
                </p>
                {attribute && (
                  <p className="mt-0.5 text-caption text-[var(--text-muted)]">
                    {DATA_TYPE_LABEL[attribute.data_type]}
                    {attribute.metadata.is_primary_key && ' · PK'}
                    {attribute.metadata.is_foreign_key && ' · FK'}
                  </p>
                )}
                {field.x_path && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {field.x_path.split('.').map((part, i) => (
                      <span
                        key={i}
                        className="rounded-sm bg-blue-500/10 px-1 text-tiny text-blue-400"
                      >
                        {part}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <Input
                  label="Etiqueta visible"
                  value={field.label}
                  onChange={(e) => update({ label: e.target.value })}
                  placeholder="Nombre del campo"
                />

                <Input
                  label="Placeholder"
                  value={field.placeholder}
                  onChange={(e) => update({ placeholder: e.target.value })}
                  placeholder="Texto de ayuda dentro del campo"
                />

                <Textarea
                  label="Texto de ayuda"
                  value={field.help_text}
                  onChange={(e) => update({ help_text: e.target.value })}
                  placeholder="Instrucción o contexto para el usuario"
                  rows={2}
                />

                <Select
                  label="Componente UI"
                  options={COMPONENT_OPTIONS}
                  value={field.component}
                  onChange={(e) => update({ component: e.target.value as ComponentType })}
                />

                <div className="flex flex-col gap-2">
                  <p className="text-label uppercase text-[var(--text-tertiary)]">Comportamiento</p>
                  <Checkbox
                    label="Requerido"
                    checked={field.required}
                    onChange={(e) => update({ required: e.target.checked })}
                  />
                  <Checkbox
                    label="Solo lectura"
                    checked={field.read_only}
                    onChange={(e) => update({ read_only: e.target.checked })}
                  />
                  <Checkbox
                    label="Oculto"
                    checked={field.hidden}
                    onChange={(e) => update({ hidden: e.target.checked })}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  )
}
