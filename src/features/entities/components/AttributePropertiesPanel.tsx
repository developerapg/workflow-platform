import { ChevronRight } from 'lucide-react'
import type { AttributeRow } from './AttributeTable'
import { Input, Select, Checkbox } from '@/ui'
import { cn } from '@/lib/cn'

const DATA_TYPE_OPTIONS = [
  { value: 'uuid', label: 'UUID' },
  { value: 'string', label: 'String (texto)' },
  { value: 'integer', label: 'Integer (entero)' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date (fecha)' },
  { value: 'datetime', label: 'Datetime (fecha y hora)' },
  { value: 'json', label: 'JSON' },
]

interface Props {
  attribute: AttributeRow | null
  collapsed: boolean
  onToggleCollapse: () => void
  onChange: (updated: AttributeRow) => void
}

export function AttributePropertiesPanel({ attribute, collapsed, onToggleCollapse, onChange }: Props) {
  return (
    <aside
      className={cn(
        'flex flex-shrink-0 flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-all duration-200',
        collapsed ? 'w-8' : 'w-72',
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="flex h-10 items-center justify-between border-b border-[var(--border-subtle)] px-3 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        aria-label={collapsed ? 'Expandir panel' : 'Colapsar panel'}
      >
        {!collapsed && (
          <span className="text-label uppercase text-[var(--text-tertiary)]">Propiedades</span>
        )}
        <ChevronRight
          size={14}
          className={cn('transition-transform', collapsed ? '' : 'rotate-180')}
          aria-hidden
        />
      </button>

      {!collapsed && (
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {!attribute ? (
            <p className="text-center text-caption text-[var(--text-muted)]">
              Selecciona un atributo para editar sus propiedades
            </p>
          ) : (
            <>
              {/* Read-only info */}
              {attribute.metadata.is_primary_key && (
                <div className="rounded-md bg-[var(--state-neutral-bg)] px-3 py-2 text-caption text-[var(--text-muted)]">
                  Clave primaria — no editable
                </div>
              )}

              <Input
                label="Nombre técnico"
                value={attribute.name}
                onChange={(e) => onChange({ ...attribute, name: e.target.value })}
                placeholder="nombre_campo"
                disabled={attribute.metadata.is_primary_key}
                hint="snake_case, ej: fecha_inicio"
              />

              <Input
                label="Descripción"
                value={attribute.description}
                onChange={(e) => onChange({ ...attribute, description: e.target.value })}
                placeholder="Descripción del campo"
              />

              <Select
                label="Tipo de dato"
                value={attribute.data_type}
                options={DATA_TYPE_OPTIONS}
                onChange={(e) => onChange({ ...attribute, data_type: e.target.value as AttributeRow['data_type'] })}
                disabled={attribute.metadata.is_primary_key}
              />

              <div className="flex flex-col gap-2">
                <span className="text-label uppercase text-[var(--text-tertiary)]">Restricciones</span>
                <Checkbox
                  label="Requerido"
                  checked={attribute.required}
                  onChange={(e) => onChange({ ...attribute, required: e.target.checked })}
                  disabled={attribute.metadata.is_primary_key}
                />
                <Checkbox
                  label="Único"
                  checked={attribute.is_unique}
                  onChange={(e) => onChange({ ...attribute, is_unique: e.target.checked })}
                  disabled={attribute.metadata.is_primary_key}
                />
                <Checkbox
                  label="Clave de negocio"
                  checked={attribute.is_business_key}
                  onChange={(e) => onChange({ ...attribute, is_business_key: e.target.checked })}
                  description="Se usa para identificar unicidad a nivel negocio"
                />
              </div>

              <Input
                label="Valor por defecto"
                value={attribute.default_value != null ? String(attribute.default_value) : ''}
                onChange={(e) => onChange({ ...attribute, default_value: e.target.value || null })}
                placeholder="Sin valor por defecto"
              />

              {/* Physical column */}
              <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] p-3">
                <p className="text-label uppercase text-[var(--text-tertiary)]">Columna física</p>
                <p className="mt-1 font-mono text-body-sm text-[var(--text-muted)]">
                  {attribute.metadata.source || attribute.name}
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  )
}
