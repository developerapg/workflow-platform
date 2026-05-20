/**
 * In-memory store for MSW mock data.
 * Persists to localStorage so demos survive page reloads.
 * Call resetStore() or window.resetMocks() to restore seed data.
 */
import type { Entity, Attribute, FormDefinition, ProcessDefinition, ProcessNode } from '@/api/types'
import type { InstanceDetail, Task } from '@/api/types'
import seedData from './fixtures/vacation_management.json'

const STORAGE_KEY = 'wf-mock-store'

interface StoreState {
  entities: Entity[]
  attributes: Attribute[]
  forms: FormDefinition[]
  processes: ProcessDefinition[]
  nodes: ProcessNode[]
  instances: InstanceDetail[]
  tasks: Task[]
}

function buildSeedState(): StoreState {
  return {
    entities: seedData.entities as Entity[],
    attributes: seedData.attributes as Attribute[],
    forms: seedData.forms as FormDefinition[],
    processes: seedData.processes as ProcessDefinition[],
    nodes: seedData.nodes as ProcessNode[],
    instances: seedData.instances as InstanceDetail[],
    tasks: seedData.tasks as Task[],
  }
}

function loadState(): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as StoreState
  } catch {
    // ignore
  }
  return buildSeedState()
}

function saveState(state: StoreState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

let state: StoreState = loadState()

export const store = {
  // --- Read ---
  getEntities: () => state.entities,
  getAttributes: (entityId?: string) =>
    entityId ? state.attributes.filter((a) => a.entity_id === entityId) : state.attributes,
  getForms: () => state.forms,
  getProcesses: () => state.processes,
  getNodes: (processId?: string) =>
    processId ? state.nodes.filter((n) => n.process_id === processId) : state.nodes,
  getInstances: () => state.instances,
  getTasks: () => state.tasks,

  getEntityById: (id: string) => state.entities.find((e) => e.id_object === id),
  getFormById: (id: string) => state.forms.find((f) => f.id_object === id),
  getProcessById: (id: string) => state.processes.find((p) => p.id_object === id),
  getInstanceById: (id: string) => state.instances.find((i) => i.id_process_instance === id),
  getTaskById: (id: string) => state.tasks.find((t) => t.id_task === id),

  // --- Write ---
  upsertEntity: (entity: Entity) => {
    const idx = state.entities.findIndex((e) => e.id_object === entity.id_object)
    if (idx >= 0) state.entities[idx] = entity
    else state.entities.push(entity)
    saveState(state)
  },
  deleteEntity: (id: string) => {
    state.entities = state.entities.filter((e) => e.id_object !== id)
    state.attributes = state.attributes.filter((a) => a.entity_id !== id)
    saveState(state)
  },
  upsertAttributes: (attrs: Attribute[]) => {
    attrs.forEach((attr) => {
      const idx = state.attributes.findIndex((a) => a.id_attribute === attr.id_attribute)
      if (idx >= 0) state.attributes[idx] = attr
      else state.attributes.push(attr)
    })
    saveState(state)
  },
  deleteAttribute: (id: string) => {
    state.attributes = state.attributes.filter((a) => a.id_attribute !== id)
    saveState(state)
  },
  upsertForm: (form: FormDefinition) => {
    const idx = state.forms.findIndex((f) => f.id_object === form.id_object)
    if (idx >= 0) state.forms[idx] = form
    else state.forms.push(form)
    saveState(state)
  },
  deleteForm: (id: string) => {
    state.forms = state.forms.filter((f) => f.id_object !== id)
    saveState(state)
  },
  upsertProcess: (proc: ProcessDefinition) => {
    const idx = state.processes.findIndex((p) => p.id_object === proc.id_object)
    if (idx >= 0) state.processes[idx] = proc
    else state.processes.push(proc)
    saveState(state)
  },
  upsertNodes: (nodes: ProcessNode[]) => {
    nodes.forEach((node) => {
      const idx = state.nodes.findIndex((n) => n.id_node === node.id_node)
      if (idx >= 0) state.nodes[idx] = node
      else state.nodes.push(node)
    })
    saveState(state)
  },
  deleteNode: (id: string) => {
    state.nodes = state.nodes.filter((n) => n.id_node !== id)
    saveState(state)
  },
  addInstance: (instance: InstanceDetail) => {
    state.instances.push(instance)
    saveState(state)
  },
  updateInstance: (instance: InstanceDetail) => {
    const idx = state.instances.findIndex((i) => i.id_process_instance === instance.id_process_instance)
    if (idx >= 0) state.instances[idx] = instance
    saveState(state)
  },
  addTask: (task: Task) => {
    state.tasks.push(task)
    saveState(state)
  },
  updateTask: (task: Task) => {
    const idx = state.tasks.findIndex((t) => t.id_task === task.id_task)
    if (idx >= 0) state.tasks[idx] = task
    saveState(state)
  },

  // --- Reset ---
  reset: () => {
    state = buildSeedState()
    saveState(state)
  },
}

// Expose reset globally for demos
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>)['resetMocks'] = store.reset
}
