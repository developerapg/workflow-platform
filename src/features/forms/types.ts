import type { FormField, Attribute } from '@/api/types'

/** A FormField with its resolved Attribute (may be undefined if x_path navigates a relation) */
export interface EnrichedField {
  field: FormField
  attribute: Attribute | undefined
}
