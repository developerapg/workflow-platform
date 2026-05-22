import { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Copy, ChevronDown } from 'lucide-react'
import type { Attribute, DataType } from '@/api/types'
import type { ArtifactState } from '@/ui'
import { cn } from '@/lib/cn'

const NAME_RE = /^[a-z][a-z0-9_]{0,62}$/

function attrState(attr: AttributeRow): ArtifactState {
  if (!attr.name) return attr._isNew ? 'draft' : 'error'
  if (!NAME_RE.test(attr.name)) return 'error'
  return 'configured'
}

const rowLeftBorder: Record<ArtifactState, string> = {
  configured: 'border-l-2 border-l-[var(--state-success)]',
  warning:    'border-l-2 border-l-[var(--state-warning)]',
  error:      'border-l-2 border-l-[var(--state-error)]',
  draft:      'border-l-2 border-l-[var(--border-default)]',
}

const dotColorClass: Record<ArtifactState, string> = {
  configured: 'bg-[var(--state-success)]',
  warning:    'bg-[var(--state-warning)]',
  error:      'bg-[var(--state-error)]',
  draft:      'bg-[var(--state-neutral)]',
}

// Color tokens per data type — UX Spec §3.1
const TYPE_COLOR: Record<DataType, string> = {
  uuid: 'text-[#93C5FD] bg-[#93C5FD1A]',
  string: 'text-[#FBBF24] bg-[#FBBF241A]',
  integer: 'text-[#A78BFA] bg-[#A78BFA1A]',
  decimal: 'text-[#A78BFA] bg-[#A78BFA1A]',
  boolean: 'text-[#FB923C] bg-[#FB923C1A]',
  date: 'text-[#34D399] bg-[#34D3991A]',
  datetime: 'text-[#34D399] bg-[#34D3991A]',
  json: 'text-[#F472B6] bg-[#F472B61A]',
}

const DATA_TYPES: DataType[] = [
  'uuid', 'string', 'integer', 'decimal', 'boolean', 'date', 'datetime', 'json',
]

export interface AttributeRow extends Attribute {
  /** client-only: unsaved new row */
  _isNew?: boolean
  /** client-only: marked for deletion */
  _deleted?: boolean
}

interface Props {
  attributes: AttributeRow[]
  selectedId: string | null
  onSelect: (id: string) => void
  onChange: (attrs: AttributeRow[]) => void
}

function SortableRow({
  attr,
  isSelected,
  onSelect,
  onChange,
  onDelete,
  onDuplicate,
}: {
  attr: AttributeRow
  isSelected: boolean
  onSelect: () => void
  onChange: (updated: AttributeRow) => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: attr.id_attribute })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const [nameError, setNameError] = useState('')

  const handleNameChange = (v: string) => {
    if (v && !/^[a-z][a-z0-9_]{0,62}$/.test(v)) {
      setNameError('snake_case requerido')
    } else {
      setNameError('')
    }
    onChange({ ...attr, name: v })
  }

  const state = attrState(attr)

  return (
    <tr
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        'group border-b border-[var(--border-subtle)] transition-colors last:border-0',
        rowLeftBorder[state],
        isDragging ? 'opacity-50' : '',
        isSelected
          ? 'bg-[var(--action-bg-subtle)]'
          : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)]',
        'cursor-pointer',
      )}
    >
      {/* Drag handle */}
      <td className="w-8 px-2 py-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Reordenar"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={14} />
        </button>
      </td>

      {/* Name */}
      <td className="px-3 py-2">
        <div className="flex flex-col gap-0.5">
          <input
            value={attr.name}
            onChange={(e) => handleNameChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="nombre_atributo"
            className={cn(
              'w-full rounded border border-transparent bg-transparent font-mono text-body-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
              'focus:border-[var(--action-primary)] focus:bg-[var(--bg-input)] focus:px-2 focus:outline-none',
              nameError && 'border-[var(--state-error)]',
            )}
          />
          {nameError && (
            <span className="text-caption text-[var(--state-error-text)]">{nameError}</span>
          )}
        </div>
      </td>

      {/* Data type */}
      <td className="px-3 py-2">
        <div className="relative inline-flex items-center">
          <select
            value={attr.data_type}
            onChange={(e) => onChange({ ...attr, data_type: e.target.value as DataType })}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'appearance-none rounded-sm px-2 py-0.5 pr-5 text-tiny font-semibold uppercase',
              TYPE_COLOR[attr.data_type],
              'border-0 focus:outline-none focus:ring-1 focus:ring-[var(--action-primary)]',
            )}
          >
            {DATA_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <ChevronDown size={10} className="pointer-events-none absolute right-1 text-current" aria-hidden />
        </div>
      </td>

      {/* Flags */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {attr.metadata.is_primary_key && (
            <FlagChip label="PK" color="text-[#C4B5FD] bg-[#C4B5FD1A]" />
          )}
          {attr.metadata.is_foreign_key && (
            <FlagChip label="FK" color="text-[#F2B055] bg-[#F2B0551A]" />
          )}
          <FlagToggle
            label="REQ"
            active={attr.required}
            onToggle={() => onChange({ ...attr, required: !attr.required })}
          />
          <FlagToggle
            label="UNQ"
            active={attr.is_unique}
            onToggle={() => onChange({ ...attr, is_unique: !attr.is_unique })}
          />
          <FlagToggle
            label="BK"
            active={attr.is_business_key}
            onToggle={() => onChange({ ...attr, is_business_key: !attr.is_business_key })}
          />
        </div>
      </td>

      {/* Actions + state dot */}
      <td className="w-16 px-2 py-2">
        <div className="flex items-center gap-1">
          <span
            aria-label={`Estado: ${state}`}
            className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full transition-colors group-hover:opacity-0', dotColorClass[state])}
          />
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate() }}
              className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-primary)]"
              aria-label="Duplicar"
            >
              <Copy size={13} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--state-error-bg)] hover:text-[var(--state-error-text)]"
              aria-label="Eliminar"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

