import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Eye, EyeOff, Lock } from 'lucide-react'
import type { FormField } from '@/api/types'
import type { EnrichedField } from '../types'
import { DATA_TYPE_COLOR } from '@/lib/dataTypeColors'
import type { ArtifactState } from '@/ui'

// VR-20: every form field must have attribute_ref
function fieldState(field: FormField): ArtifactState {
  if (!field.attribute_ref) return 'error'
  if (!field.label) return 'warning'
  return 'configured'
}

const fieldBorder: Record<ArtifactState, string> = {
  configured: 'border-[var(--state-success)]/40 [box-shadow:var(--state-success-glow)]',
  warning:    'border-[var(--state-warning)]/40 [box-shadow:var(--state-warning-glow)]',
  error:      'border-[var(--state-error)]/50 [box-shadow:var(--state-error-glow)]',
  draft:      'border-[var(--border-subtle)]',
}

const fieldDot: Record<ArtifactState, string> = {
  configured: 'bg-[var(--state-success)]',
  warning:    'bg-[var(--state-warning)]',
  error:      'bg-[var(--state-error)]',
  draft:      'bg-[var(--state-neutral)]',
}

// ── Component type display labels ─────────────────────────────────────────────

const COMPONENT_LABEL: Record<string, string> = {
  text_input: 'Texto',
  number_input: 'Número',
  date_picker: 'Fecha',
  date_time_picker: 'Fecha/Hora',
  checkbox: 'Casilla',
  select: 'Selector',
  textarea: 'Área de texto',
  lookup: 'Búsqueda',
}

// ── Field card placeholder inputs ─────────────────────────────────────────────

function FieldPlaceholder({ field }: { field: FormField }) {
  const base =
    'pointer-events-none w-full rounded-sm border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 text-body-sm text-[var(--text-muted)]'
  switch (field.component) {
    case 'checkbox':
      return (
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-sm border border-[var(--border-default)] bg-[var(--bg-input)]" />
          <span className="text-body-sm text-[var(--text-muted)]">{field.label}</span>
        </div>
      )
    case 'textarea':
      return <div className={`${base} h-14 py-1.5`}>{field.placeholder || '—'}</div>
    default:
      return <div className={`${base} h-8 py-1.5`}>{field.placeholder || '—'}</div>
  }
}

// ── SortableFieldCard ─────────────────────────────────────────────────────────

interface SortableFieldCardProps {
  enriched: EnrichedField
  isSelected: boolean
  onSelect: () => void
  onRemove: () => void
}

