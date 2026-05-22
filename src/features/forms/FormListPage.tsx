import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Plus } from 'lucide-react'
import { useForms, useEntities } from '@/api/queries'
import {
  Button, EmptyState, ErrorState, SkeletonCard,
  Card, CardIconBlock, CreateCard, Select,
} from '@/ui'
import { relativeTime, absoluteDate } from '@/lib/formatters'
import { NewFormModal } from './components/NewFormModal'

const FORM_TYPE_LABEL: Record<string, string> = {
  data_entry: 'Ingreso',
  approval: 'Aprobación',
  list_search: 'Búsqueda',
}

export default function FormListPage() {
  const navigate = useNavigate()
  const { data: forms = [], isLoading, error, refetch } = useForms()
  const { data: entities = [] } = useEntities()
  const [entityFilter, setEntityFilter] = useState('')
  const [showNew, setShowNew] = useState(false)

  const filtered = entityFilter
    ? forms.filter((f) => f.content.entity_ref === entityFilter)
    : forms

  const entityOptions = [
    { value: '', label: 'Todas las entidades' },
    ...entities.map((e) => ({ value: e.id_object, label: e.object_name })),
  ]

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display font-semibold text-[var(--text-primary)]">Formularios</h1>
          <p className="mt-1 text-body text-[var(--text-secondary)]">
            Diseña formularios vinculados a entidades del modelo
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus size={15} aria-hidden /> Nuevo formulario
        </Button>
      </div>

      {/* Filter */}
      {!isLoading && !error && forms.length > 0 && (
        <div className="w-56">
          <Select
            options={entityOptions}
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            aria-label="Filtrar por entidad"
          />
        </div>
      )}

      {/* Content */}
      {error ? (
        <ErrorState
          title="No fue posible cargar los formularios"
          detail={JSON.stringify(error, null, 2)}
          onRetry={() => void refetch()}
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : !filtered.length ? (
        forms.length === 0 ? (
          <EmptyState
            icon={<FileText size={28} />}
            title="Aún no hay formularios"
            description="Crea el primer formulario vinculado a una entidad del proyecto."
            action={
              <Button onClick={() => setShowNew(true)}>
                <Plus size={15} aria-hidden /> Nuevo formulario
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<FileText size={28} />}
            title="Sin resultados"
            description="No hay formularios para la entidad seleccionada."
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((form) => {
            const entity = entities.find((e) => e.id_object === form.content.entity_ref)
            const typeLabel = FORM_TYPE_LABEL[form.content.form_type] ?? form.content.form_type
            return (
              <Card
                key={form.id_object}
                interactive
                onClick={() => navigate(`/forms/${form.id_object}`)}
                className="flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  <CardIconBlock icon={<FileText size={18} />} color="#A78BFA" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-h2 text-[var(--text-primary)]">
                      {form.object_name}
                    </p>
                    <p className="truncate font-mono text-caption text-[var(--text-muted)]">
                      {entity?.object_name ?? form.content.entity_ref}
                    </p>
                  </div>
                </div>

                {form.content.description && (
                  <p className="line-clamp-2 text-body-sm text-[var(--text-secondary)]">
                    {form.content.description}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-sm bg-[var(--action-bg-subtle)] px-1.5 py-0.5 text-tiny font-semibold uppercase text-[var(--action-text)]">
                      {typeLabel}
                    </span>
                    <span className="text-caption text-[var(--text-muted)]">
                      {form.content.fields.length} campos
                    </span>
                  </div>
                  <span
                    className="text-caption text-[var(--text-muted)]"
                    title={absoluteDate(form.updated_at)}
                  >
                    {relativeTime(form.updated_at)}
                  </span>
                </div>
              </Card>
            )
          })}

          <CreateCard onClick={() => setShowNew(true)}>
            <Plus size={22} aria-hidden />
            <span className="text-body-sm font-medium">Nuevo formulario</span>
          </CreateCard>
        </div>
      )}

      <NewFormModal
        open={showNew}
        onClose={() => setShowNew(false)}
        entities={entities}
      />
    </div>
  )
}
