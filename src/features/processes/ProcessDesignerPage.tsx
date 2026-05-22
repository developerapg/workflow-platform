import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  updateEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type ReactFlowInstance,
  BackgroundVariant,
  MarkerType,
} from 'reactflow'
import { AlertTriangle, Save, ChevronLeft, CheckCircle, Play, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useProcess, useForms, usePersist, useStartInstance } from '@/api/queries'
import { Button, Breadcrumbs, Spinner, ErrorState, Modal } from '@/ui'
import type { ProcessNode, ContextVariable } from '@/api/types'
import { StartNode } from './canvas/nodes/StartNode'
import { EndNode } from './canvas/nodes/EndNode'
import { HumanTaskNode } from './canvas/nodes/HumanTaskNode'
import { ScriptTaskNode } from './canvas/nodes/ScriptTaskNode'
import { ExclusiveGatewayNode } from './canvas/nodes/ExclusiveGatewayNode'
import { ProcessPropertiesPanel, type Selection } from './components/ProcessPropertiesPanel'
import { NodePalette } from './canvas/palette/NodePalette'
import { validateProcess, deriveStatus } from './validation'
import type { NodeType } from '@/api/types'
import type { ArtifactState } from '@/ui'

function nodeArtifactState(
  node: ProcessNode,
  errorNodeIds: Set<string>,
): ArtifactState {
  if (errorNodeIds.has(node.id_node)) return 'error'
  if (node.node_type === 'script_task' || node.node_type === 'exclusive_gateway') return 'warning'
  if (node.node_type === 'start' || node.node_type === 'end') return 'configured'
  if (node.node_type === 'human_task') {
    const cfg = node.config as { _type: 'human_task'; form_ref: string }
    return cfg.form_ref ? 'configured' : 'draft'
  }
  return 'draft'
}

// ── React Flow node types registry ────────────────────────────────────────────

const nodeTypes = {
  start: StartNode,
  end: EndNode,
  human_task: HumanTaskNode,
  script_task: ScriptTaskNode,
  exclusive_gateway: ExclusiveGatewayNode,
}

// ── Converters between ProcessNode ↔ React Flow Node ─────────────────────────

function toRfNode(
  n: ProcessNode,
  forms: { id_object: string; object_name: string }[],
  errorNodeIds: Set<string> = new Set(),
  onAddNext?: (sourceId: string) => void,
): Node {
  const formName =
    n.config._type === 'human_task'
      ? forms.find((f) => f.id_object === (n.config as { form_ref: string }).form_ref)?.object_name
      : undefined

  return {
    id: n.id_node,
    type: n.node_type,
    position: { x: n.position_x, y: n.position_y },
    data: {
      name: n.name,
      label: n.name.replace(/_/g, ' '),
      formName,
      nodeState: nodeArtifactState(n, errorNodeIds),
      onAddNext: n.node_type !== 'end' && onAddNext ? () => onAddNext(n.id_node) : undefined,
      _processNode: n,
    },
  }
}

