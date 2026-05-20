import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  Entity,
  Attribute,
  FormDefinition,
  ProcessDefinition,
  ProcessNode,
  InstanceDetail,
  Task,
  PersistRequest,
  PersistResponse,
  StartInstanceRequest,
  StartInstanceResponse,
  ClaimTaskResponse,
  CompleteTaskRequest,
  CompleteTaskResponse,
  TaskListResponse,
  ApiError,
} from '@/api/types'

// ---------------------------------------------------------------------------
// Generic fetcher
// ---------------------------------------------------------------------------

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = (await res.json()) as ApiError
    throw body
  }
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Query keys factory
// ---------------------------------------------------------------------------

export const keys = {
  entities: () => ['entities'] as const,
  entity: (id: string) => ['entity', id] as const,
  entityHydrated: (id: string) => ['entity', id, 'hydrated'] as const,
  attributes: (entityId: string) => ['attributes', entityId] as const,
  forms: () => ['forms'] as const,
  form: (id: string) => ['form', id] as const,
  processes: () => ['processes'] as const,
  process: (id: string) => ['process', id] as const,
  processHydrated: (id: string) => ['process', id, 'hydrated'] as const,
  instance: (id: string) => ['instance', id] as const,
  myTasks: () => ['tasks', 'me'] as const,
  task: (id: string) => ['task', id] as const,
}

// ---------------------------------------------------------------------------
// Read hooks
// ---------------------------------------------------------------------------

export function useEntities() {
  return useQuery({
    queryKey: keys.entities(),
    queryFn: () =>
      apiFetch<{ items: Entity[]; total: number }>(`/api/read?object_type=entity`).then((r) => r.items),
  })
}

export function useEntity(id: string) {
  return useQuery({
    queryKey: keys.entityHydrated(id),
    queryFn: () =>
      apiFetch<{ item: Entity & { attributes: Attribute[] } }>(`/api/read?object_type=entity&id=${id}&hydrate=true`).then((r) => r.item),
    enabled: !!id,
  })
}

export function useAttributes(entityId: string) {
  return useQuery({
    queryKey: keys.attributes(entityId),
    queryFn: () =>
      apiFetch<{ items: Attribute[] }>(`/api/read?object_type=attribute&parent_id=${entityId}`).then((r) => r.items),
    enabled: !!entityId,
  })
}

export function useForms() {
  return useQuery({
    queryKey: keys.forms(),
    queryFn: () =>
      apiFetch<{ items: FormDefinition[] }>(`/api/read?object_type=form_definition`).then((r) => r.items),
  })
}

export function useForm(id: string) {
  return useQuery({
    queryKey: keys.form(id),
    queryFn: () =>
      apiFetch<{ item: FormDefinition }>(`/api/read?object_type=form_definition&id=${id}`).then((r) => r.item),
    enabled: !!id,
  })
}

export function useProcesses() {
  return useQuery({
    queryKey: keys.processes(),
    queryFn: () =>
      apiFetch<{ items: ProcessDefinition[] }>(`/api/read?object_type=process_definition`).then((r) => r.items),
  })
}

export function useProcess(id: string) {
  return useQuery({
    queryKey: keys.processHydrated(id),
    queryFn: () =>
      apiFetch<{ item: ProcessDefinition & { nodes: ProcessNode[] } }>(
        `/api/read?object_type=process_definition&id=${id}&hydrate=true`,
      ).then((r) => r.item),
    enabled: !!id,
  })
}

export function useInstance(id: string, polling = false) {
  return useQuery({
    queryKey: keys.instance(id),
    queryFn: () => apiFetch<InstanceDetail>(`/api/instances/${id}`),
    enabled: !!id,
    refetchInterval: polling ? 15_000 : false,
  })
}

export function useMyTasks(polling = false) {
  return useQuery({
    queryKey: keys.myTasks(),
    queryFn: () => apiFetch<TaskListResponse>(`/api/tasks/me`).then((r) => r.items),
    refetchInterval: polling ? 30_000 : false,
  })
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function usePersist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: PersistRequest) =>
      apiFetch<PersistResponse>('/api/persist', { method: 'POST', body: JSON.stringify(req) }),
    onSuccess: (_data, variables) => {
      // Invalidate affected query keys based on operation types
      const types = new Set(variables.operations.map((o) => o.object_type))
      if (types.has('entity') || types.has('attribute')) {
        void qc.invalidateQueries({ queryKey: keys.entities() })
      }
      if (types.has('form_definition')) {
        void qc.invalidateQueries({ queryKey: keys.forms() })
      }
      if (types.has('process_definition') || types.has('node')) {
        void qc.invalidateQueries({ queryKey: keys.processes() })
      }
    },
  })
}

export function useStartInstance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ processId, body }: { processId: string; body: StartInstanceRequest }) =>
      apiFetch<StartInstanceResponse>(`/api/processes/${processId}/instances`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.myTasks() })
    },
  })
}

export function useClaimTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) =>
      apiFetch<ClaimTaskResponse>(`/api/tasks/${taskId}/claim`, { method: 'POST', body: '{}' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.myTasks() })
    },
  })
}

export function useCompleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, body }: { taskId: string; body: CompleteTaskRequest }) =>
      apiFetch<CompleteTaskResponse>(`/api/tasks/${taskId}/complete`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: keys.myTasks() })
      // Invalidate the specific task's instance if we know it
      void qc.invalidateQueries({ queryKey: ['task', variables.taskId] })
    },
  })
}

// Convenience: get a single task from the tasks list cache
export function useTask(taskId: string) {
  return useQuery({
    queryKey: keys.task(taskId),
    queryFn: async () => {
      // Tasks don't have a dedicated endpoint — find in the my-tasks list
      const res = await apiFetch<TaskListResponse>('/api/tasks/me')
      const task = res.items.find((t: Task) => t.id_task === taskId)
      if (!task) throw new Error('Task not found')
      return task
    },
    enabled: !!taskId,
  })
}
