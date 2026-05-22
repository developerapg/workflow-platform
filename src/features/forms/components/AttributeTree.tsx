import { useState } from 'react'
import { ChevronRight, ChevronDown, GripVertical, Search } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import type { Entity, Attribute } from '@/api/types'
import { DATA_TYPE_COLOR } from '@/lib/dataTypeColors'

// ── DraggableAttribute ────────────────────────────────────────────────────────

interface DraggableAttrProps {
  attribute: Attribute
  xPath: string | null
  isRelated: boolean
}

function DraggableAttribute({ attribute, xPath, isRelated }: DraggableAttrProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `attr::${attribute.id_attribute}::${xPath ?? ''}`,
    data: { attribute, xPath },
  })

  const color = DATA_TYPE_COLOR[attribute.data_type] ?? 'var(--text-muted)'

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={[
        'flex cursor-grab items-center gap-2 rounded px-2 py-1.5 text-body-sm',
        'hover:bg-[var(--bg-surface-elevated)] active:cursor-grabbing',
        isDragging && 'opacity-40',
      ]
        .filter(Boolean)
        .join(' ')}
      title={`Arrastrar "${attribute.name}" al lienzo`}
    >
      <GripVertical size={12} className="flex-shrink-0 text-[var(--text-muted)]" aria-hidden />
      <span
        className="h-2 w-2 flex-shrink-0 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      <span className="flex-1 truncate font-mono text-[var(--text-primary)]">
        {attribute.name}
      </span>
      {isRelated && (
        <span className="rounded-sm bg-blue-500/10 px-1 text-tiny font-semibold uppercase text-blue-400">
          rel
        </span>
      )}
    </div>
  )
}

// ── RelatedEntitySection ──────────────────────────────────────────────────────

interface RelatedSectionProps {
  relation: { id: string; name: string; related_entity_id: string }
  relatedEntity: Entity | undefined
  relatedAttributes: Attribute[]
}

function RelatedEntitySection({ relation, relatedEntity, relatedAttributes }: RelatedSectionProps) {
  const [open, setOpen] = useState(false)
  const xPathPrefix = relation.name

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-body-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)]"
      >
        {open ? (
          <ChevronDown size={13} aria-hidden />
        ) : (
          <ChevronRight size={13} aria-hidden />
        )}
        <span className="font-mono font-medium text-[var(--text-primary)]">{relation.name}</span>
        <span className="text-[var(--text-muted)]">
          ({relatedEntity?.object_name ?? relation.related_entity_id})
        </span>
      </button>

      {open && (
        <div className="ml-4 border-l border-[var(--border-subtle)] pl-2">
          {relatedAttributes.map((attr) => (
            <DraggableAttribute
              key={attr.id_attribute}
              attribute={attr}
              xPath={`${xPathPrefix}.${attr.name}`}
              isRelated
            />
          ))}
          {relatedAttributes.length === 0 && (
            <p className="px-2 py-1 text-caption text-[var(--text-muted)]">Sin atributos</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── AttributeTree ─────────────────────────────────────────────────────────────

interface Props {
  baseEntity: Entity
  baseAttributes: Attribute[]
  allEntities: Entity[]
  allAttributes: Record<string, Attribute[]>
  collapsed: boolean
  onToggleCollapse: () => void
}

export function AttributeTree({
  baseEntity,
  baseAttributes,
  allEntities,
  allAttributes,
  collapsed,
  onToggleCollapse,
}: Props) {
  const [search, setSearch] = useState('')

  const filteredBase = search
    ? baseAttributes.filter((a) => a.name.includes(search.toLowerCase()))
    : baseAttributes

  return (
    <aside
      className={[
        'flex flex-shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-all',
        collapsed ? 'w-10' : 'w-64',
      ].join(' ')}
    >
      {collapsed ? (
        <button
          onClick={onToggleCollapse}
          className="flex h-full w-full flex-col items-center justify-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          aria-label="Expandir árbol de atributos"
          title="Atributos"
        >
          <ChevronRight size={16} aria-hidden />
        </button>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2">
            <span className="text-label font-semibold uppercase text-[var(--text-tertiary)]">
              Atributos
            </span>
            <button
              onClick={onToggleCollapse}
              className="rounded p-0.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-primary)]"
              aria-label="Colapsar árbol"
            >
              <ChevronRight size={14} className="rotate-180" aria-hidden />
            </button>
          </div>

          {/* Search */}
          <div className="relative px-2 py-2">
            <Search
              size={12}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              aria-hidden
            />
            <input
              type="search"
              placeholder="Buscar atributo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 w-full rounded-sm border border-[var(--border-default)] bg-[var(--bg-input)] pl-7 pr-2 text-caption text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--action-primary)] focus:outline-none"
            />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-1 pb-4">
            {/* Base entity section */}
            <div className="mb-2">
              <div className="mb-1 px-2 py-1">
                <span className="rounded-sm bg-[var(--action-bg-subtle)] px-1.5 py-0.5 font-mono text-tiny font-semibold text-[var(--action-text)]">
                  {baseEntity.object_name}
                </span>
              </div>
              {filteredBase.map((attr) => (
                <DraggableAttribute
                  key={attr.id_attribute}
                  attribute={attr}
                  xPath={null}
                  isRelated={false}
                />
              ))}
              {filteredBase.length === 0 && (
                <p className="px-2 py-1 text-caption text-[var(--text-muted)]">
                  {search ? 'Sin coincidencias' : 'Sin atributos'}
                </p>
              )}
            </div>

            {/* Related entities */}
            {!search &&
              baseEntity.content.relations.map((rel) => {
                const relEntity = allEntities.find((e) => e.id_object === rel.related_entity_id)
                const relAttrs = allAttributes[rel.related_entity_id] ?? []
                return (
                  <RelatedEntitySection
                    key={rel.id}
                    relation={rel}
                    relatedEntity={relEntity}
                    relatedAttributes={relAttrs}
                  />
                )
              })}
          </div>

          {/* Hint */}
          <div className="border-t border-[var(--border-subtle)] px-3 py-2 text-tiny text-[var(--text-muted)]">
            Arrastra atributos al lienzo para agregarlos al formulario
          </div>
        </>
      )}
    </aside>
  )
}
