import { http, HttpResponse } from 'msw'
import { store } from '../store'
import type { InstanceDetail, NodeInstance, Task } from '@/api/types'
import type { StartInstanceRequest } from '@/api/types'

function uuid() { return crypto.randomUUID() }
function now() { return new Date().toISOString() }

// Minimal mock engine: advances process from start through first human_task
function advanceToNextTask(
  instanceId: string,
  processId: string,
  currentNodeId: string,
): { nextNodeInstance: NodeInstance | null; task: Task | null } {
  const process = store.getProcessById(processId)
  if (!process) return { nextNodeInstance: null, task: null }

  const transition = process.content.transitions.find((t) => t.from_node_id === currentNodeId)
  if (!transition) return { nextNodeInstance: null, task: null }

  const nextNode = store.getNodes(processId).find((n) => n.id_node === transition.to_node_id)
  if (!nextNode) return { nextNodeInstance: null, task: null }

  const nodeInstance: NodeInstance = {
    id_node_instance: uuid(),
    process_instance_id: instanceId,
    node_id: nextNode.id_node,
    node_name: nextNode.name,
    node_type: nextNode.node_type,
    status: nextNode.node_type === 'end' ? 'completed' : 'active',
    entered_at: now(),
    completed_at: nextNode.node_type === 'end' ? now() : null,
    sequence_number: 0, // caller sets real sequence
    error_message: null,
  }

  let task: Task | null = null
  if (nextNode.node_type === 'human_task') {
    const config = nextNode.config as { _type: string; form_ref: string; assignment: { type: string; value: string } }
    task = {
      id_task: uuid(),
      title: nextNode.name.replace(/_/g, ' '),
      status: 'pending',
      form_definition_id: config.form_ref,
      form_definition_name: config.form_ref,
      process_instance_id: instanceId,
      process_definition_name: process.object_name,
      node_instance_id: nodeInstance.id_node_instance,
      created_at: now(),
      claimed_at: null,
      completed_at: null,
      assigned_to: null,
      assigned_role: config.assignment.value,
    }
  }

  return { nextNodeInstance: nodeInstance, task }
}

export const instanceHandlers = [
  // POST /api/processes/:id/instances — start instance
  http.post('/api/processes/:id/instances', async ({ params, request }) => {
    const processId = params['id'] as string
    const body = (await request.json()) as StartInstanceRequest

    const process = store.getProcessById(processId)
    if (!process) {
      return HttpResponse.json({ error: { code: 'not_found', message: 'Process not found', details: [], correlation_id: 'mock' } }, { status: 404 })
    }
    if (process.content.status !== 'configured') {
      return HttpResponse.json({ error: { code: 'bad_request', message: 'Process must be in configured status to start', details: [], correlation_id: 'mock' } }, { status: 422 })
    }

    // Check for unsupported node types in the process
    const nodes = store.getNodes(processId)
    const unsupportedNode = nodes.find((n) => n.node_type === 'script_task' || n.node_type === 'exclusive_gateway')
    if (unsupportedNode) {
      return HttpResponse.json(
        { error: { code: 'unsupported_node_type', message: `Node type '${unsupportedNode.node_type}' is not supported by the MVP engine`, details: [], correlation_id: 'mock' } },
        { status: 422 },
      )
    }

    const instanceId = uuid()
    const ts = now()

    // Start node
    const startNode = nodes.find((n) => n.node_type === 'start')
    if (!startNode) {
      return HttpResponse.json({ error: { code: 'bad_request', message: 'Process has no start node', details: [], correlation_id: 'mock' } }, { status: 422 })
    }

    const startNodeInstance: NodeInstance = {
      id_node_instance: uuid(),
      process_instance_id: instanceId,
      node_id: startNode.id_node,
      node_name: startNode.name,
      node_type: 'start',
      status: 'completed',
      entered_at: ts,
      completed_at: ts,
      sequence_number: 1,
      error_message: null,
    }

    const { nextNodeInstance, task } = advanceToNextTask(instanceId, processId, startNode.id_node)
    if (nextNodeInstance) nextNodeInstance.sequence_number = 2

    const context = Object.entries(body.initial_context ?? {}).map(([name, value], i) => ({
      id: `cv-new-${i}`,
      process_instance_id: instanceId,
      name,
      value: value as string | number | boolean | null,
      data_type: 'string',
      set_at: ts,
    }))

    const activeTasks = task ? [task] : []

    const instance: InstanceDetail = {
      id_process_instance: instanceId,
      process_definition_id: processId,
      process_definition_name: process.object_name,
      process_version: process.content.version,
      status: 'running',
      started_at: ts,
      completed_at: null,
      error_message: null,
      current_node_instance: nextNodeInstance
        ? {
            id_node_instance: nextNodeInstance.id_node_instance,
            node_id: nextNodeInstance.node_id,
            node_name: nextNodeInstance.node_name,
            node_type: nextNodeInstance.node_type,
            entered_at: nextNodeInstance.entered_at,
            sequence_number: nextNodeInstance.sequence_number,
          }
        : null,
      history: [startNodeInstance, ...(nextNodeInstance ? [nextNodeInstance] : [])],
      context,
      active_tasks: activeTasks,
    }

    store.addInstance(instance)
    if (task) store.addTask(task)

    return HttpResponse.json(
      {
        id_process_instance: instanceId,
        process_definition_id: processId,
        process_version: process.content.version,
        status: 'running',
        started_at: ts,
        current_node: nextNodeInstance
          ? { id_node: nextNodeInstance.node_id, node_type: nextNodeInstance.node_type, name: nextNodeInstance.node_name }
          : null,
      },
      { status: 201 },
    )
  }),

  // GET /api/instances/:id
  http.get('/api/instances/:id', ({ params }) => {
    const instance = store.getInstanceById(params['id'] as string)
    if (!instance) {
      return HttpResponse.json({ error: { code: 'not_found', message: 'Instance not found', details: [], correlation_id: 'mock' } }, { status: 404 })
    }
    return HttpResponse.json(instance)
  }),
]
