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
  ConnectionMode,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type ReactFlowInstance,
  BackgroundVariant,
  MarkerType,
} from 'reactflow'
import { AlertTriangle, Save, ChevronLeft, CheckCircle, Play, Plus, Map as MapIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useProcess, useForms, usePersist, useStartInstance } from '@/api/queries'
import { Button, Breadcrumbs, Spinner, ErrorState, Modal } from '@/ui'
import type { ProcessNode, ContextVariable } from '@/api/types'
import type { Direction } from './canvas/nodes/NodeShell'
import { StartNode } from './canvas/nodes/StartNode'
import { EndNode } from './canvas/nodes/EndNode'
import { HumanTaskNode } from './canvas/nodes/HumanTaskNode'
import { ScriptTaskNode } from './canvas/nodes/ScriptTaskNode'
import { ExclusiveGatewayNode } from './canvas/nodes/ExclusiveGatewayNode'
import { ProcessPropertiesPanel, type Selection } from './components/ProcessPropertiesPanel'
import { validateProcess, deriveStatus } from './validation'
import type { NodeType } from '@/api/types'
import type { ArtifactState } from '@/ui'

// ── Edge type helpers ─────────────────────────────────────────────────────────

function resolveEdgeType(
  src: { x: number; y: number } | undefined,
  tgt: { x: number; y: number } | undefined,
): 'straight' | 'smoothstep' {
  if (!src || !tgt) return 'smoothstep'
  const THRESHOLD = 10
  return Math.abs(src.x - tgt.x) <= THRESHOLD || Math.abs(src.y - tgt.y) <= THRESHOLD
    ? 'straight'
    : 'smoothstep'
}

function getOccupiedSides(nodeId: string, edges: { source: string; sourceHandle?: string | null }[]): Direction[] {
  const dirs: Direction[] = ['top', 'right', 'bottom', 'left']
  return dirs.filter((dir) =>
    edges.some((e) => e.source === nodeId && e.sourceHandle === dir),
  )
}

const OPPOSITE_DIR: Record<Direction, Direction> = { right: 'left', left: 'right', bottom: 'top', top: 'bottom' }

/**
 * Assigns source/target handles to a set of edges leaving the same node, avoiding
 * side collisions where possible. Edges are sorted by their "ideal" direction score
 * and each gets the best available side. Falls back to sharing sides when there are
 * more than 4 outgoing edges.
 */
function assignHandlesWithoutCollision(
  sourceId: string,
  edges: Edge[],
  nodePositions: Map<string, { x: number; y: number }>,
): Edge[] {
  const srcPos = nodePositions.get(sourceId)
  if (!srcPos) return edges

  const DIRS = ['right', 'bottom', 'left', 'top'] as const
  type Dir = typeof DIRS[number]

  // Score each edge by angle to determine preferred direction order
  const scored = edges.map((e) => {
    const tgtPos = nodePositions.get(e.target)
    if (!tgtPos) return { edge: e, preferred: DIRS as unknown as Dir[] }
    const dx = tgtPos.x - srcPos.x
    const dy = tgtPos.y - srcPos.y
    // Sort directions by how well they align with the actual vector
    const scores: [Dir, number][] = [
      ['right',  dx],
      ['left',  -dx],
      ['bottom', dy],
      ['top',   -dy],
    ]
    scores.sort((a, b) => b[1] - a[1])
    return { edge: e, preferred: scores.map(([d]) => d) }
  })

  const used = new Set<string>()
  const result: Edge[] = []

  for (const { edge, preferred } of scored) {
    // Pick the first available preferred direction; fallback to first preference (shared side)
    const dir = preferred.find((d) => !used.has(d)) ?? preferred[0]
    used.add(dir)
    result.push({ ...edge, sourceHandle: dir, targetHandle: OPPOSITE_DIR[dir] })
  }

  return result
}

// ── Node artifact state ───────────────────────────────────────────────────────

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
  onAddNext?: (sourceId: string, type: NodeType, direction: Direction) => void,
  hasStart?: boolean,
  edges: { source: string; sourceHandle?: string | null }[] = [],
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
      label: n.display_name?.trim() || n.name.replace(/_/g, ' '),
      formName,
      nodeState: nodeArtifactState(n, errorNodeIds),
      onAddNext: n.node_type !== 'end' && onAddNext
        ? (type: NodeType, dir: Direction) => onAddNext(n.id_node, type, dir)
        : undefined,
      hasStart,
      occupiedSides: getOccupiedSides(n.id_node, edges),
      _processNode: n,
    },
  }
}

