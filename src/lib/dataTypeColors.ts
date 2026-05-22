import type { DataType } from '@/api/types'

// UX Spec §3.5 — type-data-* tokens
export const DATA_TYPE_COLOR: Record<DataType, string> = {
  uuid: 'var(--type-data-uuid)',
  string: 'var(--type-data-string)',
  integer: 'var(--type-data-integer)',
  decimal: 'var(--type-data-decimal)',
  boolean: 'var(--type-data-boolean)',
  date: 'var(--type-data-date)',
  datetime: 'var(--type-data-datetime)',
  json: 'var(--type-data-json)',
}

export const DATA_TYPE_LABEL: Record<DataType, string> = {
  uuid: 'UUID',
  string: 'Texto',
  integer: 'Entero',
  decimal: 'Decimal',
  boolean: 'Booleano',
  date: 'Fecha',
  datetime: 'Fecha/Hora',
  json: 'JSON',
}
