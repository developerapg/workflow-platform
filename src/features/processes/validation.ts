import type { ProcessNode, Transition } from '@/api/types'

export interface ValidationError {
  rule: string
  message: string
  nodeId?: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}

/**
 * VR-25: exactly one start node.
 * VR-26: at least one end node.
 * VR-27: all non-start nodes must be reachable from start.
 * VR-28: start has no incoming edges; end has no outgoing edges.
 */
export function validateProcess(
  nodes: ProcessNode[],
  transitions: Transition[],
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  const starts = nodes.filter((n) => n.node_type === 'start')
  const ends = nodes.filter((n) => n.node_type === 'end')

  // VR-25
  if (starts.length === 0) {
    errors.push({ rule: 'VR-25', message: 'El proceso debe tener exactamente un nodo de inicio.' })
  } else if (starts.length > 1) {
    errors.push({ rule: 'VR-25', message: `Se encontraron ${starts.length} nodos de inicio. Solo se permite uno.` })
  }

  // VR-26
  if (ends.length === 0) {
    errors.push({ rule: 'VR-26', message: 'El proceso debe tener al menos un nodo de fin.' })
  }

  // VR-28: start has no incoming
  for (const start of starts) {
    const incoming = transitions.filter((t) => t.to_node_id === start.id_node)
    if (incoming.length > 0) {
      errors.push({
        rule: 'VR-28',
        message: `El nodo de inicio "${start.name}" no puede tener conexiones entrantes.`,
        nodeId: start.id_node,
      })
    }
  }

  // VR-28: end has no outgoing
  for (const end of ends) {
    const outgoing = transitions.filter((t) => t.from_node_id === end.id_node)
    if (outgoing.length > 0) {
      errors.push({
        rule: 'VR-28',
        message: `El nodo de fin "${end.name}" no puede tener conexiones salientes.`,
        nodeId: end.id_node,
      })
    }
  }

  // VR-27: reachability BFS from start
  if (starts.length === 1) {
    const startId = starts[0]!.id_node
    const visited = new Set<string>([startId])
    const queue = [startId]
    while (queue.length) {
      const current = queue.shift()!
      for (const t of transitions) {
        if (t.from_node_id === current && !visited.has(t.to_node_id)) {
          visited.add(t.to_node_id)
          queue.push(t.to_node_id)
        }
      }
    }
    for (const node of nodes) {
      if (!visited.has(node.id_node)) {
        errors.push({
          rule: 'VR-27',
          message: `El nodo "${node.name}" no es alcanzable desde el inicio.`,
          nodeId: node.id_node,
        })
      }
    }
  }

  // Warning: MVP engine limitations
  const unsupported = nodes.filter(
    (n) => n.node_type === 'script_task' || n.node_type === 'exclusive_gateway',
  )
  if (unsupported.length > 0) {
    warnings.push({
      rule: 'MVP',
      message: `El proceso contiene ${unsupported.length} nodo(s) no ejecutable(s) en el motor MVP (script_task, exclusive_gateway).`,
    })
  }

  const conditionedTransitions = transitions.filter((t) => t.condition)
  if (conditionedTransitions.length > 0) {
    warnings.push({
      rule: 'MVP',
      message: `${conditionedTransitions.length} conexión(es) tienen condición. El motor MVP no las evalúa.`,
    })
  }

  return { valid: errors.length === 0, errors, warnings }
}

/** Derive process status: 'configured' if valid and has nodes, 'draft' otherwise */
export function deriveStatus(
  nodes: ProcessNode[],
  transitions: Transition[],
): 'draft' | 'configured' {
  if (nodes.length === 0) return 'draft'
  const result = validateProcess(nodes, transitions)
  return result.valid ? 'configured' : 'draft'
}