const DEFAULT_DISPLAY_NAME: Record<NodeType, string> = {
  start:             'Inicio',
  end:               'Fin',
  human_task:        'Tarea humana',
  script_task:       'Script',
  exclusive_gateway: 'Decisión',
}

const DEFAULT_TECH_NAME: Record<NodeType, string> = {
  start:             'inicio',
  end:               'fin',
  human_task:        'tarea_humana',
  script_task:       'script',
  exclusive_gateway: 'decision',
}

// Generate a unique technical name within the current set (suffix _2, _3, …)
function uniqueTechName(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base
  let i = 2
  while (existing.has(`${base}_${i}`)) i++
  return `${base}_${i}`
}

// Helper: slugify a free-text label into a snake_case technical name (VR-40)
function slugifyName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^([^a-z])/, 'n_$1')
    .slice(0, 63) || 'nodo'
}

function toRfEdge(
  t: { id: string; from_node_id: string; to_node_id: string; condition: string | null; label: string; source_side?: string | null; target_side?: string | null; sourceHandle?: string | null; targetHandle?: string | null },
  nodePositions?: Map<string, { x: number; y: number }>,
): Edge {
  const edgeType = resolveEdgeType(
    nodePositions?.get(t.from_node_id),
    nodePositions?.get(t.to_node_id),
  )
  // Prefer the canonical source_side/target_side fields; fall back to legacy sourceHandle/targetHandle
  const normalizeHandle = (v: string | null | undefined) =>
    v ? v.replace(/-(source|target)$/, '') : null
  const sourceHandle = t.source_side ?? normalizeHandle(t.sourceHandle)
  const targetHandle = t.target_side ?? normalizeHandle(t.targetHandle)
  return {
    id: t.id,
    type: edgeType,
    source: t.from_node_id,
    target: t.to_node_id,
    sourceHandle,
    targetHandle,
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
  const addConnectedNodeRef = useRef<(sourceId: string, type: NodeType, dir: Direction) => void>(() => {})
  const [isDraggingEdge, setIsDraggingEdge] = useState(false)

  // Process metadata
  const [processName, setProcessName] = useState('')
  const [processDescription, setProcessDescription] = useState('')
  const [contextVariables, setContextVariables] = useState<ContextVariable[]>([])

  // UI
  const [selection, setSelection] = useState<Selection>({ type: 'none' })
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showValidation, setShowValidation] = useState(false)
  const [showStartModal, setShowStartModal] = useState(false)
  const [showMinimap, setShowMinimap] = useState(() => {
    try { return localStorage.getItem('wf:minimap') !== '0' } catch { return true }
  })
  const [savedViewport, setSavedViewport] = useState<{ x: number; y: number; zoom: number } | null>(null)

  useEffect(() => {
    try { localStorage.setItem('wf:minimap', showMinimap ? '1' : '0') } catch {
      // ignore localStorage quota or privacy-mode failures — minimap toggle is non-critical
    }
  }, [showMinimap])

  // Seed from remote
  useEffect(() => {
    if (!remote) return
    setProcessName(remote.object_name)
    setProcessDescription(remote.content.description)
    setContextVariables(remote.content.context_variables)
    const hasStart = (remote.nodes ?? []).some((n) => n.node_type === 'start')
    const posMap = new Map((remote.nodes ?? []).map((n) => [n.id_node, { x: n.position_x, y: n.position_y }]))
    const rfEdgesSeed = remote.content.transitions.map((t) => toRfEdge(t, posMap))
    setRfNodes((remote.nodes ?? []).map((n) =>
      toRfNode(
        n,
        forms,
        new Set(),
        (srcId, type, dir) => addConnectedNodeRef.current(srcId, type, dir),
        hasStart,
        rfEdgesSeed,
      ),
    ))
    setRfEdges(rfEdgesSeed)
    // Restore saved viewport from metadata_canvas (only meaningful if it differs from defaults)
    const mc = remote.content.metadata_canvas
    if (mc && (mc.zoom !== 1 || mc.pan_x !== 0 || mc.pan_y !== 0)) {
      setSavedViewport({ x: mc.pan_x, y: mc.pan_y, zoom: mc.zoom })
    } else {
      setSavedViewport(null)
    }
    setIsDirty(false)
  }, [remote, forms])

  // Apply the restored viewport once RF instance is ready and a viewport was saved
  useEffect(() => {
    if (savedViewport && rfInstance.current) {
      rfInstance.current.setViewport(savedViewport)
    }
  }, [savedViewport, rfNodes.length])

  const markDirty = useCallback(() => setIsDirty(true), [])

  // ── RF event handlers ─────────────────────────────────────────────────────

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setRfNodes((nds) => applyNodeChanges(changes, nds))
      // When nodes finish moving, recalculate edge type + handles + occupiedSides
      const hasPositionChange = changes.some((c) => c.type === 'position' && !('dragging' in c && c.dragging))
      if (hasPositionChange) {
        const movedIds = new Set(
          changes
            .filter((c) => c.type === 'position' && !('dragging' in c && c.dragging))
            .map((c) => c.id),
        )
        setRfNodes((nds) => {
          const posMap = new Map(nds.map((n) => [n.id, n.position]))

          setRfEdges((eds) => {
            // Collect source nodes whose edges need recalculation
            const affectedSourceIds = new Set(
              eds.filter((e) => movedIds.has(e.source) || movedIds.has(e.target)).map((e) => e.source),
            )

            // Assign handles per source node to avoid side collisions.
            // Skip edges flagged as manualHandles (user dragged the endpoint).
            const isManual = (e: Edge) => (e.data as { manualHandles?: boolean } | undefined)?.manualHandles === true
            const reassigned = new Map<string, Edge>()
            for (const srcId of affectedSourceIds) {
              const outgoing = eds.filter(
                (e) => e.source === srcId && (movedIds.has(e.source) || movedIds.has(e.target)) && !isManual(e),
              )
              const fixed = assignHandlesWithoutCollision(srcId, outgoing, posMap)
              for (const e of fixed) reassigned.set(e.id, e)
            }

            const updated = eds.map((e) => {
              const reassignedEdge = reassigned.get(e.id)
              if (!reassignedEdge) return e
              const srcNode = nds.find((n) => n.id === e.source)
              const tgtNode = nds.find((n) => n.id === e.target)
              const newType = resolveEdgeType(srcNode?.position, tgtNode?.position)
              return { ...reassignedEdge, type: newType }
            })

            setRfNodes((prevNds) =>
              prevNds.map((n) =>
                affectedSourceIds.has(n.id)
                  ? { ...n, data: { ...n.data, occupiedSides: getOccupiedSides(n.id, updated) } }
                  : n,
              ),
            )
            return updated
          })
          return nds
        })
      }
      if (changes.some((c) => c.type !== 'select')) markDirty()
    },
    [markDirty],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setRfEdges((eds) => {
        const updated = applyEdgeChanges(changes, eds)
        // When edges are removed, free up the occupied sides of their source nodes
        const removals = changes.filter((c) => c.type === 'remove')
        if (removals.length > 0) {
          const removedIds = new Set(removals.map((c) => c.id))
          const affected = new Set(
            eds.filter((e) => removedIds.has(e.id)).map((e) => e.source),
          )
          setRfNodes((nds) =>
            nds.map((n) =>
              affected.has(n.id)
                ? { ...n, data: { ...n.data, occupiedSides: getOccupiedSides(n.id, updated) } }
                : n,
            ),
          )
        }
        return updated
      })
      markDirty()
    },
    [markDirty],
  )

  // Allow dragging edge endpoints to different handles (PD-73, PD-74)
  const onEdgeUpdate = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setRfEdges((eds) => {
        // Mark the edge as manually positioned so onNodesChange won't auto-reassign its handles
        const updated = updateEdge(oldEdge, newConnection, eds).map((e) =>
          e.id === oldEdge.id ? { ...e, data: { ...(e.data ?? {}), manualHandles: true } } : e,
        )
        const affected = new Set(
          [oldEdge.source, newConnection.source].filter((x): x is string => Boolean(x)),
        )
        setRfNodes((nds) =>
          nds.map((n) =>
            affected.has(n.id)
              ? { ...n, data: { ...n.data, occupiedSides: getOccupiedSides(n.id, updated) } }
              : n,
          ),
        )
        return updated
      })
      markDirty()
    },
    [markDirty],
  )

  const onConnect = useCallback(
    (params: Connection) => {
      const srcNode = rfNodes.find((n) => n.id === params.source)
      const tgtNode = rfNodes.find((n) => n.id === params.target)
      const edgeType = resolveEdgeType(srcNode?.position, tgtNode?.position)
      const newEdge: Edge = {
        ...params,
        id: `t-${crypto.randomUUID()}`,
        type: edgeType,
        source: params.source!,
        target: params.target!,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: 'var(--border-default)', strokeWidth: 2, borderRadius: 8 },
        labelStyle: { fontSize: 11, fill: 'var(--text-secondary)' },
        labelBgStyle: { fill: 'var(--bg-surface)', stroke: 'var(--border-subtle)', strokeWidth: 1, rx: 4 },
        labelBgPadding: [4, 6] as [number, number],
        data: { condition: null },
      }
      setRfEdges((eds) => {
        const updated = addEdge(newEdge, eds)
        // Update occupiedSides of source node after manual connection
        if (params.source) {
          setRfNodes((nds) =>
            nds.map((n) =>
              n.id === params.source
                ? { ...n, data: { ...n.data, occupiedSides: getOccupiedSides(n.id, updated) } }
                : n,
            ),
          )
        }
        return updated
      })
      markDirty()
    },
    [rfNodes, markDirty],
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const pn = node.data._processNode as ProcessNode | undefined
      const outgoing = rfEdges.filter((e) => e.source === node.id)
      const targets = outgoing.map((e) => rfNodes.find((n) => n.id === e.target)).filter(Boolean)
      console.log('[NODE DEBUG]', JSON.stringify({
        node,
        outgoingEdges: outgoing.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          type: e.type,
          label: e.label,
          data: e.data,
        })),
        targetNodes: targets.map((n) => n && ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: { name: n.data.name, label: n.data.label, occupiedSides: n.data.occupiedSides },
        })),
      }, null, 2))
      if (pn) setSelection({ type: 'node', node: pn })
    },
    [rfEdges, rfNodes],
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
    (sourceNodeId: string, nodeType: NodeType, direction: Direction) => {
      setRfNodes((prev) => {
        const sourceRfNode = prev.find((n) => n.id === sourceNodeId)
        const OFFSET = 180
        const snap = (v: number) => Math.round(v / 20) * 20
        const position = sourceRfNode
          ? {
              x: snap(sourceRfNode.position.x + (direction === 'right' ? OFFSET : direction === 'left' ? -OFFSET : 0)),
              y: snap(sourceRfNode.position.y + (direction === 'bottom' ? OFFSET : direction === 'top' ? -OFFSET : 0)),
            }
          : { x: 400, y: 200 }

        const id_node = `node-${crypto.randomUUID()}`
        const existingNames = new Set(prev.map((n) => (n.data._processNode as ProcessNode).name))
        const baseName = DEFAULT_TECH_NAME[nodeType]
        const techName = uniqueTechName(baseName, existingNames)
        const displayName = DEFAULT_DISPLAY_NAME[nodeType]
        const config: ProcessNode['config'] =
          nodeType === 'human_task'   ? { _type: 'human_task', form_ref: '', assignment: { type: 'role', value: '' }, due_in: null }
          : nodeType === 'end'         ? { _type: 'end', result_label: 'Completado' }
          : nodeType === 'script_task' ? { _type: 'script_task', language: 'javascript', source: '' }
          : nodeType === 'start'       ? { _type: 'start' }
          :                              { _type: 'exclusive_gateway', default_transition_id: null }

        const processNode: ProcessNode = {
          id_node,
          process_id: id ?? 'new',
          node_type: nodeType,
          name: techName,
          display_name: displayName,
          description: '',
          position_x: position.x,
          position_y: position.y,
          config,
        }

        const sourceHandle = direction
        const targetHandle = OPPOSITE_DIR[direction]
        const edgeType = resolveEdgeType(sourceRfNode?.position, position)
        const newEdge: Edge = {
          id: `t-${crypto.randomUUID()}`,
          type: edgeType,
          source: sourceNodeId,
          sourceHandle,
          target: id_node,
          targetHandle,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: 'var(--border-default)', strokeWidth: 2, borderRadius: 8 },
            labelStyle: { fontSize: 11, fill: 'var(--text-secondary)' },
          labelBgStyle: { fill: 'var(--bg-surface)', stroke: 'var(--border-subtle)', strokeWidth: 1, rx: 4 },
          labelBgPadding: [4, 6] as [number, number],
          data: { condition: null },
        }

        setRfEdges((eds) => {
          const updated = [...eds, newEdge]
          // Update occupiedSides of the source node now that a new edge exists
          setRfNodes((nds) =>
            nds.map((n) =>
              n.id === sourceNodeId
                ? { ...n, data: { ...n.data, occupiedSides: getOccupiedSides(n.id, updated) } }
                : n,
            ),
          )
          return updated
        })

        const rfNode: Node = {
          id: id_node,
          type: nodeType,
          position,
          data: {
            name: techName,
            label: displayName,
            nodeState: 'draft' as const,
            onAddNext: nodeType !== 'end'
              ? (t: NodeType, dir: Direction) => addConnectedNodeRef.current(id_node, t, dir)
              : undefined,
            hasStart: prev.some((n) => n.type === 'start') || nodeType === 'start',
            occupiedSides: [] as Direction[],
            _processNode: processNode,
          },
        }

        setSelection({ type: 'node', node: processNode })
        markDirty()
        return [...prev, rfNode]
      })
    },
    [id, markDirty],
  )

  // Keep ref in sync with the latest callback
  addConnectedNodeRef.current = addConnectedNode

  // Propagate isDraggingEdge to all node data so NodeShell can suppress "+" buttons
  // and to <body> so global CSS can reveal all handles as drop targets.
  useEffect(() => {
    setRfNodes((nds) =>
      nds.map((n) =>
        n.data.isDraggingEdge === isDraggingEdge
          ? n
          : { ...n, data: { ...n.data, isDraggingEdge } },
      ),
    )
    document.body.classList.toggle('rf-dragging-edge', isDraggingEdge)
    return () => { document.body.classList.remove('rf-dragging-edge') }
  }, [isDraggingEdge])

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

    const nodeType = type as NodeType
    const existingNames = new Set(rfNodes.map((n) => (n.data._processNode as ProcessNode).name))
    const techName = uniqueTechName(DEFAULT_TECH_NAME[nodeType], existingNames)
    const displayName = DEFAULT_DISPLAY_NAME[nodeType]

    const processNode: ProcessNode = {
      id_node,
      process_id: id ?? 'new',
      node_type: nodeType,
      name: techName,
      display_name: displayName,
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
        name: techName,
        label: displayName,
        nodeState: 'draft' as const,
        onAddNext: type !== 'end'
          ? (t: NodeType, dir: Direction) => addConnectedNodeRef.current(id_node, t, dir)
          : undefined,
        hasStart: rfNodes.some((n) => n.type === 'start') || type === 'start',
        occupiedSides: [] as Direction[],
        _processNode: processNode,
      },
    }

    setRfNodes((prev) => [...prev, rfNode])
    markDirty()
  }

  // ── Node property change ───────────────────────────────────────────────────

  const applyNodePatch = useCallback(
    (pn: ProcessNode, patch: Partial<ProcessNode>): ProcessNode => {
      // Auto-derive technical name from display_name when the user hasn't taken control of `name`.
      // Heuristic: if current `name` matches slug(current display_name), they're in sync → keep auto-deriving.
      const currentSlug = slugifyName(pn.display_name || '')
      const nameInSync = !pn.display_name || pn.name === currentSlug || pn.name === DEFAULT_TECH_NAME[pn.node_type]
      let updated: ProcessNode = { ...pn, ...patch }
      if (patch.display_name !== undefined && patch.name === undefined && nameInSync) {
        const slug = slugifyName(patch.display_name || '')
        if (slug) updated = { ...updated, name: slug }
      }
      return updated
    },
    [],
  )

  const handleNodeChange = useCallback(
    (nodeId: string, patch: Partial<ProcessNode> & { config?: ProcessNode['config'] }) => {
      setRfNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n
          const pn = n.data._processNode as ProcessNode
          const updated = applyNodePatch(pn, patch)
          return {
            ...n,
            data: {
              ...n.data,
              name: updated.name,
              label: updated.display_name?.trim() || updated.name.replace(/_/g, ' '),
              _processNode: updated,
            },
          }
        }),
      )
      setSelection((prev) => {
        if (prev.type !== 'node' || prev.node.id_node !== nodeId) return prev
        return { type: 'node', node: applyNodePatch(prev.node, patch) }
      })
      markDirty()
    },
    [markDirty, applyNodePatch],
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
      // Width/height live in RF state (set by NodeResizer) when overridden; otherwise keep pn's existing values
      const w = typeof n.width === 'number' ? n.width : pn.width
      const h = typeof n.height === 'number' ? n.height : pn.height
      return {
        ...pn,
        position_x: n.position.x,
        position_y: n.position.y,
        ...(w ? { width: w } : {}),
        ...(h ? { height: h } : {}),
      }
    })

  const getCurrentTransitions = () => {
    const isSide = (v: unknown): v is 'top' | 'right' | 'bottom' | 'left' =>
      v === 'top' || v === 'right' || v === 'bottom' || v === 'left'
    return rfEdges.map((e) => ({
      id: e.id,
      from_node_id: e.source,
      to_node_id: e.target,
      condition: (e.data as { condition?: string } | undefined)?.condition ?? null,
      label: typeof e.label === 'string' ? e.label : '',
      source_side: isSide(e.sourceHandle) ? e.sourceHandle : null,
      target_side: isSide(e.targetHandle) ? e.targetHandle : null,
    }))
  }

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

      const vp = rfInstance.current?.getViewport() ?? { x: 0, y: 0, zoom: 1 }
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
              metadata_canvas: { zoom: vp.zoom, pan_x: vp.x, pan_y: vp.y },
            },
          },
        },
        ...nodes.map((n) => ({
          operation: 'create' as const,
          object_type: 'node' as const,
          data: {
            id_node: n.id_node,
            process_id: procTempId,
            node_type: n.node_type,
            name: n.name,
            display_name: n.display_name,
            description: n.description,
            position_x: n.position_x,
            position_y: n.position_y,
            width: n.width,
            height: n.height,
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

    const vp = rfInstance.current?.getViewport() ?? { x: 0, y: 0, zoom: 1 }
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
            metadata_canvas: { zoom: vp.zoom, pan_x: vp.x, pan_y: vp.y },
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
                display_name: n.display_name,
                description: n.description,
                position_x: n.position_x,
                position_y: n.position_y,
                width: n.width,
                height: n.height,
                config: n.config,
              },
            }
          : {
              operation: 'create' as const,
              object_type: 'node' as const,
              data: {
                id_node: n.id_node,
                process_id: remote.id_object,
                node_type: n.node_type,
                name: n.name,
                display_name: n.display_name,
                description: n.description,
                position_x: n.position_x,
                position_y: n.position_y,
                width: n.width,
                height: n.height,
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
            variant={showMinimap ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setShowMinimap((v) => !v)}
            title={showMinimap ? 'Ocultar minimapa' : 'Mostrar minimapa'}
            aria-pressed={showMinimap}
          >
            <MapIcon size={14} aria-hidden />
          </Button>
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
            onEdgeUpdateStart={() => setIsDraggingEdge(true)}
            onEdgeUpdateEnd={() => setIsDraggingEdge(false)}
            onConnectStart={() => setIsDraggingEdge(true)}
            onConnectEnd={() => setIsDraggingEdge(false)}
            edgesUpdatable
            connectionMode={ConnectionMode.Loose}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            onInit={(inst) => {
              rfInstance.current = inst
              if (savedViewport) inst.setViewport(savedViewport)
            }}
            snapToGrid
            snapGrid={[20, 20]}
            fitView={!savedViewport}
            fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
            minZoom={0.2}
            maxZoom={2}
            deleteKeyCode="Delete"
            className="bg-[var(--bg-canvas)]"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border-subtle)" />
            <Controls className="!border-[var(--border-subtle)] !bg-[var(--bg-surface)] !shadow-none" />
            {showMinimap && (
              <MiniMap
                className="!border-[var(--border-subtle)] !bg-[var(--bg-surface)]"
                nodeColor="var(--action-primary)"
                maskColor="rgba(0,0,0,0.2)"
                style={{ width: 150, height: 90 }}
              />
            )}
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
