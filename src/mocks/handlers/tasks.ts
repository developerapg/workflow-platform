import { http, HttpResponse } from 'msw'
import { store } from '../store'
import type { NodeInstance } from '@/api/types'
import type { CompleteTaskRequest } from '@/api/types'

const DEMO_USER = 'user-demo'

function uuid() { return crypto.randomUUID() }
function now() { return new Date().toISOString() }

export const taskHandlers = [
  // GET /api/tasks/me
  http.get('/api/tasks/me', () => {
    const tasks = store.getTasks().filter((t) => t.status === 'pending' || t.status === 'claimed')
    return HttpResponse.json({ items: tasks, total: tasks.length })
  }),

  // POST /api/tasks/:id/claim
  http.post('/api/tasks/:id/claim', ({ params }) => {
    const task = store.getTaskById(params['id'] as string)
    if (!task) return HttpResponse.json({ error: { code: 'not_found', message: 'Task not found', details: [], correlation_id: 'mock' } }, { status: 404 })
    if (task.status === 'claimed') {
      return HttpResponse.json({ error: { code: 'conflict', message: 'Task already claimed', details: [], correlation_id: 'mock' } }, { status: 409 })
    }
    if (task.status !== 'pending') {
      return HttpResponse.json({ error: { code: 'bad_request', message: 'Task cannot be claimed', details: [], correlation_id: 'mock' } }, { status: 422 })
    }
    const ts = now()
    const updated = { ...task, status: 'claimed' as const, claimed_at: ts, assigned_to: DEMO_USER }
    store.updateTask(updated)
    return HttpResponse.json({ id_task: task.id_task, status: 'claimed', claimed_at: ts, assigned_to: DEMO_USER })
  }),

  // POST /api/tasks/:id/complete
  http.post('/api/tasks/:id/complete', async ({ params, request }) => {
    const taskId = params['id'] as string
    const body = (await request.json()) as CompleteTaskRequest

    const task = store.getTaskById(taskId)
    if (!task) return HttpResponse.json({ error: { code: 'not_found', message: 'Task not found', details: [], correlation_id: 'mock' } }, { status: 404 })
    if (task.status === 'completed') {
      return HttpResponse.json({ error: { code: 'conflict', message: 'Task already completed', details: [], correlation_id: 'mock' } }, { status: 409 })
    }

    const ts = now()
    const completedTask = { ...task, status: 'completed' as const, completed_at: ts }
    store.updateTask(completedTask)

    // Update instance
    const instance = store.getInstanceById(task.process_instance_id)
    if (instance) {
      // Mark current node instance as completed
      const updatedHistory = instance.history.map((ni) =>
        ni.id_node_instance === task.node_instance_id
          ? { ...ni, status: 'completed' as const, completed_at: ts }
          : ni,
      )

      // Merge context updates
      const existingContextNames = new Set(instance.context.map((c) => c.name))
      const newContextEntries = Object.entries(body.context_updates ?? {})
        .filter(([name]) => !existingContextNames.has(name))
        .map(([name, value], i) => ({
          id: `cv-upd-${i}-${Date.now()}`,
          process_instance_id: instance.id_process_instance,
          name,
          value: value as string | number | boolean | null,
          data_type: 'string',
          set_at: ts,
        }))
      const updatedContext = [
        ...instance.context.map((c) =>
          body.context_updates && c.name in body.context_updates
            ? { ...c, value: body.context_updates[c.name] as string | number | boolean | null, set_at: ts }
            : c,
        ),
        ...newContextEntries,
      ]

      // Advance to next node
      const process = store.getProcessById(instance.process_definition_id)
      const currentNodeId = instance.current_node_instance?.node_id
      let nextNodeInstance: NodeInstance | null = null
      let nextTask = null
      let newStatus: 'running' | 'completed' = 'running'

      if (process && currentNodeId) {
        const transition = process.content.transitions.find((t) => t.from_node_id === currentNodeId)
        if (transition) {
          const nodes = store.getNodes(instance.process_definition_id)
          const nextNode = nodes.find((n) => n.id_node === transition.to_node_id)
          if (nextNode) {
            const seqNum = updatedHistory.length + 1
            nextNodeInstance = {
              id_node_instance: uuid(),
              process_instance_id: instance.id_process_instance,
              node_id: nextNode.id_node,
              node_name: nextNode.name,
              node_type: nextNode.node_type,
              status: nextNode.node_type === 'end' ? 'completed' : 'active',
              entered_at: ts,
              completed_at: nextNode.node_type === 'end' ? ts : null,
              sequence_number: seqNum,
              error_message: null,
            }

            if (nextNode.node_type === 'end') {
              newStatus = 'completed'
            } else if (nextNode.node_type === 'human_task') {
              const config = nextNode.config as { _type: string; form_ref: string; assignment: { type: string; value: string } }
              nextTask = {
                id_task: uuid(),
                title: nextNode.name.replace(/_/g, ' '),
                status: 'pending' as const,
                form_definition_id: config.form_ref,
                form_definition_name: config.form_ref,
                process_instance_id: instance.id_process_instance,
                process_definition_name: process.object_name,
                node_instance_id: nextNodeInstance.id_node_instance,
                created_at: ts,
                claimed_at: null,
                completed_at: null,
                assigned_to: null,
                assigned_role: config.assignment.value,
              }
              store.addTask(nextTask)
            }
          }
        }
      }

      const updatedInstance = {
        ...instance,
        status: newStatus,
        completed_at: newStatus === 'completed' ? ts : null,
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
        history: [...updatedHistory, ...(nextNodeInstance ? [nextNodeInstance] : [])],
        context: updatedContext,
        active_tasks: nextTask ? [nextTask] : [],
      }
      store.updateInstance(updatedInstance)

      return HttpResponse.json({
        id_task: taskId,
        status: 'completed',
        completed_at: ts,
        process_instance_state: {
          status: newStatus,
          current_node_instance: updatedInstance.current_node_instance,
        },
      })
    }

    return HttpResponse.json({ id_task: taskId, status: 'completed', completed_at: ts, process_instance_state: { status: 'running', current_node_instance: null } })
  }),
]
