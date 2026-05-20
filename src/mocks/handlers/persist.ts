import { http, HttpResponse } from 'msw'
import { store } from '../store'
import type { Entity, Attribute, FormDefinition, ProcessDefinition, ProcessNode } from '@/api/types'
import type { PersistRequest, PersistResultItem } from '@/api/types'

const SNAKE_CASE = /^[a-z][a-z0-9_]{0,62}$/

function uuid() {
  return crypto.randomUUID()
}

function now() {
  return new Date().toISOString()
}

export const persistHandlers = [
  http.post('/api/persist', async ({ request }) => {
    const body = (await request.json()) as PersistRequest
    const results: PersistResultItem[] = []

    // Map temp_ids to real ids for cross-operation references
    const idMap: Record<string, string> = {}

    for (let i = 0; i < body.operations.length; i++) {
      const op = body.operations[i]
      if (!op) continue

      const objectType = op.object_type
      const operation = op.operation
      const data = op.data ?? {}

      // --- Validate name for create/update ---
      if (operation !== 'delete' && 'object_name' in data) {
        const name = data['object_name'] as string
        if (!SNAKE_CASE.test(name)) {
          return HttpResponse.json(
            {
              error: {
                code: 'validation_failed',
                message: `Operation at index ${i} failed validation`,
                details: [{ operation_index: i, field: 'object_name', rule: 'VR-40', message: 'Debe ser snake_case (^[a-z][a-z0-9_]{0,62}$)' }],
                correlation_id: 'mock',
              },
            },
            { status: 422 },
          )
        }
      }

      const realId = op.id ? (idMap[op.id] ?? op.id) : uuid()
      if (op.temp_id) idMap[op.temp_id] = realId

      const ts = now()

      switch (`${objectType}:${operation}`) {
        // --- Entity ---
        case 'entity:create': {
          const entity: Entity = {
            id_object: realId,
            object_name: data['object_name'] as string,
            object_type: 'entity',
            parent: (data['parent'] as string) ?? 'proj-001',
            content: data['content'] as Entity['content'],
            created_at: ts,
            updated_at: ts,
          }
          store.upsertEntity(entity)
          results.push({ temp_id: op.temp_id, operation: 'create', object_type: 'entity', status: 'created', id: realId })
          break
        }
        case 'entity:update': {
          const existing = store.getEntityById(realId)
          if (!existing) return HttpResponse.json({ error: { code: 'not_found', message: 'Entity not found', details: [], correlation_id: 'mock' } }, { status: 404 })
          store.upsertEntity({ ...existing, ...(data as Partial<Entity>), updated_at: ts })
          results.push({ operation: 'update', object_type: 'entity', status: 'updated', id: realId })
          break
        }
        case 'entity:delete':
          store.deleteEntity(realId)
          results.push({ operation: 'delete', object_type: 'entity', status: 'deleted', id: realId })
          break

        // --- Attribute ---
        case 'attribute:create': {
          const attr: Attribute = {
            id_attribute: realId,
            entity_id: idMap[data['entity_id'] as string] ?? (data['entity_id'] as string),
            name: data['name'] as string,
            description: (data['description'] as string) ?? '',
            data_type: data['data_type'] as Attribute['data_type'],
            required: (data['required'] as boolean) ?? false,
            is_unique: (data['is_unique'] as boolean) ?? false,
            is_business_key: (data['is_business_key'] as boolean) ?? false,
            default_value: (data['default_value'] as Attribute['default_value']) ?? null,
            ordinal: (data['ordinal'] as number) ?? 0,
            metadata: (data['metadata'] as Attribute['metadata']) ?? { source: data['name'] as string, is_primary_key: false, is_foreign_key: false, foreign_key_ref: null, constraints: {} },
          }
          store.upsertAttributes([attr])
          results.push({ temp_id: op.temp_id, operation: 'create', object_type: 'attribute', status: 'created', id: realId })
          break
        }
        case 'attribute:update': {
          const attrs = store.getAttributes()
          const existing = attrs.find((a) => a.id_attribute === realId)
          if (!existing) return HttpResponse.json({ error: { code: 'not_found', message: 'Attribute not found', details: [], correlation_id: 'mock' } }, { status: 404 })
          store.upsertAttributes([{ ...existing, ...(data as Partial<Attribute>) }])
          results.push({ operation: 'update', object_type: 'attribute', status: 'updated', id: realId })
          break
        }
        case 'attribute:delete':
          store.deleteAttribute(realId)
          results.push({ operation: 'delete', object_type: 'attribute', status: 'deleted', id: realId })
          break

        // --- FormDefinition ---
        case 'form_definition:create': {
          const form: FormDefinition = {
            id_object: realId,
            object_name: data['object_name'] as string,
            object_type: 'form_definition',
            parent: (data['parent'] as string) ?? '',
            content: data['content'] as FormDefinition['content'],
            created_at: ts,
            updated_at: ts,
          }
          store.upsertForm(form)
          results.push({ temp_id: op.temp_id, operation: 'create', object_type: 'form_definition', status: 'created', id: realId })
          break
        }
        case 'form_definition:update': {
          const existing = store.getFormById(realId)
          if (!existing) return HttpResponse.json({ error: { code: 'not_found', message: 'Form not found', details: [], correlation_id: 'mock' } }, { status: 404 })
          store.upsertForm({ ...existing, ...(data as Partial<FormDefinition>), updated_at: ts })
          results.push({ operation: 'update', object_type: 'form_definition', status: 'updated', id: realId })
          break
        }
        case 'form_definition:delete':
          store.deleteForm(realId)
          results.push({ operation: 'delete', object_type: 'form_definition', status: 'deleted', id: realId })
          break

        // --- ProcessDefinition ---
        case 'process_definition:create': {
          const proc: ProcessDefinition = {
            id_object: realId,
            object_name: data['object_name'] as string,
            object_type: 'process_definition',
            parent: (data['parent'] as string) ?? 'proj-001',
            content: data['content'] as ProcessDefinition['content'],
            created_at: ts,
            updated_at: ts,
          }
          store.upsertProcess(proc)
          results.push({ temp_id: op.temp_id, operation: 'create', object_type: 'process_definition', status: 'created', id: realId })
          break
        }
        case 'process_definition:update': {
          const existing = store.getProcessById(realId)
          if (!existing) return HttpResponse.json({ error: { code: 'not_found', message: 'Process not found', details: [], correlation_id: 'mock' } }, { status: 404 })
          store.upsertProcess({ ...existing, ...(data as Partial<ProcessDefinition>), updated_at: ts })
          results.push({ operation: 'update', object_type: 'process_definition', status: 'updated', id: realId })
          break
        }

        // --- Node ---
        case 'node:create': {
          const node: ProcessNode = {
            id_node: realId,
            process_id: idMap[data['process_id'] as string] ?? (data['process_id'] as string),
            node_type: data['node_type'] as ProcessNode['node_type'],
            name: data['name'] as string,
            description: (data['description'] as string) ?? '',
            position_x: (data['position_x'] as number) ?? 0,
            position_y: (data['position_y'] as number) ?? 0,
            config: data['config'] as ProcessNode['config'],
          }
          store.upsertNodes([node])
          results.push({ temp_id: op.temp_id, operation: 'create', object_type: 'node', status: 'created', id: realId })
          break
        }
        case 'node:update': {
          const nodes = store.getNodes()
          const existing = nodes.find((n) => n.id_node === realId)
          if (!existing) return HttpResponse.json({ error: { code: 'not_found', message: 'Node not found', details: [], correlation_id: 'mock' } }, { status: 404 })
          store.upsertNodes([{ ...existing, ...(data as Partial<ProcessNode>) }])
          results.push({ operation: 'update', object_type: 'node', status: 'updated', id: realId })
          break
        }
        case 'node:delete':
          store.deleteNode(realId)
          results.push({ operation: 'delete', object_type: 'node', status: 'deleted', id: realId })
          break

        default:
          return HttpResponse.json(
            { error: { code: 'bad_request', message: `Unsupported operation: ${objectType}:${operation}`, details: [], correlation_id: 'mock' } },
            { status: 400 },
          )
      }
    }

    return HttpResponse.json({ results })
  }),
]
