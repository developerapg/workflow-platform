import { z } from 'zod'

// VR-40: snake_case, starts with lowercase letter, max 63 chars
export const technicalNameSchema = z
  .string()
  .min(1, 'El nombre es requerido')
  .regex(/^[a-z][a-z0-9_]{0,62}$/, 'Debe ser snake_case (ej: vacation_request)')

// VR-41: SQL reserved words that cannot be used as table/column names
const SQL_RESERVED = new Set([
  'select', 'insert', 'update', 'delete', 'from', 'where', 'table', 'index',
  'create', 'drop', 'alter', 'column', 'order', 'group', 'by', 'having',
  'join', 'left', 'right', 'inner', 'outer', 'on', 'as', 'null', 'true',
  'false', 'not', 'and', 'or', 'in', 'is', 'like', 'between', 'case',
  'when', 'then', 'else', 'end', 'union', 'all', 'distinct', 'limit',
  'offset', 'returning', 'with', 'user', 'value', 'values', 'set',
])

export const objectNameSchema = technicalNameSchema.refine(
  (v) => !SQL_RESERVED.has(v),
  'Este nombre es una palabra reservada de SQL',
)

// Attribute schema (for form validation in EntityDetailPage)
export const attributeSchema = z.object({
  name: technicalNameSchema,
  data_type: z.enum(['uuid', 'string', 'integer', 'decimal', 'boolean', 'date', 'datetime', 'json']),
  required: z.boolean(),
  is_unique: z.boolean(),
  is_business_key: z.boolean(),
  description: z.string(),
  default_value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
})

// Entity schema
export const entitySchema = z.object({
  object_name: objectNameSchema,
  content: z.object({
    description: z.string(),
    source: z.string(),
    is_managed: z.boolean(),
  }),
})

// FormField schema (VR-20: attribute_ref required)
export const formFieldSchema = z.object({
  id: z.string(),
  attribute_ref: z.string().min(1, 'Debes seleccionar un atributo'),
  label: z.string().min(1, 'La etiqueta es requerida'),
  placeholder: z.string(),
  help_text: z.string(),
  required: z.boolean(),
  read_only: z.boolean(),
  hidden: z.boolean(),
  component: z.enum([
    'text_input', 'number_input', 'date_picker', 'date_time_picker',
    'checkbox', 'select', 'textarea', 'lookup',
  ]),
  x_path: z.string().nullable(),
  default_value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
})

// Process node name
export const nodeNameSchema = technicalNameSchema

// Context variable
export const contextVariableSchema = z.object({
  id: z.string(),
  name: technicalNameSchema,
  label: z.string().min(1),
  data_type: z.enum(['uuid', 'string', 'integer', 'decimal', 'boolean', 'date', 'datetime', 'json', 'entity_ref']),
  entity_ref: z.string().nullable(),
  initial_value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  scope: z.enum(['process', 'system']),
})
