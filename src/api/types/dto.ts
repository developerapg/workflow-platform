import type { ObjectType, PersistOperation } from './enums'
import type { ProcessInstance, Task } from './runtime'

// ---------------------------------------------------------------------------
// Error envelope  (SRS Backend §10)
// ---------------------------------------------------------------------------

export interface ErrorDetail {
  field?: string
  rule?: string
  message: string
  operation_index?: number
}

export interface ApiError {
  error: {
    code: string
    message: string
    details: ErrorDetail[]
    correlation_id: string
  }
}

// ---------------------------------------------------------------------------
// POST /api/persist
// ---------------------------------------------------------------------------

export interface PersistOperationPayload {
  /** Client-side temp id for new objects (correlates response) */
  temp_id?: string
  operation: PersistOperation
  object_type: ObjectType
  /** Required for update/delete */
  id?: string
  data?: Record<string, unknown>
  /** Optimistic lock for updates */
  expected_updated_at?: string
}

export interface PersistResultItem {
  temp_id?: string
  operation: PersistOperation
  object_type: ObjectType
  status: 'created' | 'updated' | 'deleted'
  id: string
}

export interface PersistRequest {
  operations: PersistOperationPayload[]
}

export interface PersistResponse {
  results: PersistResultItem[]
}

// ---------------------------------------------------------------------------
// GET /api/read
// ---------------------------------------------------------------------------

export interface ReadParams {
  object_type: ObjectType
  id?: string
  parent_id?: string
  hydrate?: boolean
}

export interface ReadListResponse<T> {
  items: T[]
  total: number
}

export interface ReadDetailResponse<T> {
  item: T
}

// ---------------------------------------------------------------------------
// POST /api/processes/:id/instances
// ---------------------------------------------------------------------------

export interface StartInstanceRequest {
  initial_context: Record<string, unknown>
  started_by?: string
}

export interface StartInstanceResponse {
  id_process_instance: string
  process_definition_id: string
  process_version: number
  status: 'running'
  started_at: string
  current_node: {
    id_node: string
    node_type: string
    name: string
  }
}

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/claim
// ---------------------------------------------------------------------------

export interface ClaimTaskResponse {
  id_task: string
  status: 'claimed'
  claimed_at: string
  assigned_to: string
}

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/complete
// ---------------------------------------------------------------------------

export interface CompleteTaskRequest {
  submitted_data: Record<string, unknown>
  context_updates?: Record<string, unknown>
}

export interface CompleteTaskResponse {
  id_task: string
  status: 'completed'
  completed_at: string
  process_instance_state: Pick<ProcessInstance, 'status' | 'current_node_instance'>
}

// ---------------------------------------------------------------------------
// GET /api/tasks/me
// ---------------------------------------------------------------------------

export interface TaskListResponse {
  items: Task[]
  total: number
}
