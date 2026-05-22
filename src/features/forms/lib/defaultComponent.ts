import type { DataType, ComponentType } from '@/api/types'

export function defaultComponentForType(dataType: DataType): ComponentType {
  switch (dataType) {
    case 'boolean': return 'checkbox'
    case 'date': return 'date_picker'
    case 'datetime': return 'date_time_picker'
    case 'integer':
    case 'decimal': return 'number_input'
    case 'json': return 'textarea'
    default: return 'text_input'
  }
}
