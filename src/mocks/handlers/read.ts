import { http, HttpResponse } from 'msw'
import { store } from '../store'
import type { ObjectType } from '@/api/types'

export const readHandlers = [
  http.get('/api/read', ({ request }) => {
    const url = new URL(request.url)
    const objectType = url.searchParams.get('object_type') as ObjectType | null
    const id = url.searchParams.get('id')
    const parentId = url.searchParams.get('parent_id')
    const hydrate = url.searchParams.get('hydrate') === 'true'

    if (!objectType) {
      return HttpResponse.json(
        { error: { code: 'bad_request', message: 'object_type is required', details: [], correlation_id: 'mock' } },
        { status: 400 },
      )
    }

    // Single item
    if (id) {
      switch (objectType) {
        case 'entity': {
          const entity = store.getEntityById(id)
          if (!entity) return HttpResponse.json({ error: { code: 'not_found', message: 'Entity not found', details: [], correlation_id: 'mock' } }, { status: 404 })
          if (hydrate) {
            return HttpResponse.json({
              item: {
                ...entity,
                attributes: store.getAttributes(id),
                form_definitions: store.getForms().filter((f) => f.parent === id),
              },
            })
          }
          return HttpResponse.json({ item: entity })
        }
        case 'form_definition': {
          const form = store.getFormById(id)
          if (!form) return HttpResponse.json({ error: { code: 'not_found', message: 'Form not found', details: [], correlation_id: 'mock' } }, { status: 404 })
          return HttpResponse.json({ item: form })
        }
        case 'process_definition': {
          const proc = store.getProcessById(id)
          if (!proc) return HttpResponse.json({ error: { code: 'not_found', message: 'Process not found', details: [], correlation_id: 'mock' } }, { status: 404 })
          if (hydrate) {
            return HttpResponse.json({ item: { ...proc, nodes: store.getNodes(id) } })
          }
          return HttpResponse.json({ item: proc })
        }
        default:
          return HttpResponse.json({ error: { code: 'bad_request', message: `Unsupported object_type: ${objectType}`, details: [], correlation_id: 'mock' } }, { status: 400 })
      }
    }

    // List
    switch (objectType) {
      case 'entity': {
        const entities = parentId
          ? store.getEntities().filter((e) => e.parent === parentId)
          : store.getEntities()
        return HttpResponse.json({ items: entities, total: entities.length })
      }
      case 'attribute': {
        const attrs = store.getAttributes(parentId ?? undefined)
        return HttpResponse.json({ items: attrs, total: attrs.length })
      }
      case 'form_definition': {
        const forms = parentId
          ? store.getForms().filter((f) => f.parent === parentId)
          : store.getForms()
        return HttpResponse.json({ items: forms, total: forms.length })
      }
      case 'process_definition': {
        const procs = store.getProcesses()
        return HttpResponse.json({ items: procs, total: procs.length })
      }
      case 'node': {
        const nodes = store.getNodes(parentId ?? undefined)
        return HttpResponse.json({ items: nodes, total: nodes.length })
      }
      default:
        return HttpResponse.json({ error: { code: 'bad_request', message: `Unsupported object_type: ${objectType}`, details: [], correlation_id: 'mock' } }, { status: 400 })
    }
  }),
]
