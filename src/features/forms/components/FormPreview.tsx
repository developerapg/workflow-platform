import type { FormField, Attribute } from '@/api/types'
import { Input, Textarea, Checkbox } from '@/ui'

interface Props {
  fields: FormField[]
  attributeById: Record<string, Attribute>
}

export function FormPreview({ fields, attributeById }: Props) {
  const visible = fields.filter((f) => !f.hidden)

  if (visible.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border-default)] py-16 text-center">
        <p className="text-body-sm text-[var(--text-muted)]">
          El formulario no tiene campos visibles
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
      <div className="flex flex-col gap-4">
        {visible.map((field) => {
          const attribute = attributeById[field.attribute_ref]
          const isRelated = !!field.x_path

          return (
            <div key={field.id} className={isRelated ? 'rounded-md bg-blue-500/5 p-3' : ''}>
              {field.component === 'checkbox' ? (
                <Checkbox
                  label={field.label}
                  disabled={field.read_only}
                  aria-required={field.required}
                />
              ) : field.component === 'textarea' ? (
                <Textarea
                  label={field.label}
                  placeholder={field.placeholder}
                  {...(field.help_text ? { hint: field.help_text } : {})}
                  disabled={field.read_only}
                  readOnly={field.read_only}
                  aria-required={field.required}
                  rows={3}
                />
              ) : (
                <Input
                  label={field.label}
                  placeholder={field.placeholder}
                  {...(field.help_text ? { hint: field.help_text } : {})}
                  type={
                    field.component === 'number_input'
                      ? 'number'
                      : field.component === 'date_picker'
                        ? 'date'
                        : field.component === 'date_time_picker'
                          ? 'datetime-local'
                          : 'text'
                  }
                  disabled={field.read_only}
                  readOnly={field.read_only}
                  aria-required={field.required}
                />
              )}
              {isRelated && (
                <p className="mt-0.5 text-tiny text-blue-400">
                  Campo relacionado: {field.x_path}
                  {attribute && ` (${attribute.name})`}
                </p>
              )}
            </div>
          )
        })}

        <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
          <button
            disabled
            className="rounded-md bg-[var(--bg-surface-elevated)] px-4 py-2 text-body-sm text-[var(--text-muted)] cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            disabled
            className="rounded-md bg-[var(--action-primary)] px-4 py-2 text-body-sm text-white opacity-60 cursor-not-allowed"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
