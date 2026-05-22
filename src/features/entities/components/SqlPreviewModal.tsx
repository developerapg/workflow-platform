import { Modal, Button } from '@/ui'
import { generateDDL } from '@/lib/ddl'
import type { Entity, Attribute } from '@/api/types'

interface Props {
  open: boolean
  onClose: () => void
  entity: Entity
  attributes: Attribute[]
}

export function SqlPreviewModal({ open, onClose, entity, attributes }: Props) {
  const sql = generateDDL(entity, attributes)

  const copyToClipboard = () => {
    void navigator.clipboard.writeText(sql)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Vista previa SQL"
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={copyToClipboard}>
            Copiar
          </Button>
          <Button size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </>
      }
    >
      <p className="mb-3 text-body-sm text-[var(--text-secondary)]">
        DDL generado a partir de los atributos definidos. Solo es una vista previa — en el MVP no se ejecuta contra ninguna base de datos.
      </p>
      <pre className="overflow-x-auto rounded-md bg-[var(--bg-canvas)] p-4 font-mono text-body-sm text-[var(--text-primary)]">
        {sql}
      </pre>
    </Modal>
  )
}
