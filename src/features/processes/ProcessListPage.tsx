import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Route, Plus, Play } from 'lucide-react'
import { toast } from 'sonner'
import { useProcesses, useStartInstance } from '@/api/queries'
import {
  Button, EmptyState, ErrorState, SkeletonCard,
  Card, CardIconBlock, CreateCard, Badge, Modal,
} from '@/ui'
import { relativeTime, absoluteDate } from '@/lib/formatters'
import type { ProcessDefinition } from '@/api/types'

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProcessDefinition['content']['status'] }) {
  if (status === 'configured') return <Badge variant="configured" dot>Configurado</Badge>
  return <Badge variant="draft" dot>Borrador</Badge>
}

// ── Start instance modal ───────────────────────────────────────────────────────

interface StartModalProps {
  process: ProcessDefinition | null
  onClose: () => void
}

function StartInstanceModal({ process, onClose }: StartModalProps) {
  const navigate = useNavigate()
  const startInstance = useStartInstance()

  const handleStart = async () => {
    if (!process) return
    try {
      const res = await startInstance.mutateAsync({
        processId: process.id_object,
        body: { initial_context: {}, started_by: 'demo_user' },
      })
      toast.success('Instancia iniciada')
      onClose()
      navigate(`/instances/${res.id_process_instance}`)
    } catch (err) {
      const e = err as { error?: { message?: string } }
      toast.error(e?.error?.message ?? 'Error al iniciar')
    }
  }

  return (
    <Modal
      open={!!process}
      onClose={onClose}
      title={`Iniciar: ${process?.object_name ?? ''}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void handleStart()} loading={startInstance.isPending}>
            <Play size={14} aria-hidden /> Iniciar instancia
          </Button>
        </>
      }
    >
      <p className="text-body text-[var(--text-secondary)]">
        Se creará una nueva instancia del proceso{' '}
        <span className="font-mono font-medium text-[var(--text-primary)]">
          {process?.object_name}
        </span>
        . El contexto inicial se puede configurar desde las variables del proceso.
      </p>
      <div className="mt-4 rounded-md bg-[var(--state-warning-bg)] px-3 py-2 text-caption text-[var(--state-warning-text)]">
        En el MVP, el motor de ejecución solo soporta nodos <span className="font-mono">human_task</span>. Nodos de tipo script o gateway devuelven error 422.
      </div>
    </Modal>
  )
}

// ── ProcessListPage ────────────────────────────────────────────────────────────

export default function ProcessListPage() {
  const navigate = useNavigate()
  const { data: processes = [], isLoading, error, refetch } = useProcesses()
  const [startingProcess, setStartingProcess] = useState<ProcessDefinition | null>(null)

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display font-semibold text-[var(--text-primary)]">Procesos</h1>
          <p className="mt-1 text-body text-[var(--text-secondary)]">
            Diseña y ejecuta flujos de trabajo del proyecto
          </p>
        </div>
        <Button onClick={() => navigate('/processes/new')}>
          <Plus size={15} aria-hidden /> Nuevo proceso
        </Button>
      </div>

      {/* Content */}
      {error ? (
        <ErrorState
          title="No fue posible cargar los procesos"
          detail={JSON.stringify(error, null, 2)}
          onRetry={() => void refetch()}
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : !processes.length ? (
        <EmptyState
          icon={<Route size={28} />}
          title="Aún no hay procesos"
          description="Crea el primer proceso de negocio del proyecto."
          action={
            <Button onClick={() => navigate('/processes/new')}>
              <Plus size={15} aria-hidden /> Nuevo proceso
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {processes.map((proc) => {
            const isConfigured = proc.content.status === 'configured'
            const varCount = proc.content.context_variables.length
            return (
              <Card
                key={proc.id_object}
                interactive
                artifactState={isConfigured ? 'configured' : 'draft'}
                onClick={() => navigate(`/processes/${proc.id_object}`)}
                className="flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  <CardIconBlock icon={<Route size={18} />} color="#34D399" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-h2 text-[var(--text-primary)]">
                      {proc.object_name}
                    </p>
                    <p className="text-caption text-[var(--text-muted)]">
                      {varCount} variable{varCount !== 1 && 's'}
                    </p>
                  </div>
                  <StatusBadge status={proc.content.status} />
                </div>

                {proc.content.description && (
                  <p className="line-clamp-2 text-body-sm text-[var(--text-secondary)]">
                    {proc.content.description}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <span
                    className="text-caption text-[var(--text-muted)]"
                    title={absoluteDate(proc.updated_at)}
                  >
                    {relativeTime(proc.updated_at)}
                  </span>
                  <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/processes/${proc.id_object}`)}
                    >
                      Editar
                    </Button>
                    {isConfigured && (
                      <Button
                        size="sm"
                        onClick={() => setStartingProcess(proc)}
                      >
                        <Play size={12} aria-hidden /> Iniciar
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}

          <CreateCard onClick={() => navigate('/processes/new')}>
            <Plus size={22} aria-hidden />
            <span className="text-body-sm font-medium">Nuevo proceso</span>
          </CreateCard>
        </div>
      )}

      <StartInstanceModal
        process={startingProcess}
        onClose={() => setStartingProcess(null)}
      />
    </div>
  )
}
