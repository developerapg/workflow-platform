import type { InstanceStatus, NodeInstanceStatus, NodeType, TaskStatus } from './enums'

// ---------------------------------------------------------------------------
// ProcessInstance
// ---------------------------------------------------------------------------

export interface NodeInstanceSummary {
  id_node_instance: string
  node_id: string
  node_name: string
  node_type: NodeType
  entered_at: string
  sequence_number: number
}

export interface ProcessInstance {
  id_process_instance: string
  process_definition_id: string
  process_definition_name: string
  process_version: number
  status: InstanceStatus
  started_at: string
  completed_at: string | null
  error_message: string | null
  current_node_instance: NodeInstanceSummary | null
}

// ---------------------------------------------------------------------------
// NodeInstance  (for instance detail timeline)
// ---------------------------------------------------------------------------

export interface NodeInstance {
  id_node_instance: string
  process_instance_id: string
  node_id: string
  node_name: string
  node_type: NodeType
  status: NodeInstanceStatus
  entered_at: string
  completed_at: string | null
  sequence_number: number
  error_message: string | null
}

// ---------------------------------------------------------------------------
// ContextVariableValue
// ---------------------------------------------------------------------------

export interface ContextVariableValue {
  id: string
  process_instance_id: string
  name: string
  value: string | number | boolean | null
  data_type: string
  set_at: string
}

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

export interface Task {
  id_task: string
  title: string
  status: TaskStatus
  form_definition_id: string
  form_definition_name: string
  process_instance_id: string
  process_definition_name: string
  node_instance_id: string
  created_at: string
  claimed_at: string | null
  completed_at: string | null
  assigned_to: string | null
  assigned_role: string | null
}

// ---------------------------------------------------------------------------
// InstanceDetail  (full response for GET /api/instances/:id)
// ---------------------------------------------------------------------------

export interface InstanceDetail extends ProcessInstance {
  history: NodeInstance[]
  context: ContextVariableValue[]
  active_tasks: Task[]
}