function FlagChip({ label, color }: { label: string; color: string }) {
  return (
    <span className={cn('rounded-sm px-1 py-0.5 text-tiny font-semibold uppercase', color)}>
      {label}
    </span>
  )
}

function FlagToggle({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'rounded-sm px-1 py-0.5 text-tiny font-semibold uppercase transition-colors',
        active
          ? 'bg-[var(--action-bg-subtle)] text-[var(--action-text)]'
          : 'bg-[var(--state-neutral-bg)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
      )}
    >
      {label}
    </button>
  )
}

export function AttributeTable({ attributes, selectedId, onSelect, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (over && active.id !== over.id) {
        const oldIdx = attributes.findIndex((a) => a.id_attribute === active.id)
        const newIdx = attributes.findIndex((a) => a.id_attribute === over.id)
        const reordered = arrayMove(attributes, oldIdx, newIdx).map((a, i) => ({ ...a, ordinal: i }))
        onChange(reordered)
      }
    },
    [attributes, onChange],
  )

  const update = useCallback(
    (updated: AttributeRow) => onChange(attributes.map((a) => (a.id_attribute === updated.id_attribute ? updated : a))),
    [attributes, onChange],
  )

  const remove = useCallback(
    (id: string) => onChange(attributes.filter((a) => a.id_attribute !== id)),
    [attributes, onChange],
  )

  const duplicate = useCallback(
    (attr: AttributeRow) => {
      const clone: AttributeRow = {
        ...attr,
        id_attribute: `new-${crypto.randomUUID()}`,
        name: `${attr.name}_copia`,
        ordinal: attributes.length,
        _isNew: true,
      }
      onChange([...attributes, clone])
    },
    [attributes, onChange],
  )

  if (!attributes.length) return null

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
              <th className="w-8" />
              <th className="px-3 py-2 text-left text-label uppercase text-[var(--text-tertiary)]">Nombre</th>
              <th className="px-3 py-2 text-left text-label uppercase text-[var(--text-tertiary)]">Tipo</th>
              <th className="px-3 py-2 text-left text-label uppercase text-[var(--text-tertiary)]">Marcas</th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            <SortableContext items={attributes.map((a) => a.id_attribute)} strategy={verticalListSortingStrategy}>
              {attributes.map((attr) => (
                <SortableRow
                  key={attr.id_attribute}
                  attr={attr}
                  isSelected={selectedId === attr.id_attribute}
                  onSelect={() => onSelect(attr.id_attribute)}
                  onChange={update}
                  onDelete={() => remove(attr.id_attribute)}
                  onDuplicate={() => duplicate(attr)}
                />
              ))}
            </SortableContext>
          </tbody>
        </table>
      </div>
    </DndContext>
  )
}
