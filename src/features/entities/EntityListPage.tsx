import { useNavigate } from 'react-router-dom'
import { Database, Plus } from 'lucide-react'
import { useEntities } from '@/api/queries'
import { Button, EmptyState, ErrorState, SkeletonCard, Card, CardIconBlock, CreateCard, Badge } from '@/ui'
import type { ArtifactState } from '@/ui'
import { relativeTime, absoluteDate } from '@/lib/formatters'
import type { Entity } from '@/api/types'

function entityState(entity: Entity): ArtifactState {
  return entity.content.source ? 'configured' : 'draft'
}

export default function EntityListPage() {
  const navigate = useNavigate()
  const { data: entities, isLoading, error, refetch } = useEntities()

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display font-semibold text-[var(--text-primary)]">Entidades</h1>
          <p className="mt-1 text-body text-[var(--text-secondary)]">
            Modelo de datos del proyecto
          </p>
        </div>
        <Button onClick={() => navigate('/entities/new')}>
          <Plus size={15} aria-hidden /> Nueva entidad
        </Button>
      </div>

      {/* Content */}
      {error ? (
        <ErrorState
          title="No fue posible cargar las entidades"
          detail={JSON.stringify(error, null, 2)}
          onRetry={() => void refetch()}
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : !entities?.length ? (
        <EmptyState
          icon={<Database size={28} />}
          title="Aún no hay entidades"
          description="Crea la primera entidad del modelo de datos de este proyecto."
          action={
            <Button onClick={() => navigate('/entities/new')}>
              <Plus size={15} aria-hidden /> Nueva entidad
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {entities.map((entity) => {
            const state = entityState(entity)
            return (
              <Card
                key={entity.id_object}
                interactive
                artifactState={state}
                dot
                onClick={() => navigate(`/entities/${entity.id_object}`)}
                className="flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  <CardIconBlock icon={<Database size={18} />} color="#60A5FA" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-h2 text-[var(--text-primary)]">
                      {entity.object_name}
                    </p>
                    <p className="truncate font-mono text-caption text-[var(--text-muted)]">
                      {entity.content.source}
                    </p>
                  </div>
                </div>

                {entity.content.description && (
                  <p className="line-clamp-2 text-body-sm text-[var(--text-secondary)]">
                    {entity.content.description}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <Badge variant={state === 'configured' ? 'configured' : 'draft'} dot>
                    {state === 'configured' ? 'Configurada' : 'Borrador'}
                  </Badge>
                  <span
                    className="text-caption text-[var(--text-muted)]"
                    title={absoluteDate(entity.updated_at)}
                  >
                    {relativeTime(entity.updated_at)}
                  </span>
                </div>
              </Card>
            )
          })}

          <CreateCard onClick={() => navigate('/entities/new')}>
            <Plus size={22} aria-hidden />
            <span className="text-body-sm font-medium">Nueva entidad</span>
          </CreateCard>
        </div>
      )}
    </div>
  )
}
