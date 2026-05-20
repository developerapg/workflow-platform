import type {
  ObjectType,
  DataType,
  NodeType,
  ComponentType,
  ProcessStatus,
  ProjectMode,
  Cardinality,
  VariableScope,
} from './enums'

// ---------------------------------------------------------------------------
// Shared base
// ---------------------------------------------------------------------------

export interface MetadataBase {
  id_object: string
  object_name: string
  object_type: ObjectType
  parent: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// RootProject
// ---------------------------------------------------------------------------

export interface RootProjectContent {
  description: string
  version: number
  mode: ProjectMode
  tags: string[]
}

export interface RootProject extends MetadataBase {
  object_type: 'root_project'
  parent: null
  content: RootProjectContent
}

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

export interface EntityRelation {
  id: string
  name: string
  related_entity_id: string
  cardinality: Cardinality
  fk_attribute_id: string
}

export interface EntityContent {
  description: string
  source: string
  is_managed: boolean
  relations: EntityRelation[]
}

export interface Entity extends MetadataBase {
  object_type: 'entity'
  content: EntityContent
}

// ---------------------------------------------------------------------------
// Attribute  (rows in wf_meta.attributes — not a MetadataBase)
// ---------------------------------------------------------------------------

export interface AttributeConstraints {
  precision?: number
  scale?: number
  min_length?: number
  max_length?: number
}

export interface AttributeMetadata {
  source: string
  is_primary_key: boolean
  is_foreign_key: boolean
  foreign_key_ref: string | null
  constraints: AttributeConstraints
}

export interface Attribute {
  id_attribute: string
  entity_id: string
  name: string
  description: string
  data_type: DataType
  required: boolean
  is_unique: boolean
  is_business_key: boolean
  default_value: string | number | boolean | null
  ordinal: number
  metadata: AttributeMetadata
}

// ---------------------------------------------------------------------------
// FormDefinition
// ---------------------------------------------------------------------------

export interface FieldValidation {
  type: 'min' | 'max' | 'min_length' | 'max_length' | 'pattern' | 'required'
  value: string | number | boolean
  message?: string
}

export interface FormField {
  id: string
  attribute_ref: string
  label: string
  placeholder: string
  help_text: string
  required: boolean
  read_only: boolean
  hidden: boolean
  component: ComponentType
  validations: FieldValidation[]
  /** Dot-notation path for navigating relations: e.g. "employee.full_name" */
  x_path: string | null
  default_value: string | number | boolean | null
}

export interface FormDefinitionContent {
  description: string
  entity_ref: string
  form_type: 'data_entry' | 'approval' | 'list_search'
  fields: FormField[]
}

export interface FormDefinition extends MetadataBase {
  object_type: 'form_definition'
  content: FormDefinitionContent
}

// ---------------------------------------------------------------------------
// ProcessDefinition
// ---------------------------------------------------------------------------

export interface ContextVariable {
  id: string
  name: string
  label: string
  data_type: DataType | 'entity_ref'
  entity_ref: string | null
  initial_value: string | number | boolean | null
  scope: VariableScope
}

export interface Transition {
  id: string
  from_node_id: string
  to_node_id: string
  condition: string | null
  label: string
}

export interface CanvasMetadata {
  zoom: number
  pan_x: number
  pan_y: number
}

export interface ProcessDefinitionContent {
  description: string
  version: number
  status: ProcessStatus
  context_variables: ContextVariable[]
  transitions: Transition[]
  metadata_canvas: CanvasMetadata
}

export interface ProcessDefinition extends MetadataBase {
  object_type: 'process_definition'
  content: ProcessDefinitionContent
}

// ---------------------------------------------------------------------------
// Node  (rows in wf_meta.nodes)
// ---------------------------------------------------------------------------

interface NodeConfigBase {
  [key: string]: unknown
}

export interface StartNodeConfig extends NodeConfigBase {
  _type: 'start'
}

export interface EndNodeConfig extends NodeConfigBase {
  _type: 'end'
  result_label: string
}

export interface HumanTaskNodeConfig extends NodeConfigBase {
  _type: 'human_task'
  form_ref: string
  assignment: {
    type: 'role' | 'user' | 'variable'
    value: string
  }
  due_in: string | null
}

export interface ScriptTaskNodeConfig extends NodeConfigBase {
  _type: 'script_task'
  language: 'javascript'
  source: string
}

export interface GatewayNodeConfig extends NodeConfigBase {
  _type: 'exclusive_gateway'
  default_transition_id: string | null
}

export type NodeConfig =
  | StartNodeConfig
  | EndNodeConfig
  | HumanTaskNodeConfig
  | ScriptTaskNodeConfig
  | GatewayNodeConfig

export interface ProcessNode {
  id_node: string
  process_id: string
  node_type: NodeType
  name: string
  description: string
  position_x: number
  position_y: number
  config: NodeConfig
}
