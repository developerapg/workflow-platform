import { useState, useCallback, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type Active,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { AlertTriangle, Save, Eye, EyeOff, ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import {
  useForm,
  useEntities,
  useAttributes,
  usePersist,
} from '@/api/queries'
import { Button, Breadcrumbs, Spinner, ErrorState } from '@/ui'
import type { FormField, Attribute } from '@/api/types'
import type { EnrichedField } from './types'
import { AttributeTree } from './components/AttributeTree'
import { FormCanvas } from './components/FormCanvas'
import { FieldPropertiesPanel } from './components/FieldPropertiesPanel'
import { FormPreview } from './components/FormPreview'
import { defaultComponentForType } from './lib/defaultComponent'

// ── helpers ───────────────────────────────────────────────────────────────────

function newField(attribute: Attribute, xPath: string | null): FormField {
  return {
    id: `fld-${crypto.randomUUID()}`,
    attribute_ref: attribute.id_attribute,
    label: attribute.name.replace(/_/g, ' '),
    placeholder: '',
    help_text: '',
    required: attribute.required,
    read_only: attribute.metadata.is_primary_key,
    hidden: false,
    component: defaultComponentForType(attribute.data_type),
    validations: [],
    x_path: xPath,
    default_value: attribute.default_value,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FormDesignerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const isPreview = searchParams.get('preview') === '1'

  const persist = usePersist()
  const { data: remote, isLoading, error } = useForm(id ?? '')
  const { data: allEntities = [] } = useEntities()

  // Attributes for the base entity
  const baseEntityId = remote?.content.entity_ref ?? ''
  const { data: baseAttributes = [] } = useAttributes(baseEntityId)

  // Attributes for related entities (up to 1 level)
  const relations = useMemo(
    () => allEntities.find((e) => e.id_object === baseEntityId)?.content.relations ?? [],
    [allEntities, baseEntityId],
  )

  // Collect related-entity attribute queries — one per relation
  // We use individual hooks below; for MVP we pre-load with a combined fetch
  const relatedEntityIds = relations.map((r) => r.related_entity_id)
  const { data: rel0Attrs = [] } = useAttributes(relatedEntityIds[0] ?? '')
  const { data: rel1Attrs = [] } = useAttributes(relatedEntityIds[1] ?? '')
  const { data: rel2Attrs = [] } = useAttributes(relatedEntityIds[2] ?? '')

  const allRelatedAttributes = useMemo<Record<string, Attribute[]>>(() => {
    const map: Record<string, Attribute[]> = {}
    if (relatedEntityIds[0]) map[relatedEntityIds[0]] = rel0Attrs
    if (relatedEntityIds[1]) map[relatedEntityIds[1]] = rel1Attrs
    if (relatedEntityIds[2]) map[relatedEntityIds[2]] = rel2Attrs
    return map
  }, [relatedEntityIds, rel0Attrs, rel1Attrs, rel2Attrs])

  // ── Local state ──
  const [formName, setFormName] = useState('')
  const [fields, setFields] = useState<FormField[]>([])
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [isOver, setIsOver] = useState(false)

  // dnd-kit drag overlay state
  const [activeItem, setActiveItem] = useState<Active | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  // Seed from remote
  useEffect(() => {
    if (!remote) return
    setFormName(remote.object_name)
    setFields(remote.content.fields)
    setIsDirty(false)
  }, [remote])

  const markDirty = useCallback(() => setIsDirty(true), [])

  // ── Enriched fields ───────────────────────────────────────────────────────

  // Build a flat lookup: attribute_id → Attribute
  const attributeById = useMemo<Record<string, Attribute>>(() => {
    const map: Record<string, Attribute> = {}
    for (const a of baseAttributes) map[a.id_attribute] = a
    for (const attrs of Object.values(allRelatedAttributes)) {
      for (const a of attrs) map[a.id_attribute] = a
    }
    return map
  }, [baseAttributes, allRelatedAttributes])

  const enrichedFields: EnrichedField[] = fields.map((f) => ({
    field: f,
    attribute: attributeById[f.attribute_ref],
  }))

  // ── DnD handlers ──────────────────────────────────────────────────────────

  const handleDragOver = (event: DragOverEvent) => {
    setIsOver(!!event.over)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null)
    setIsOver(false)
    const { active, over } = event

    // Dropped on canvas from attribute tree
    if (active.id.toString().startsWith('attr::')) {
      const data = active.data.current as { attribute: Attribute; xPath: string | null } | undefined
      if (!data) return
      // Don't add duplicates (by attribute_ref + x_path)
      const alreadyAdded = fields.some(
        (f) => f.attribute_ref === data.attribute.id_attribute && f.x_path === data.xPath,
      )
      if (alreadyAdded) {
        toast.info(`El atributo "${data.attribute.name}" ya está en el formulario`)
        return
      }
      const field = newField(data.attribute, data.xPath)
      setFields((prev) => [...prev, field])
      setSelectedFieldId(field.id)
      markDirty()
      return
    }

    // Reorder within canvas
    if (over && active.id !== over.id) {
      setFields((prev) => {
        const oldIndex = prev.findIndex((f) => f.id === active.id)
        const newIndex = prev.findIndex((f) => f.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return prev
        return arrayMove(prev, oldIndex, newIndex)
      })
      markDirty()
    }
  }

  // ── Field operations ──────────────────────────────────────────────────────

  const handleFieldChange = (updated: FormField) => {
    setFields((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
    markDirty()
  }

  const handleRemoveField = (fieldId: string) => {
    setFields((prev) => prev.filter((f) => f.id !== fieldId))
    if (selectedFieldId === fieldId) setSelectedFieldId(null)
    markDirty()
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!id || !remote) return

    // VR-20: every field must have attribute_ref
    const invalid = fields.filter((f) => !f.attribute_ref)
    if (invalid.length) {
      toast.error(`${invalid.length} campo(s) sin atributo asignado`)
      return
    }

    try {
      await persist.mutateAsync({
        operations: [
          {
            operation: 'update',
            object_type: 'form_definition',
            id,
            data: {
              object_name: formName,
              content: {
                ...remote.content,
                fields,
              },
            },
          },
        ],
      })
      toast.success('Formulario guardado')
      setIsDirty(false)
    } catch (err) {
      const e = err as { error?: { message?: string; details?: { message: string }[] } }
      const msg = e?.error?.details?.[0]?.message ?? e?.error?.message ?? 'Error al guardar'
      toast.error(msg)
    }
  }

  // ── Loading / error guards ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" label="Cargando formulario…" />
      </div>
    )
  }

  if (error || !remote) {
    return (
      <div className="p-8">
        <ErrorState
          title="No fue posible cargar el formulario"
          detail={JSON.stringify(error, null, 2)}
          onRetry={() => navigate(0)}
        />
      </div>
    )
  }

  const baseEntity = allEntities.find((e) => e.id_object === baseEntityId)

  // ── Preview mode ───────────────────────────────────────────────────────────

  if (isPreview) {
    return (
      <div className="flex h-full flex-col">
        <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4">
          <button
            onClick={() => setSearchParams({})}
            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-primary)]"
            aria-label="Salir de vista previa"
          >
            <ChevronLeft size={18} />
          </button>
          <Breadcrumbs
            items={[
              { label: 'Formularios', to: '/forms' },
              { label: formName, to: `/forms/${id}` },
              { label: 'Vista previa' },
            ]}
          />
          <Button size="sm" variant="secondary" onClick={() => setSearchParams({})}>
            <EyeOff size={14} aria-hidden /> Salir de previa
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-2xl">
            <FormPreview fields={fields} attributeById={attributeById} />
          </div>
        </div>
      </div>
    )
  }

  // ── Designer mode ──────────────────────────────────────────────────────────

  const selectedEnriched = enrichedFields.find((ef) => ef.field.id === selectedFieldId) ?? null

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveItem(e.active)}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full flex-col">
        {/* Topbar — concentration mode */}
        <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4">
          <button
            onClick={() => navigate('/forms')}
            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-primary)]"
            aria-label="Volver a formularios"
          >
            <ChevronLeft size={18} />
          </button>

          <Breadcrumbs
            items={[
              { label: 'Formularios', to: '/forms' },
              { label: formName || remote.object_name },
            ]}
          />

          {isDirty && (
            <span className="flex items-center gap-1 rounded-full bg-[var(--state-warning-bg)] px-2 py-0.5 text-caption text-[var(--state-warning-text)]">
              <AlertTriangle size={11} aria-hidden /> Sin guardar
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSearchParams({ preview: '1' })}
            >
              <Eye size={14} aria-hidden /> Vista previa
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSave()}
              loading={persist.isPending}
            >
              <Save size={14} aria-hidden /> Guardar
            </Button>
          </div>
        </header>

        {/* Three-column body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left — attribute tree */}
          <AttributeTree
            baseEntity={
              baseEntity ?? {
                id_object: baseEntityId,
                object_name: baseEntityId,
                object_type: 'entity',
                parent: null,
                content: { description: '', source: baseEntityId, is_managed: true, relations: [] },
                created_at: '',
                updated_at: '',
              }
            }
            baseAttributes={baseAttributes}
            allEntities={allEntities}
            allAttributes={allRelatedAttributes}
            collapsed={leftCollapsed}
            onToggleCollapse={() => setLeftCollapsed((v) => !v)}
          />

          {/* Center — canvas */}
          <FormCanvas
            formName={formName}
            onFormNameChange={(v) => { setFormName(v); markDirty() }}
            baseEntityName={baseEntity?.object_name ?? baseEntityId}
            enrichedFields={enrichedFields}
            selectedFieldId={selectedFieldId}
            onSelectField={setSelectedFieldId}
            onRemoveField={handleRemoveField}
            isOver={isOver}
          />

          {/* Right — properties panel */}
          <FieldPropertiesPanel
            selected={selectedEnriched}
            collapsed={rightCollapsed}
            onToggleCollapse={() => setRightCollapsed((v) => !v)}
            onChange={handleFieldChange}
          />
        </div>
      </div>

      {/* Drag overlay (ghost while dragging from tree) */}
      <DragOverlay>
        {activeItem?.id.toString().startsWith('attr::') ? (
          <div className="rounded-md border border-[var(--action-primary)] bg-[var(--bg-surface)] px-3 py-1.5 text-body-sm font-mono text-[var(--text-primary)] shadow-lg">
            {(activeItem.data.current as { attribute: Attribute } | undefined)?.attribute.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