function toRfEdge(t: { id: string; from_node_id: string; to_node_id: string; condition: string | null; label: string }): Edge {
  return {
    id: t.id,
    type: 'smoothstep',
    source: t.from_node_id,
    target: t.to_node_id,
    label: t.label || undefined,
    data: { condition: t.condition },
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: 'var(--border-default)', strokeWidth: 2, borderRadius: 8 },
    labelStyle: { fontSize: 11, fill: 'var(--text-secondary)' },
    labelBgStyle: { fill: 'var(--bg-surface)', stroke: 'var(--border-subtle)', strokeWidth: 1, rx: 4 },
    labelBgPadding: [4, 6] as [number, number],
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ProcessDesignerPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const persist = usePersist()
  const startInstance = useStartInstance()

  const { data: remote, isLoading, error } = useProcess(id ?? '')
  const { data: forms = [] } = useForms()

  // RF state
  const [rfNodes, setRfNodes] = useState<Node[]>([])
  const [rfEdges, setRfEdges] = useState<Edge[]>([])
  const rfInstance = useRef<ReactFlowInstance | null>(null)
  // Stable ref to addConnectedNode so closures in node data always call the latest version
  const addConnectedNodeRef = useRef<(sourceId: string) => void>(() => {})

  // Process metadata
  const [processName, setProcessName] = useState('')
  const [processDescription, setProcessDescription] = useState('')
  const [contextVariables, setContextVariables] = useState<ContextVariable[]>([])

  // UI
  const [selection, setSelection] = useState<Selection>({ type: 'none' })
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [paletteCollapsed, setPaletteCollapsed] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showValidation, setShowValidation] = useState(false)
  const [showStartModal, setShowStartModal] = useState(false)

  // Seed from remote
  useEffect(() => {
    if (!remote) return
    setProcessName(remote.object_name)
    setProcessDescription(remote.content.description)
    setContextVariables(remote.content.context_variables)
    setRfNodes((remote.nodes ?? []).map((n) =>
      toRfNode(n, forms, new Set(), (srcId) => addConnectedNodeRef.current(srcId)),
    ))
    setRfEdges(remote.content.transitions.map(toRfEdge))
    setIsDirty(false)
  }, [remote, forms])

  const markDirty = useCallback(() => setIsDirty(true), [])

  // ── RF event handlers ─────────────────────────────────────────────────────

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setRfNodes((nds) => applyNodeChanges(changes, nds))
      if (changes.some((c) => c.type !== 'select')) markDirty()
    },
    [markDirty],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setRfEdges((eds) => applyEdgeChanges(changes, eds))
      markDirty()
    },
    [markDirty],
  )

  // Allow dragging edge endpoints to different handles (PD-73, PD-74)
  const onEdgeUpdate = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setRfEdges((eds) => updateEdge(oldEdge, newConnection, eds))
      markDirty()
    },
    [markDirty],
  )

  const onConnect = useCallback(
    (params: Connection) => {
      setRfEdges((eds) =>
        addEdge(
          {
            ...params,
            id: `t-${crypto.randomUUID()}`,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: 'var(--border-default)', strokeWidth: 2, borderRadius: 8 },
            labelStyle: { fontSize: 11, fill: 'var(--text-secondary)' },
            labelBgStyle: { fill: 'var(--bg-surface)', stroke: 'var(--border-subtle)', strokeWidth: 1, rx: 4 },
            labelBgPadding: [4, 6] as [number, number],
            data: { condition: null },
          },
          eds,
        ),
      )
      markDirty()
    },
    [markDirty],
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const pn = node.data._processNode as ProcessNode | undefined
      if (pn) setSelection({ type: 'node', node: pn })
    },
    [],
  )

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setSelection({ type: 'edge', edge })
    },
    [],
  )

  const onPaneClick = useCallback(() => {
    setSelection({ type: 'none' })
  }, [])

  // ── Add connected node from "+" button (UX Spec §7.4, PD-50..PD-55) ─────────

  const addConnectedNode = useCallback(
    (sourceNodeId: string) => {
      setRfNodes((prev) => {
        const sourceRfNode = prev.find((n) => n.id === sourceNodeId)
        const position = sourceRfNode
          ? { x: sourceRfNode.position.x + 240, y: sourceRfNode.position.y }
          : { x: 400, y: 200 }

        const id_node = `node-${crypto.randomUUID()}`
        const processNode: ProcessNode = {
          id_node,
          process_id: id ?? 'new',
          node_type: 'human_task',
          name: 'tarea',
          description: '',
          position_x: position.x,
          position_y: position.y,
          config: { _type: 'human_task', form_ref: '', assignment: { type: 'role', value: '' }, due_in: null },
        }

        const rfNode: Node = {
          id: id_node,
          type: 'human_task',
          position,
          data: {
            name: 'tarea',
            label: 'tarea',
            nodeState: 'draft',
            // Use ref so this closure always calls the current version
            onAddNext: () => addConnectedNodeRef.current(id_node),
            _processNode: processNode,
          },
        }

        setRfEdges((eds) => [
          ...eds,
          {
            id: `t-${crypto.randomUUID()}`,
            type: 'smoothstep',
            source: sourceNodeId,
            target: id_node,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: 'var(--border-default)', strokeWidth: 2, borderRadius: 8 },
            labelStyle: { fontSize: 11, fill: 'var(--text-secondary)' },
            labelBgStyle: { fill: 'var(--bg-surface)', stroke: 'var(--border-subtle)', strokeWidth: 1, rx: 4 },
            labelBgPadding: [4, 6] as [number, number],
            data: { condition: null },
          },
        ])

        setSelection({ type: 'node', node: processNode })
        markDirty()
        return [...prev, rfNode]
      })
    },
    [id, markDirty],
  )

  // Keep ref in sync with the latest callback
  addConnectedNodeRef.current = addConnectedNode

  // ── Drop from palette onto canvas (PD-30..PD-34) ─────────────────────────

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const type = e.dataTransfer.getData('application/reactflow-nodetype') as NodeType
      if (!type || !rfInstance.current) return
      const position = rfInstance.current.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      addNode(type, position)
    },
    // addNode is defined below but stable within this render — ESLint can't see through hoisting
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // ── Add node from palette ─────────────────────────────────────────────────

  const addNode = (type: string, atPosition?: { x: number; y: number }) => {
    const id_node = `node-${crypto.randomUUID()}`
    const center = atPosition ?? (rfInstance.current
      ? rfInstance.current.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      : { x: 200, y: 200 })

    const processNode: ProcessNode = {
      id_node,
      process_id: id ?? 'new',
      node_type: type as ProcessNode['node_type'],
      name: type,
      description: '',
      position_x: center.x,
      position_y: center.y,
      config:
        type === 'human_task'
          ? { _type: 'human_task', form_ref: '', assignment: { type: 'role', value: '' }, due_in: null }
          : type === 'end'
            ? { _type: 'end', result_label: 'Completado' }
            : type === 'script_task'
              ? { _type: 'script_task', language: 'javascript', source: '' }
              : { _type: 'exclusive_gateway', default_transition_id: null },
    }

    const rfNode: Node = {
      id: id_node,
      type,
      position: center,
      data: {
        name: type,
        label: type.replace(/_/g, ' '),
        nodeState: 'draft' as const,
        onAddNext: type !== 'end' ? () => addConnectedNodeRef.current(id_node) : undefined,
        _processNode: processNode,
      },
    }

    setRfNodes((prev) => [...prev, rfNode])
    markDirty()
  }

  // ── Node property change ───────────────────────────────────────────────────

  const handleNodeChange = useCallback(
    (nodeId: string, patch: Partial<ProcessNode> & { config?: ProcessNode['config'] }) => {
      setRfNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n
          const pn = n.data._processNode as ProcessNode
          const updated = { ...pn, ...patch }
          return {
            ...n,
            data: {
              ...n.data,
              name: updated.name,
              label: updated.name.replace(/_/g, ' '),
              _processNode: updated,
            },
          }
        }),
      )
      setSelection((prev) => {
        if (prev.type !== 'node' || prev.node.id_node !== nodeId) return prev
        const pn = prev.node
        return { type: 'node', node: { ...pn, ...patch } }
      })
      markDirty()
    },
    [markDirty],
  )

  const handleEdgeChange = useCallback(
    (edgeId: string, patch: Partial<Edge & { label: string; data: Record<string, unknown> }>) => {
      setRfEdges((prev) => prev.map((e) => (e.id === edgeId ? { ...e, ...patch } : e)))
      setSelection((prev) => {
        if (prev.type !== 'edge' || prev.edge.id !== edgeId) return prev
        return { type: 'edge', edge: { ...prev.edge, ...patch } }
      })
      markDirty()
    },
    [markDirty],
  )

  // ── Collect current process nodes from RF state ───────────────────────────

  const getCurrentNodes = (): ProcessNode[] =>
    rfNodes.map((n) => {
      const pn = n.data._processNode as ProcessNode
      return { ...pn, position_x: n.position.x, position_y: n.position.y }
    })

  const getCurrentTransitions = () =>
    rfEdges.map((e) => ({
      id: e.id,
      from_node_id: e.source,
      to_node_id: e.target,
      condition: (e.data as { condition?: string } | undefined)?.condition ?? null,
      label: typeof e.label === 'string' ? e.label : '',
    }))

  // ── Validation ────────────────────────────────────────────────────────────

  const validationResult = validateProcess(getCurrentNodes(), getCurrentTransitions())

  // Keep nodeState in sync with validation result (PD-220–PD-223)
  const errorNodeIds = new Set(validationResult.errors.filter((e) => e.nodeId).map((e) => e.nodeId!))
  useEffect(() => {
    setRfNodes((prev) =>
      prev.map((n) => {
        const pn = n.data._processNode as ProcessNode
        const state = nodeArtifactState(pn, errorNodeIds)
        if (n.data.nodeState === state) return n
        return { ...n, data: { ...n.data, nodeState: state } }
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validationResult.errors.length, rfEdges.length])

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (isNew) {
      // Create process + nodes in one batch
      const procTempId = 'tmp_proc'
      const nodes = getCurrentNodes()
      const transitions = getCurrentTransitions()
      const status = deriveStatus(nodes, transitions)

      const ops: Parameters<typeof persist.mutateAsync>[0]['operations'] = [
        {
          temp_id: procTempId,
          operation: 'create',
          object_type: 'process_definition',
          data: {
            object_name: processName || 'nuevo_proceso',
            parent: 'proj-001',
            content: {
              description: processDescription,
              version: 1,
              status,
              context_variables: contextVariables,
              transitions,
              metadata_canvas: { zoom: 1, pan_x: 0, pan_y: 0 },
            },
          },
        },
        ...nodes.map((n) => ({
          operation: 'create' as const,
          object_type: 'node' as const,
          data: {
            process_id: procTempId,
            node_type: n.node_type,
            name: n.name,
            description: n.description,
            position_x: n.position_x,
            position_y: n.position_y,
            config: n.config,
          },
        })),
      ]

      try {
        const res = await persist.mutateAsync({ operations: ops })
        const newId = res.results[0]?.id
        toast.success('Proceso creado')
        setIsDirty(false)
        if (newId) navigate(`/processes/${newId}`, { replace: true })
      } catch (err) {
        const e = err as { error?: { message?: string; details?: { message: string }[] } }
        toast.error(e?.error?.details?.[0]?.message ?? e?.error?.message ?? 'Error al guardar')
      }
      return
    }

    // Update existing process
    if (!remote) return
    const nodes = getCurrentNodes()
    const transitions = getCurrentTransitions()
    const status = deriveStatus(nodes, transitions)

    // Determine which nodes are new vs existing
    const existingNodeIds = new Set((remote.nodes ?? []).map((n) => n.id_node))
    const deletedNodeIds = [...existingNodeIds].filter((nid) => !nodes.find((n) => n.id_node === nid))

    const ops: Parameters<typeof persist.mutateAsync>[0]['operations'] = [
      {
        operation: 'update',
        object_type: 'process_definition',
        id: remote.id_object,
        data: {
          object_name: processName,
          content: {
            ...remote.content,
            description: processDescription,
            status,
            context_variables: contextVariables,
            transitions,
          },
        },
      },
      ...nodes.map((n) =>
        existingNodeIds.has(n.id_node)
          ? {
              operation: 'update' as const,
              object_type: 'node' as const,
              id: n.id_node,
              data: {
                name: n.name,
                description: n.description,
                position_x: n.position_x,
                position_y: n.position_y,
                config: n.config,
              },
            }
          : {
              operation: 'create' as const,
              object_type: 'node' as const,
              data: {
                process_id: remote.id_object,
                node_type: n.node_type,
                name: n.name,
                description: n.description,
                position_x: n.position_x,
                position_y: n.position_y,
                config: n.config,
              },
            },
      ),
      ...deletedNodeIds.map((nid) => ({
        operation: 'delete' as const,
        object_type: 'node' as const,
        id: nid,
      })),
    ]

    try {
      await persist.mutateAsync({ operations: ops })
      toast.success('Proceso guardado')
      setIsDirty(false)
    } catch (err) {
      const e = err as { error?: { message?: string; details?: { message: string }[] } }
      toast.error(e?.error?.details?.[0]?.message ?? e?.error?.message ?? 'Error al guardar')
    }
  }

  // ── Start instance ────────────────────────────────────────────────────────

  const handleStartInstance = async () => {
    if (!id) return
    try {
      const res = await startInstance.mutateAsync({
        processId: id,
        body: { initial_context: {}, started_by: 'demo_user' },
      })
      toast.success('Instancia iniciada')
      setShowStartModal(false)
      navigate(`/instances/${res.id_process_instance}`)
    } catch (err) {
      const e = err as { error?: { message?: string } }
      toast.error(e?.error?.message ?? 'Error al iniciar')
    }
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!isNew && isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" label="Cargando proceso…" />
      </div>
    )
  }

  if (!isNew && error) {
    return (
      <div className="p-8">
        <ErrorState
          title="No fue posible cargar el proceso"
          detail={JSON.stringify(error, null, 2)}
          onRetry={() => navigate(0)}
        />
      </div>
    )
  }

  const isConfigured = deriveStatus(getCurrentNodes(), getCurrentTransitions()) === 'configured'

  return (
    <div className="flex h-full flex-col">
      {/* Topbar */}
      <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4">
        <button
          onClick={() => navigate('/processes')}
          className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-primary)]"
          aria-label="Volver"
        >
          <ChevronLeft size={18} />
        </button>

        <Breadcrumbs
          items={[
            { label: 'Procesos', to: '/processes' },
            { label: isNew ? 'Nuevo proceso' : (processName || '…') },
          ]}
        />

        {isDirty && (
          <span className="flex items-center gap-1 rounded-full bg-[var(--state-warning-bg)] px-2 py-0.5 text-caption text-[var(--state-warning-text)]">
            <AlertTriangle size={11} aria-hidden /> Sin guardar
          </span>
        )}

        {!isDirty && isConfigured && !isNew && (
          <span className="flex items-center gap-1 rounded-full bg-[var(--state-success-bg)] px-2 py-0.5 text-caption text-[var(--state-success-text)]">
            <CheckCircle size={11} aria-hidden /> Configurado
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowValidation(true)}
          >
            Validar
          </Button>
          {isConfigured && !isNew && (
            <Button variant="secondary" size="sm" onClick={() => setShowStartModal(true)}>
              <Play size={14} aria-hidden /> Iniciar
            </Button>
          )}
          <Button size="sm" onClick={() => void handleSave()} loading={persist.isPending}>
            <Save size={14} aria-hidden /> Guardar
          </Button>
        </div>
      </header>

      {/* MVP warning if unsupported nodes present */}
      {(validationResult.warnings.length > 0) && (
        <div className="flex items-center gap-2 border-b border-[var(--state-warning)]/30 bg-[var(--state-warning-bg)] px-4 py-1.5 text-caption text-[var(--state-warning-text)]">
          <AlertTriangle size={12} aria-hidden />
          {validationResult.warnings[0]?.message}
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left palette (PD-10, PD-20–PD-34) */}
        <NodePalette
          hasStart={rfNodes.some((n) => n.type === 'start')}
          collapsed={paletteCollapsed}
          onToggleCollapse={() => setPaletteCollapsed((v) => !v)}
          onAddNode={(type) => addNode(type)}
        />

        {/* Canvas */}
        <div className="relative flex-1 overflow-hidden" onDrop={onDrop} onDragOver={onDragOver}>
          {/* PD-50: empty canvas CTA — shown when there are no nodes yet */}
          {rfNodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
              <button
                className={[
                  'pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full',
                  'border-2 border-dashed border-[var(--action-primary)]/60 bg-[var(--bg-surface)]',
                  'text-[var(--action-primary)] shadow-sm',
                  'hover:border-[var(--action-primary)] hover:bg-[var(--action-bg-subtle)]',
                  'transition-all duration-150',
                ].join(' ')}
                onClick={() => addNode('start')}
                aria-label="Crear nodo de inicio"
              >
                <Plus size={28} aria-hidden />
              </button>
              <p className="pointer-events-none text-body-sm text-[var(--text-tertiary)]">
                Comienza añadiendo el nodo de Inicio
              </p>
            </div>
          )}

          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeUpdate={onEdgeUpdate}
            edgesUpdatable
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            onInit={(inst) => { rfInstance.current = inst }}
            snapToGrid
            snapGrid={[20, 20]}
            fitView
            deleteKeyCode="Delete"
            className="bg-[var(--bg-canvas)]"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border-subtle)" />
            <Controls className="!border-[var(--border-subtle)] !bg-[var(--bg-surface)] !shadow-none" />
            <MiniMap
              className="!border-[var(--border-subtle)] !bg-[var(--bg-surface)]"
              nodeColor="var(--action-primary)"
              maskColor="rgba(0,0,0,0.2)"
              style={{ width: 150, height: 90 }}
            />
          </ReactFlow>
        </div>

        {/* Right panel */}
        <ProcessPropertiesPanel
          selection={selection}
          processName={processName}
          processDescription={processDescription}
          contextVariables={contextVariables}
          forms={forms}
          outgoingTransitions={
            selection.type === 'node'
              ? rfEdges
                  .filter((e) => e.source === selection.node.id_node)
                  .map((e) => ({ id: e.id, label: typeof e.label === 'string' ? e.label : e.id }))
              : []
          }
          collapsed={rightCollapsed}
          onToggleCollapse={() => setRightCollapsed((v) => !v)}
          onProcessNameChange={(v) => { setProcessName(v); markDirty() }}
          onProcessDescriptionChange={(v) => { setProcessDescription(v); markDirty() }}
          onContextVariablesChange={(vars) => { setContextVariables(vars); markDirty() }}
          onNodeChange={handleNodeChange}
          onEdgeChange={handleEdgeChange}
        />
      </div>

      {/* Validation modal */}
      <Modal
        open={showValidation}
        onClose={() => setShowValidation(false)}
        title="Validación del proceso"
        size="sm"
      >
        {validationResult.valid ? (
          <div className="flex items-center gap-2 text-[var(--state-success-text)]">
            <CheckCircle size={18} aria-hidden />
            <span className="text-body font-medium">El proceso es válido y puede ejecutarse.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {validationResult.errors.map((e, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md bg-[var(--state-error-bg)] px-3 py-2">
                <span className="mt-0.5 flex-shrink-0 text-[var(--state-error-text)]">✕</span>
                <div>
                  <span className="font-mono text-caption text-[var(--text-muted)]">{e.rule}</span>
                  <p className="text-body-sm text-[var(--state-error-text)]">{e.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {validationResult.warnings.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {validationResult.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md bg-[var(--state-warning-bg)] px-3 py-2">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-[var(--state-warning-text)]" aria-hidden />
                <p className="text-body-sm text-[var(--state-warning-text)]">{w.message}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Start instance modal */}
      <Modal
        open={showStartModal}
        onClose={() => setShowStartModal(false)}
        title={`Iniciar: ${processName}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowStartModal(false)}>Cancelar</Button>
            <Button onClick={() => void handleStartInstance()} loading={startInstance.isPending}>
              <Play size={14} aria-hidden /> Iniciar instancia
            </Button>
          </>
        }
      >
        <p className="text-body text-[var(--text-secondary)]">
          Se creará una nueva ejecución del proceso. El motor MVP avanzará automáticamente hasta el primer nodo <span className="font-mono">human_task</span>.
        </p>
      </Modal>
    </div>
  )
}
