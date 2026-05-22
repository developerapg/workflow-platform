import { Plus, ArrowRight } from 'lucide-react'
import type { EntityRelation, Entity } from '@/api/types'
import { Button } from '@/ui'

interface Props {
  relations: EntityRelation[]
  allEntities: Entity[]
}

const CARDINALITY_LABEL: Record<string, string> = {
  'N:1': 'Muchos → Uno',
  '1:N': 'Uno → Muchos',
  '1:1': 'Uno → Uno',
  'N:N': 'Muchos → Muchos',
}

export function RelationsSection({ relations, allEntities }: Props) {
  const resolveEntityName = (id: string) =>
    allEntities.find((e) => e.id_object === id)?.object_name ?? id

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-label uppercase text-[var(--text-tertiary)]">Relaciones</span>
        {/* Wizard de relaciones — diferido a Fase 3 hardening */}
        <Button variant="ghost" size="sm" disabled title="Wizard de relaciones — próximamente">
          <Plus size={14} aria-hidden /> Agregar relación
        </Button>
      </div>

      {relations.length === 0 ? (
        <p className="text-body-sm text-[var(--text-muted)]">Sin relaciones definidas.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {relations.map((rel) => (
            <div
              key={rel.id}
              className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-3 py-2"
            >
              <span className="font-mono text-body-sm text-[var(--text-primary)]">
                {resolveEntityName(rel.related_entity_id)}
              </span>
              <ArrowRight size={12} className="text-[var(--text-muted)]" aria-hidden />
              <span className="text-body-sm text-[var(--text-tertiary)]">
                {CARDINALITY_LABEL[rel.cardinality] ?? rel.cardinality}
              </span>
              <span className="ml-auto text-caption text-[var(--text-muted)]">
                vía {rel.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
