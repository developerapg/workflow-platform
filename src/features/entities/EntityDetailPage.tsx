import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Code, Save, AlertTriangle, ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useEntity, useEntities, usePersist } from '@/api/queries'
import {
  Button, Input, Spinner, ErrorState, ConfirmDialog, Breadcrumbs,
} from '@/ui'
import type { Attribute } from '@/api/types'
import { AttributeTable, type AttributeRow } from './components/AttributeTable'
import { AttributePropertiesPanel } from './components/AttributePropertiesPanel'
import { RelationsSection } from './components/RelationsSection'
import { SqlPreviewModal } from './components/SqlPreviewModal'
import { objectNameSchema } from '@/lib/schemas'

// ── helpers ──────────────────────────────────────────────────────────────────

function newAttribute(entityId: string, ordinal: number): AttributeRow {
  return {
    id_attribute: `new-${crypto.randomUUID()}`,
    entity_id: entityId,
    name: '',
    description: '',
    data_type: 'string',
    required: false,
    is_unique: false,
    is_business_key: false,
    default_value: null,
    ordinal,
    metadata: {
      source: '',
      is_primary_key: false,
      is_foreign_key: false,
      foreign_key_ref: null,
      constraints: {},
    },
    _isNew: true,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EntityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const persist = usePersist()
  const { data: allEntities = [] } = useEntities()

  // ── Remote data ──
  const { data: remote, isLoading, error } = useEntity(id ?? '')

  // ── Local state ──
  const [objectName, setObjectName] = useState('')
  const [description, setDescription] = useState('')
  const [attributes, setAttributes] = useState<AttributeRow[]>([])
  const [selectedAttrId, setSelectedAttrId] = useState<string | null>(null)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [nameError, setNameError] = useState('')
  const [showSql, setShowSql] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Seed local state from remote
  useEffect(() => {
    if (!remote) return
    setObjectName(remote.object_name)
    setDescription(remote.content.description)
    setAttributes((remote.attributes ?? []) as AttributeRow[])
    setIsDirty(false)
  }, [remote])

  // Track dirtiness
  const markDirty = useCallback(() => setIsDirty(true), [])

  const handleNameChange = (v: string) => {
    setObjectName(v)
    const result = objectNameSchema.safeParse(v)
    setNameError(result.success ? '' : (result.error.errors[0]?.message ?? 'Nombre inválido'))
    markDirty()
  }

  const handleAttrChange = useCallback(
    (updated: AttributeRow[]) => { setAttributes(updated); markDirty() },
    [markDirty],
  )

  const addAttribute = () => {
    const attr = newAttribute(id ?? 'new', attributes.length)
    setAttributes((prev) => [...prev, attr])
    setSelectedAttrId(attr.id_attribute)
    markDirty()
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (nameError || !objectName) {
      setNameError('El nombre es requerido')
      return
    }

    const entityId = id ?? `ent-${crypto.randomUUID()}`
    const tempEntityId = isNew ? 'tmp_entity' : entityId

    const ops = []

    if (isNew) {
      ops.push({
        temp_id: tempEntityId,
        operation: 'create' as const,
        object_type: 'entity' as const,
        data: {
          object_name: objectName,
          parent: 'proj-001',
          content: {
            description,
            source: objectName,
            is_managed: true,
            relations: [],
          },
        },
      })
    } else {
      ops.push({
        operation: 'update' as const,
        object_type: 'entity' as const,
        id: entityId,
        data: {
          object_name: objectName,
          content: {
            ...remote?.content,
            description,
          },
        },
      })
    }

    // Attribute ops
    for (const attr of attributes) {
      if (attr._isNew) {
        ops.push({
          operation: 'create' as const,
          object_type: 'attribute' as const,
          data: {
            entity_id: isNew ? tempEntityId : entityId,
            name: attr.name,
            description: attr.description,
            data_type: attr.data_type,
            required: attr.required,
            is_unique: attr.is_unique,
            is_business_key: attr.is_business_key,
            default_value: attr.default_value,
            ordinal: attr.ordinal,
            metadata: { ...attr.metadata, source: attr.name },
          },
        })
      } else {
        ops.push({
          operation: 'update' as const,
          object_type: 'attribute' as const,
          id: attr.id_attribute,
          data: {
            name: attr.name,
            description: attr.description,
            data_type: attr.data_type,
            required: attr.required,
            is_unique: attr.is_unique,
            is_business_key: attr.is_business_key,
            default_value: attr.default_value,
            ordinal: attr.ordinal,
          },
        })
      }
    }

    try {
      await persist.mutateAsync({ operations: ops })
      toast.success(isNew ? 'Entidad creada' : 'Entidad guardada')
      setIsDirty(false)
      if (isNew) navigate('/entities')
    } catch (err) {
      const e = err as { error?: { message?: string; details?: { message: string }[] } }
      const msg = e?.error?.details?.[0]?.message ?? e?.error?.message ?? 'Error al guardar'
      toast.error(msg)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!id) return
    try {
      await persist.mutateAsync({
        operations: [{ operation: 'delete', object_type: 'entity', id }],
      })
      toast.success('Entidad eliminada')
      navigate('/entities')
    } catch {
      toast.error('No se pudo eliminar la entidad')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!isNew && isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" label="Cargando entidad…" />
      </div>
    )
  }

  if (!isNew && error) {
    return (
      <div className="p-8">
        <ErrorState
          title="No fue posible cargar la entidad"
          detail={JSON.stringify(error, null, 2)}
          onRetry={() => navigate(0)}
        />
      </div>
    )
  }

  const selectedAttr = attributes.find((a) => a.id_attribute === selectedAttrId) ?? null
  const currentEntity = remote ?? {
    id_object: '',
    object_name: objectName,
    object_type: 'entity' as const,
    parent: 'proj-001',
    content: { description, source: objectName, is_managed: true, relations: [] },
    created_at: '',
    updated_at: '',
  }
  const relations = remote?.content.relations ?? []

  return (
    <div className="flex h-full flex-col">
      {/* Top bar — concentration mode */}
      <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4">
        <button
          onClick={() => navigate('/entities')}
          className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-primary)]"
          aria-label="Volver"
        >
          <ChevronLeft size={18} />
        </button>

        <Breadcrumbs
          items={[
            { label: 'Entidades', to: '/entities' },
            { label: isNew ? 'Nueva entidad' : (objectName || '…') },
          ]}
        />

        {isDirty && (
          <span className="flex items-center gap-1 rounded-full bg-[var(--state-warning-bg)] px-2 py-0.5 text-caption text-[var(--state-warning-text)]">
            <AlertTriangle size={11} aria-hidden /> Sin guardar
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {!isNew && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSql(true)}
              disabled={!attributes.length}
            >
              <Code size={14} aria-hidden /> Ver SQL
            </Button>
          )}
          {!isNew && (
            <Button
              variant="danger-ghost"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Eliminar
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => void handleSave()}
            loading={persist.isPending}
          >
            <Save size={14} aria-hidden /> Guardar
          </Button>
        </div>
      </header>

      {/* Body: main + panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main column */}
        <main className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          {/* Entity header */}
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Input
                label="Nombre técnico"
                value={objectName}
                onChange={(e) => handleNameChange(e.target.value)}
                error={nameError}
                placeholder="nombre_entidad"
                hint="snake_case · se usa como nombre de tabla"
                disabled={!isNew && !!remote}
              />
              {!isNew && remote && (
                <p className="text-caption text-[var(--text-muted)]">
                  El nombre técnico no puede modificarse en entidades existentes.
                </p>
              )}
            </div>

            <Input
              label="Descripción"
              value={description}
              onChange={(e) => { setDescription(e.target.value); markDirty() }}
              placeholder="Describe brevemente el propósito de esta entidad"
            />

            <div className="flex items-center gap-2">
              <span className="text-label uppercase text-[var(--text-tertiary)]">Tabla física:</span>
              <span className="font-mono text-body-sm text-[var(--text-muted)]">
                {objectName || '—'}
              </span>
              <span className="ml-2 rounded-sm bg-[var(--action-bg-subtle)] px-1.5 py-0.5 text-tiny font-semibold uppercase text-[var(--action-text)]">
                greenfield
              </span>
            </div>
          </section>

          {/* Attributes */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-label uppercase text-[var(--text-tertiary)]">
                Atributos ({attributes.length})
              </span>
              <Button variant="secondary" size="sm" onClick={addAttribute}>
                <Plus size={13} aria-hidden /> Agregar atributo
              </Button>
            </div>

            {attributes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--border-default)] py-8 text-center">
                <p className="text-body-sm text-[var(--text-muted)]">
                  Sin atributos. Agrega el primero.
                </p>
              </div>
            ) : (
              <AttributeTable
                attributes={attributes}
                selectedId={selectedAttrId}
                onSelect={setSelectedAttrId}
                onChange={handleAttrChange}
              />
            )}
          </section>

          {/* Relations */}
          {!isNew && (
            <section>
              <RelationsSection relations={relations} allEntities={allEntities} />
            </section>
          )}
        </main>

        {/* Properties panel */}
        <AttributePropertiesPanel
          attribute={selectedAttr}
          collapsed={panelCollapsed}
          onToggleCollapse={() => setPanelCollapsed((v) => !v)}
          onChange={(updated: AttributeRow) =>
            handleAttrChange(attributes.map((a) => (a.id_attribute === updated.id_attribute ? updated : a)))
          }
        />
      </div>

      {/* Modals */}
      <SqlPreviewModal
        open={showSql}
        onClose={() => setShowSql(false)}
        entity={currentEntity}
        attributes={attributes as Attribute[]}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => void handleDelete()}
        title={`¿Eliminar entidad "${objectName}"?`}
        message="Esta acción no se puede deshacer. Se eliminarán también todos sus atributos."
        confirmText={objectName}
        confirmLabel="Eliminar entidad"
        loading={persist.isPending}
      />
    </div>
  )
}
