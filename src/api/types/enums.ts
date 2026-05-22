// --- Metadata object types ---
export type ObjectType =
  | 'root_project'
  | 'entity'
  | 'attribute'
  | 'form_definition'
  | 'data_view'
  | 'process_definition'
  | 'node'
  | 'template'

// --- Attribute data types (Metadata Definition §6.3.1) ---
export type DataType =
  | 'uuid'
  | 'string'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'json'

// --- Node types (process canvas) ---
export type NodeType =
  | 'start'
  | 'end'
  | 'human_task'
  | 'script_task'
  | 'exclusive_gateway'

// --- Form field component types ---
export type ComponentType =
  | 'text_input'
  | 'number_input'
  | 'date_picker'
  | 'date_time_picker'
  | 'checkbox'
  | 'select'
  | 'textarea'
  | 'lookup'

// --- Process/instance status ---
export type ProcessStatus = 'draft' | 'configured'
export type InstanceStatus = 'running' | 'completed' | 'failed' | 'cancelled'
export type NodeInstanceStatus = 'active' | 'completed' | 'failed'
export type TaskStatus = 'pending' | 'claimed' | 'completed' | 'cancelled'

// --- Project mode ---
export type ProjectMode = 'greenfield' | 'brownfield'

// --- Relation cardinality ---
export type Cardinality = 'N:1' | '1:N' | '1:1' | 'N:N'

// --- Context variable scope ---
export type VariableScope = 'process' | 'system'

// --- Persist operations ---
export type PersistOperation = 'create' | 'update' | 'delete'
