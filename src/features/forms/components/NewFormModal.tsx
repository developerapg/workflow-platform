import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { usePersist } from '@/api/queries'
import { Button, Modal, Input, Select } from '@/ui'
import type { Entity } from '@/api/types'
import { objectNameSchema } from '@/lib/schemas'

interface Props {
  open: boolean
  onClose: () => void
  entities: Entity[]
}

export function NewFormModal({ open, onClose, entities }: Props) {
  const navigate = useNavigate()
  const persist = usePersist()
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [entityRef, setEntityRef] = useState('')
  const [entityError, setEntityError] = useState('')
  const [formType, setFormType] = useState<'data_entry' | 'approval' | 'list_search'>('data_entry')
  const [description, setDescription] = useState('')

  const entityOptions = entities.map((e) => ({ value: e.id_object, label: e.object_name }))

  const handleClose = () => {
    setName('')
    setNameError('')
    setEntityRef('')
    setEntityError('')
    setFormType('data_entry')
    setDescription('')
    onClose()
  }

  const handleCreate = async () => {
    let valid = true

    const nameResult = objectNameSchema.safeParse(name)
    if (!nameResult.success) {
      setNameError(nameResult.error.errors[0]?.message ?? 'Nombre inválido')
      valid = false
    } else {
      setNameError('')
    }

    if (!entityRef) {
      setEntityError('Selecciona una entidad base')
      valid = false
    } else {
      setEntityError('')
    }

    if (!valid) return

    try {
      const res = await persist.mutateAsync({
        operations: [
          {
            operation: 'create',
            object_type: 'form_definition',
            data: {
              object_name: name,
              parent: entityRef,
              content: {
                description,
                entity_ref: entityRef,
                form_type: formType,
                fields: [],
              },
            },
          },
        ],
      })
      const newId = res.results[0]?.id
      toast.success('Formulario creado')
      handleClose()
      if (newId) navigate(`/forms/${newId}`)
    } catch (err) {
      const e = err as { error?: { message?: string; details?: { message: string }[] } }
      const msg = e?.error?.details?.[0]?.message ?? e?.error?.message ?? 'Error al crear'
      toast.error(msg)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Nuevo formulario"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={() => void handleCreate()} loading={persist.isPending}>
            Crear formulario
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Nombre técnico"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            const r = objectNameSchema.safeParse(e.target.value)
            setNameError(r.success ? '' : (r.error.errors[0]?.message ?? 'Nombre inválido'))
          }}
          error={nameError}
          placeholder="solicitud_form"
          hint="snake_case · identificador único del formulario"
        />

        <Select
          label="Entidad base"
          options={entityOptions}
          value={entityRef}
          onChange={(e) => {
            setEntityRef(e.target.value)
            if (e.target.value) setEntityError('')
          }}
          placeholder="Selecciona una entidad"
          error={entityError}
        />

        <Select
          label="Tipo de formulario"
          options={[
            { value: 'data_entry', label: 'Ingreso de datos' },
            { value: 'approval', label: 'Aprobación' },
            { value: 'list_search', label: 'Búsqueda / listado' },
          ]}
          value={formType}
          onChange={(e) =>
            setFormType(e.target.value as 'data_entry' | 'approval' | 'list_search')
          }
        />

        <Input
          label="Descripción"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe brevemente el propósito del formulario"
        />
      </div>
    </Modal>
  )
}
