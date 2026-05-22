import type { Entity, Attribute } from '@/api/types'

const TYPE_MAP: Record<string, string> = {
  uuid: 'UUID',
  string: 'TEXT',
  integer: 'INTEGER',
  decimal: 'NUMERIC(12,2)',
  boolean: 'BOOLEAN',
  date: 'DATE',
  datetime: 'TIMESTAMPTZ',
  json: 'JSONB',
}

/** Generate a CREATE TABLE DDL preview from entity + attributes */
export function generateDDL(entity: Entity, attributes: Attribute[]): string {
  const tableName = entity.content.source || entity.object_name
  const sorted = [...attributes].sort((a, b) => a.ordinal - b.ordinal)

  const cols = sorted.map((attr) => {
    const sqlType = TYPE_MAP[attr.data_type] ?? 'TEXT'
    const pk = attr.metadata.is_primary_key ? ' PRIMARY KEY DEFAULT gen_random_uuid()' : ''
    const notNull = attr.required && !attr.metadata.is_primary_key ? ' NOT NULL' : ''
    const unique = attr.is_unique && !attr.metadata.is_primary_key ? ' UNIQUE' : ''
    const def = attr.default_value !== null && attr.default_value !== undefined
      ? ` DEFAULT ${JSON.stringify(attr.default_value)}`
      : ''
    return `  ${attr.name} ${sqlType}${pk}${notNull}${unique}${def}`
  })

  // FK constraints
  const fkCols = sorted.filter((a) => a.metadata.is_foreign_key && a.metadata.foreign_key_ref)
  const fkLines = fkCols.map(
    (a) => `  CONSTRAINT fk_${tableName}_${a.name} FOREIGN KEY (${a.name}) REFERENCES ${a.metadata.foreign_key_ref} (id)`,
  )

  const allLines = [...cols, ...fkLines]
  return `CREATE TABLE ${tableName} (\n${allLines.join(',\n')}\n);`
}