function SortableFieldCard({ enriched, isSelected, onSelect, onRemove }: SortableFieldCardProps) {
  const { field, attribute } = enriched
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const typeColor = attribute ? DATA_TYPE_COLOR[attribute.data_type] : 'var(--text-muted)'
  const isRelated = !!field.x_path
  const state = fieldState(field)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'group relative rounded-lg border bg-[var(--bg-surface)] p-3 transition-all',
        isSelected
          ? 'border-[var(--action-primary)] ring-1 ring-[var(--action-primary)]'
          : fieldBorder[state],
        isDragging && 'opacity-50 shadow-lg',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      aria-selected={isSelected}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Reordenar campo"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={14} aria-hidden />
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Label row */}
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-body-sm font-medium text-[var(--text-primary)]">
              {field.component !== 'checkbox' && field.label}
            </span>

            {field.required && (
              <span className="rounded-sm bg-[var(--state-error-bg)] px-1 text-tiny font-semibold uppercase text-[var(--state-error-text)]">
                REQ
              </span>
            )}
            {field.read_only && (
              <span className="flex items-center gap-0.5 rounded-sm bg-[var(--state-neutral-bg)] px-1 text-tiny font-semibold uppercase text-[var(--state-neutral)]">
                <Lock size={8} aria-hidden /> RO
              </span>
            )}
            {field.hidden && (
              <span className="flex items-center gap-0.5 rounded-sm bg-[var(--state-neutral-bg)] px-1 text-tiny font-semibold uppercase text-[var(--state-neutral)]">
                <EyeOff size={8} aria-hidden />
              </span>
            )}
            {isRelated && (
              <span className="rounded-sm bg-blue-500/10 px-1 text-tiny font-semibold uppercase text-blue-400">
                campo relacionado
              </span>
            )}
          </div>

          {/* Input preview */}
          <FieldPlaceholder field={field} />

          {/* Footer row */}
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${fieldDot[state]}`}
              aria-label={`Campo ${state}`}
            />
            <span className="font-mono text-tiny text-[var(--text-muted)]" style={{ color: typeColor }}>
              {field.x_path ?? field.attribute_ref ?? 'sin atributo'}
            </span>
            <span className="ml-auto text-tiny text-[var(--text-muted)]">
              {COMPONENT_LABEL[field.component] ?? field.component}
            </span>
          </div>
        </div>

        {/* Remove button */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="mt-0.5 rounded p-0.5 text-[var(--text-muted)] opacity-0 transition-opacity hover:bg-[var(--state-error-bg)] hover:text-[var(--state-error-text)] group-hover:opacity-100"
          aria-label={`Eliminar campo "${field.label}"`}
        >
          <Trash2 size={13} aria-hidden />
        </button>
      </div>
    </div>
  )
}

// ── DropZone ──────────────────────────────────────────────────────────────────

function DropZone({ isOver }: { isOver: boolean }) {
  return (
    <div
      className={[
        'rounded-lg border-2 border-dashed py-8 text-center transition-colors',
        isOver
          ? 'border-[var(--action-primary)] bg-[var(--action-bg-subtle)]'
          : 'border-[var(--border-default)]',
      ].join(' ')}
    >
      <p className="text-body-sm text-[var(--text-muted)]">
        {isOver ? 'Suelta aquí para agregar' : 'Arrastra atributos aquí para agregar campos'}
      </p>
    </div>
  )
}

// ── FormCanvas ────────────────────────────────────────────────────────────────

interface Props {
  formName: string
  onFormNameChange: (v: string) => void
  baseEntityName: string
  enrichedFields: EnrichedField[]
  selectedFieldId: string | null
  onSelectField: (id: string) => void
  onRemoveField: (id: string) => void
  isOver: boolean
}

export function FormCanvas({
  formName,
  onFormNameChange,
  baseEntityName,
  enrichedFields,
  selectedFieldId,
  onSelectField,
  onRemoveField,
  isOver,
}: Props) {
  const { setNodeRef } = useDroppable({ id: 'canvas-drop' })

  const fieldIds = enrichedFields.map((ef) => ef.field.id)
  const visibleFields = enrichedFields.filter((ef) => !ef.field.hidden)
  const hiddenCount = enrichedFields.length - visibleFields.length

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg-canvas)]">
      {/* Canvas header */}
      <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-3">
        <input
          type="text"
          value={formName}
          onChange={(e) => onFormNameChange(e.target.value)}
          className="w-full bg-transparent text-h2 font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          placeholder="Nombre del formulario"
          aria-label="Nombre del formulario"
        />
        <p className="mt-0.5 text-caption text-[var(--text-muted)]">
          basado en <span className="font-mono">{baseEntityName}</span>
          {' · '}
          {enrichedFields.length} campo{enrichedFields.length !== 1 && 's'}
          {hiddenCount > 0 && (
            <span className="ml-1">
              (<Eye size={10} className="inline" aria-hidden /> {hiddenCount} oculto{hiddenCount !== 1 && 's'})
            </span>
          )}
        </p>
      </div>

      {/* Scrollable field list */}
      <div ref={setNodeRef} className="flex-1 overflow-y-auto px-6 py-4">
        <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {enrichedFields.map((ef) => (
              <SortableFieldCard
                key={ef.field.id}
                enriched={ef}
                isSelected={selectedFieldId === ef.field.id}
                onSelect={() => onSelectField(ef.field.id)}
                onRemove={() => onRemoveField(ef.field.id)}
              />
            ))}
          </div>
        </SortableContext>

        {/* Drop zone at the end */}
        <div className="mt-3">
          <DropZone isOver={isOver && enrichedFields.length > 0} />
        </div>

        {enrichedFields.length === 0 && (
          <div
            className={[
              'mb-3 rounded-lg border-2 border-dashed py-16 text-center transition-colors',
              isOver
                ? 'border-[var(--action-primary)] bg-[var(--action-bg-subtle)]'
                : 'border-[var(--border-default)]',
            ].join(' ')}
          >
            <p className="text-body-sm text-[var(--text-muted)]">
              {isOver
                ? 'Suelta aquí para agregar el primer campo'
                : 'Arrastra atributos desde el panel izquierdo'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
