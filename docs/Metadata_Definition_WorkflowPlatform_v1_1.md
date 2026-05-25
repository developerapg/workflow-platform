# DEFINICIÓN DE METADATA

**Workflow Platform**

*Metamodelo canónico del proyecto: artefactos, firmas JSON, persistencia y reglas de integridad*

Mayo 2026 · v1.1 · Confidencial — Documento interno

---

# 1. Introducción

## 1.1 Propósito

Este documento es la **definición canónica del metamodelo de un proyecto** de Workflow Platform. Especifica qué artefactos existen, cómo se identifican, dónde y cómo se persisten, qué propiedades JSON contienen, cómo se relacionan entre sí y qué reglas de integridad debe respetar el sistema antes de almacenarlos.

Es un documento **referencial**, no narrativo. Está pensado para consultarse con `Cmd+F`: un desarrollador que necesita la firma exacta de `ProcessDefinition`, la regla de validación que prohíbe transiciones huérfanas, o el catálogo completo de `ObjectType`, debe encontrar la respuesta canónica en menos de un minuto y sin ambigüedad.

Toda decisión de implementación —tanto del frontend como del backend— que toque el metamodelo debe consistirse con este documento. Si surge una contradicción entre este documento y cualquier SRS, este documento es la fuente de verdad para la estructura de datos; los SRS son la fuente de verdad para el comportamiento del sistema.

## 1.2 Audiencia

- **Equipo de Backend**: lo usa como contrato de schema de base de datos y de validación JSON Schema antes de persistir.
- **Equipo de Frontend**: lo usa como contrato de los objetos que recibe del API y que renderiza en los editores.
- **Creador del producto**: lo usa como referencia maestra cuando aparece una pregunta de diseño que toca la forma de un artefacto.
- **Futuros documentos** (SRS de Backend, SRS de Frontend, Modelo de Datos físico): lo referencian normativamente.

## 1.3 Documentos de referencia

| Documento | Versión | Propiedad sobre |
| --- | --- | --- |
| Workflow Platform — Documento de Visión | 1.0 | Visión de negocio, alcance estratégico del MVP, multi-tenancy por base de datos, criterios de éxito. |
| Workflow Platform — UX Spec | 1.0 | Patrones de interacción, navegación, layouts, nomenclatura UI. |
| Metadata Framework Tool — Framework Conceptual | 1.1 | Antecedente del metamodelo (MVP previo). Algunas decisiones se heredan; otras se rediseñan. Este documento las consolida y reemplaza para Workflow Platform. |

## 1.4 Convenciones del documento

- **Artefacto** designa cada tipo de elemento del metamodelo (Entity, ProcessDefinition, Node, etc.).
- **Firma JSON** designa el esquema esperado del payload de un artefacto.
- **Inline** indica que un elemento vive como sub-objeto JSON dentro del `Content` de su padre.
- **Tabla dedicada** indica que un elemento vive como fila en una tabla SQL propia.
- Los identificadores técnicos (`object_type`, `process_definition`, `context_variable`) se escriben en `snake_case`.
- Las reglas de validación se numeran `VR-N` y son referenciables desde otros documentos.

---

# 2. Alcance del documento

## 2.1 Incluido en v1.0

- Catálogo de artefactos del metamodelo del proyecto: `root_project`, `entity`, `attribute`, `form_definition`, `process_definition`, `node`, `template`.
- Firmas JSON canónicas de cada artefacto y sus sub-objetos inline (`form_field`, `transition`, `context_variable`).
- Estrategia de persistencia: una sola tabla `metadata` para artefactos de diseño no masivos, tablas dedicadas para `attributes` y `nodes`.
- Jerarquía padre/hijo y referencias cruzadas entre artefactos.
- Reglas de integridad referencial y de validación cruzada (numeradas `VR-N`).
- Catálogo de `object_type` en formato string.
- Decisiones de hidratación API.

## 2.2 Fuera de alcance (diferido)

- **Capa de runtime de procesos**: `process_instance`, `node_instance`, `context_variable_value`. Diferida al documento de Definición de Metadata v1.1, cuando se diseñe el motor de ejecución.
- **Catálogo de admin** (BD central): `customer`, `project`, `user`, `session`, `connection`, biblioteca compartida de `template`. Documento separado o v1.1.
- **Reglas y eventos** (`rule`, `event`): reservados para iteraciones futuras.
- **Versionado y auditoría** de cambios sobre artefactos: reservado.
- **API REST de navegación**: se define conceptualmente en §10 pero el detalle de endpoints vive en el SRS de Backend.
- **Físico de la BD del negocio** (tablas que los `entity` representan): es la BD del proyecto en modo greenfield/brownfield, no es metadata. La metadata describe esas tablas pero no las define en este documento.

---

# 3. Principios del metamodelo

Cinco principios rigen todas las decisiones de este documento. Cualquier extensión futura debe poder justificarse contra ellos.

**P1 — Metadata como única fuente de verdad.** Todo lo que el sistema sabe sobre un proceso, un formulario o el modelo de datos está representado en metadata estructurada. El motor de ejecución (futuro) y la UI no contienen lógica de negocio hardcodeada: ejecutan lo que la metadata describe.

**P2 — Schema único del proyecto.** Cada proyecto vive en una base de datos PostgreSQL aislada. Dentro de esa base hay un único schema operativo. No hay schemas separados para diseño y runtime ni para distintas categorías de artefactos. La separación lógica se logra con tablas, no con schemas.

**P3 — Tabla dedicada cuando es masivo u operable individualmente; inline cuando se consume en contexto.** La decisión entre dedicar una tabla o anidar como JSON se rige por esta regla, no por elegancia teórica. Un atributo de entidad puede ser uno entre miles en un proyecto y se edita/consulta solo: tabla dedicada. Una transición de proceso vive y muere con su `ProcessDefinition` y solo se opera dentro del editor del proceso: inline.

**P4 — Identidad estable, contenido evolucionable.** Cada artefacto tiene un `IdObject` UUID inmutable que sobrevive a renombres, cambios de schema interno y reorganizaciones. Las referencias entre artefactos son por `IdObject`, nunca por nombre.

**P5 — Hidratación en el borde.** El frontend nunca ve referencias crudas a IDs cuando carga un árbol; el backend resuelve la hidratación antes de responder. Los IDs son detalle interno de persistencia. Esto desacopla la decisión de "tabla dedicada vs. inline" de la experiencia del consumidor del API.

---

# 4. Arquitectura de persistencia

## 4.1 Schema del proyecto

Cada proyecto reside en una base de datos PostgreSQL dedicada (multi-tenancy por BD; ver Visión §7). Dentro de esa BD, un único schema operativo contiene todas las tablas del metamodelo. El nombre por defecto del schema es `wf_meta` (puede sobreescribirse en configuración de proyecto).

Las tablas del metamodelo son:

| Tabla | Propósito | Tipo |
| --- | --- | --- |
| `metadata` | Artefactos de diseño no masivos. | Tabla genérica con `Content` JSONB. |
| `attributes` | Atributos de entidades. | Tabla dedicada con columnas tipadas. |
| `nodes` | Nodos de procesos. | Tabla dedicada con columnas tipadas. |

Las tablas del negocio (las que los `entity` representan físicamente) residen en otro schema del mismo proyecto (típicamente `public` o `business`). No son parte del metamodelo y no se documentan aquí.

## 4.2 Tabla `metadata` (artefactos de diseño)

Todos los artefactos no masivos del proyecto residen en una tabla genérica única. Este patrón permite navegar la jerarquía con consultas uniformes y extender el modelo con nuevos `object_type` sin alterar el esquema físico.

| Columna | Tipo | Nullable | Descripción |
| --- | --- | --- | --- |
| `id_object` | UUID | NO | Identificador único global del artefacto. Generado en creación. PK. |
| `object_name` | VARCHAR(255) | NO | Nombre técnico del artefacto en `snake_case`. Único dentro del scope del padre. |
| `object_type` | VARCHAR(64) | NO | Discriminante del tipo. Valor del catálogo §5. |
| `content` | JSONB | NO | Payload con las propiedades específicas del artefacto. Schema validado contra §6. |
| `parent` | UUID | SÍ | `id_object` del artefacto padre. NULL únicamente en `root_project`. FK auto-referencial. |
| `created_at` | TIMESTAMP | NO | Auditoría mínima. |
| `updated_at` | TIMESTAMP | NO | Auditoría mínima. |

**Tipos de artefacto que residen en `metadata`:** `root_project`, `entity`, `form_definition`, `process_definition`, `template`.

**Restricciones:**

- PK: `id_object`.
- FK `parent` → `metadata.id_object` con `ON DELETE RESTRICT`.
- CHECK sobre `object_type` para limitarlo al catálogo §5.
- UNIQUE compuesto: `(parent, object_name, object_type)` — dos hermanos del mismo tipo no pueden tener el mismo nombre.
- Índice: `(object_type)`, `(parent)`, `(object_type, parent)`.

## 4.3 Tabla `attributes`

Tabla dedicada por volumen previsible y operación individual frecuente. Un atributo se edita uno a uno en el diseñador de entidades, se referencia desde `form_field` por `id`, y un proyecto típico puede tener cientos.

| Columna | Tipo | Nullable | Descripción |
| --- | --- | --- | --- |
| `id_attribute` | UUID | NO | PK. |
| `entity_id` | UUID | NO | FK a `metadata.id_object` (donde `object_type = 'entity'`). |
| `name` | VARCHAR(128) | NO | Nombre técnico en `snake_case`. Único dentro de la entidad. |
| `description` | TEXT | SÍ | Descripción de negocio. |
| `data_type` | VARCHAR(32) | NO | Tipo lógico (ver §6.3.1). |
| `required` | BOOLEAN | NO | Si es obligatorio. Default false. |
| `unique` | BOOLEAN | NO | Si debe ser único. Default false. |
| `default_value` | JSONB | SÍ | Valor por defecto, tipado según `data_type`. |
| `is_business_key` | BOOLEAN | NO | Si es llave de negocio. Default false. |
| `metadata` | JSONB | NO | Propiedades técnicas/físicas (ver §6.3). |
| `created_at` | TIMESTAMP | NO | Auditoría. |
| `updated_at` | TIMESTAMP | NO | Auditoría. |

**Restricciones:**

- FK `entity_id` → `metadata.id_object` con `ON DELETE RESTRICT`.
- UNIQUE compuesto: `(entity_id, name)`.
- Índice: `(entity_id)`.

**Nota sobre la doble cara del registro:** las propiedades de negocio (`description`, `data_type`, `required`, `unique`, `default_value`, `is_business_key`) viven como columnas tipadas. Las propiedades técnico-físicas (mapeo a tabla/columna física, FK, constraints) viven dentro del JSONB `metadata`. Esto separa lo que el usuario edita en UI de negocio de lo que solo importa al adapter de BD.

## 4.4 Tabla `nodes`

Tabla dedicada por las mismas razones que `attributes`: un proceso típico tiene 5–30 nodos, se editan individualmente en el canvas, y el frontend los consulta uno a uno al hacer drag o seleccionar.

| Columna | Tipo | Nullable | Descripción |
| --- | --- | --- | --- |
| `id_node` | UUID | NO | PK. |
| `process_id` | UUID | NO | FK a `metadata.id_object` (donde `object_type = 'process_definition'`). |
| `node_type` | VARCHAR(32) | NO | Tipo del nodo: `start`, `end`, `human_task`, `script_task`, `exclusive_gateway`. |
| `name` | VARCHAR(128) | NO | Nombre técnico del nodo (snake_case, VR-40). Único dentro del proceso. |
| `display_name` | VARCHAR(255) | SÍ | Nombre legible mostrado en el canvas. Si es `NULL`, el UI lo deriva de `name`. |
| `position_x` | NUMERIC | NO | Coordenada X en el canvas. |
| `position_y` | NUMERIC | NO | Coordenada Y en el canvas. |
| `width` | NUMERIC | SÍ | Override manual del ancho del nodo (UI). Si es `NULL`, el nodo se autoajusta. |
| `height` | NUMERIC | SÍ | Override manual del alto del nodo (UI). Si es `NULL`, el nodo se autoajusta. |
| `config` | JSONB | NO | Configuración específica del tipo de nodo (ver §6.7). |
| `created_at` | TIMESTAMP | NO | Auditoría. |
| `updated_at` | TIMESTAMP | NO | Auditoría. |

**Restricciones:**

- FK `process_id` → `metadata.id_object` con `ON DELETE CASCADE` (un proceso eliminado arrastra sus nodos).
- UNIQUE compuesto: `(process_id, name)`.
- CHECK sobre `node_type` para limitarlo al catálogo §6.7.1.
- Índice: `(process_id)`.

## 4.5 Regla de decisión: inline vs. tabla dedicada

Para decidir dónde vive un elemento del metamodelo se aplica esta tabla. Se incluye explícitamente para futuras extensiones del metamodelo.

| Criterio | Tabla dedicada | Inline en JSON del padre |
| --- | --- | --- |
| Volumen esperado por proyecto | Alto (cientos+) | Bajo (decenas) |
| Operación individual frecuente | Sí | No |
| Consultable/filtrable directamente | Sí | No |
| Vida acoplada al padre | Independiente | Total |
| Performance crítica en lectura masiva | Sí | No |

**Aplicación a v1.0:**

| Elemento | Decisión | Justificación |
| --- | --- | --- |
| `attribute` | Tabla dedicada | Volumen alto, operación individual. |
| `node` | Tabla dedicada | Operación individual en canvas. |
| `form_field` | Inline en `form_definition.content.fields[]` | Volumen bajo, vida acoplada al form. |
| `transition` | Inline en `process_definition.content.transitions[]` | Solo se opera en contexto del proceso. |
| `context_variable` | Inline en `process_definition.content.context_variables[]` | Pocas por proceso, vida acoplada. |
| `process_instance`, `node_instance` | Tablas dedicadas (futuro) | Masivo en runtime. Fuera de v1.0. |

---

# 5. Catálogo de `object_type`

El campo `object_type` discrimina el tipo de artefacto en la tabla `metadata` y determina el JSON Schema esperado en `content`. Se usa formato string para legibilidad en queries directos y en logs.

| `object_type` | Descripción | `parent` esperado | Persistencia |
| --- | --- | --- | --- |
| `root_project` | Nodo raíz del proyecto. Único por BD. | NULL | `metadata` |
| `entity` | Entidad del modelo de datos (mapea a una tabla física). | `root_project` | `metadata` (+ `attributes` dedicada) |
| `form_definition` | Formulario asociado a una entidad. | `entity` | `metadata` (con `form_field` inline) |
| `data_view` | Vista de listado read-only sobre una entidad. **Firma definida, implementación diferida (ver pendientes.md P-001).** | `entity` | `metadata` (con `column` inline) |
| `process_definition` | Definición de un workflow. | `root_project` | `metadata` (+ `nodes` dedicada, con `transition` y `context_variable` inline) |
| `template` | Plantilla reutilizable de proceso/form/conjunto. **Reservado v1.0.** | `root_project` | `metadata` |

**Reservados para iteraciones futuras (no implementados en v1.0):**

| `object_type` | Descripción prevista |
| --- | --- |
| `rule` | Regla de negocio reutilizable. |
| `event` | Evento del ciclo de vida del proceso. |

> **Nota sobre `attribute`, `node`, `form_field`, `transition`, `context_variable`:** estos elementos **no son `object_type`** porque no residen en la tabla `metadata`. Tienen sus propias firmas JSON pero su identidad y persistencia se manejan en su tabla dedicada o como sub-objeto del padre.

---

# 6. Firmas JSON de artefactos

Esta sección define la forma canónica del campo `content` de cada artefacto residente en `metadata`, y de los sub-objetos inline y de los registros de las tablas dedicadas.

**Convención de notación:**

- `"string"` indica que el valor es una cadena.
- `"integer"`, `"number"`, `"boolean"` indican tipos primitivos.
- `"array<T>"` indica un arreglo del tipo `T`.
- `"any"` indica que el tipo depende de otro campo y se valida cruzadamente.
- Los campos terminados con `_id` son siempre UUID y referencian otra entidad por su clave primaria.

## 6.1 `root_project`

Nodo raíz del proyecto. Existe exactamente uno por BD. Su `parent` es NULL.

### Firma JSON

```json
{
  "description": "string  — Descripción del proyecto de negocio",
  "version":     "integer — Versión del esquema de metadata (inicia en 1)",
  "mode":        "string  — Modo del proyecto: 'greenfield' | 'brownfield'",
  "tags":        "array<string> — Etiquetas de clasificación, opcional"
}
```

### Ejemplo

```json
{
  "description": "Plataforma de gestión de solicitudes de vacaciones",
  "version": 1,
  "mode": "greenfield",
  "tags": ["rrhh", "interno"]
}
```

| Campo | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `description` | string | NO | Descripción legible del proyecto. |
| `version` | integer | SÍ | Versión del esquema de metadata. |
| `mode` | string | SÍ | `greenfield` (modelo creado desde cero) o `brownfield` (modelo ingerido). |
| `tags` | array<string> | NO | Etiquetas administrativas. |

## 6.2 `entity`

Representa una entidad del modelo de datos. Su `parent` es siempre `root_project`. La lista de atributos **no vive en el `content`**: vive en la tabla `attributes`. El `content` declara solo las propiedades de negocio de la entidad y sus relaciones lógicas.

### Firma JSON

```json
{
  "description":   "string  — Descripción de negocio de la entidad",
  "source":        "string  — Nombre de la tabla física asociada (snake_case)",
  "is_managed":    "boolean — Si la tabla física la administra la plataforma (greenfield)",
  "relations":     "array<Relation> — Relaciones lógicas con otras entidades"
}
```

### Sub-objeto `Relation`

```json
{
  "id":                "string — Identificador libre de la relación, único dentro de la entidad",
  "name":              "string — Nombre legible de la relación",
  "related_entity_id": "uuid   — id_object de la entidad relacionada",
  "cardinality":       "string — '1:1' | '1:N' | 'N:1' | 'N:N'",
  "fk_attribute_id":   "uuid   — id_attribute del atributo FK que soporta físicamente la relación (en esta entidad para N:1 y 1:1, en la opuesta para 1:N)"
}
```

### Ejemplo

```json
{
  "description": "Solicitud de vacaciones de un colaborador",
  "source": "vacation_request",
  "is_managed": true,
  "relations": [
    {
      "id": "rel_employee",
      "name": "solicitante",
      "related_entity_id": "8c3b1d2e-...-...",
      "cardinality": "N:1",
      "fk_attribute_id": "f17a9b4c-...-..."
    }
  ]
}
```

| Campo | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `description` | string | NO | Descripción de negocio. |
| `source` | string | SÍ | Nombre de la tabla física. |
| `is_managed` | boolean | SÍ | True en greenfield (la plataforma creó/administra la tabla). False en brownfield. |
| `relations` | array<Relation> | SÍ (puede ser `[]`) | Relaciones de negocio con otras entidades. |

## 6.3 `attribute` (registro en tabla `attributes`)

Representa un campo de una entidad. Vive como fila en la tabla `attributes`, no como artefacto en `metadata`. Su `entity_id` lo asocia a su entidad padre.

La separación negocio/técnico se materializa así:

- **Columnas tipadas** (`name`, `description`, `data_type`, `required`, `unique`, `default_value`, `is_business_key`) → propiedades de negocio, editadas por el diseñador de modelo.
- **`metadata` JSONB** → propiedades técnico-físicas, gestionadas por el adapter de BD.

### Estructura del JSONB `metadata`

```json
{
  "source":          "string  — Nombre de la columna física",
  "is_primary_key":  "boolean — Si participa en la PK técnica",
  "is_foreign_key":  "boolean — Si la columna es FK física",
  "foreign_key_ref": "string  — id de la Relation que esta FK soporta, si aplica",
  "constraints":     "object  — Constraints físicos adicionales (nullable, length, precision, etc.)"
}
```

### 6.3.1 Catálogo de `data_type`

| `data_type` | Descripción | Equivalente SQL recomendado |
| --- | --- | --- |
| `string` | Texto de longitud variable. | VARCHAR / TEXT |
| `integer` | Entero. | INTEGER / BIGINT |
| `decimal` | Decimal con precisión y escala. | NUMERIC |
| `boolean` | Booleano. | BOOLEAN |
| `date` | Fecha sin hora. | DATE |
| `datetime` | Fecha y hora. | TIMESTAMP |
| `uuid` | UUID. | UUID |
| `json` | JSON estructurado. | JSONB |

### Ejemplo

```json
// Fila en tabla `attributes`
{
  "id_attribute": "f17a9b4c-...-...",
  "entity_id": "8c3b1d2e-...-...",
  "name": "total_amount",
  "description": "Monto total de la solicitud en USD",
  "data_type": "decimal",
  "required": true,
  "unique": false,
  "default_value": 0,
  "is_business_key": false,
  "metadata": {
    "source": "total_amount",
    "is_primary_key": false,
    "is_foreign_key": false,
    "foreign_key_ref": null,
    "constraints": { "precision": 12, "scale": 2 }
  }
}
```

## 6.4 `form_definition`

Representa un formulario asociado a una entidad. Su `parent` es siempre una `entity`. Los campos del formulario viven **inline** en `content.fields[]`.

El form no se tipifica por modo de operación (no hay `crud` vs `list_search` vs `read_only`). El comportamiento del form en ejecución se infiere del contexto: si el contexto trae un registro con datos, los campos se muestran prellenados; si viene vacío, se diligencian. La decisión de listar registros y la de capturar/editar un registro son responsabilidades de artefactos distintos (`data_view` para listar, `form_definition` para capturar/editar).

### Firma JSON

```json
{
  "description":   "string  — Descripción del formulario",
  "entity_ref":    "uuid    — id_object de la entidad base (redundante con parent por conveniencia)",
  "fields":        "array<FormField> — Campos del formulario (inline)"
}
```

### Sub-objeto `FormField` (inline)

```json
{
  "id":            "string  — Identificador libre del field, único dentro del form",
  "attribute_ref": "uuid    — id_attribute referenciado",
  "label":         "string  — Etiqueta visible (default: name del atributo)",
  "placeholder":   "string  — Placeholder, opcional",
  "help_text":     "string  — Texto de ayuda, opcional",
  "required":      "boolean — Override del required del atributo, opcional",
  "component":     "string  — Componente UI del ComponentRegistry",
  "validations":   "array<object> — Validaciones adicionales declarativas",
  "x_path":        "string  — Navegación entre relaciones (reservado, sin semántica en MVP)"
}
```

### Ejemplo

```json
// content de un form_definition
{
  "description": "Formulario de captura de solicitud de vacaciones",
  "entity_ref": "8c3b1d2e-...-...",
  "fields": [
    {
      "id": "fld_employee",
      "attribute_ref": "a1b2c3d4-...-...",
      "label": "Solicitante",
      "component": "lookup",
      "required": true,
      "validations": []
    },
    {
      "id": "fld_days",
      "attribute_ref": "e5f6a7b8-...-...",
      "label": "Días solicitados",
      "component": "number_input",
      "required": true,
      "validations": [{ "type": "min", "value": 1 }, { "type": "max", "value": 30 }]
    }
  ]
}
```

| Campo | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `description` | string | NO | Descripción de negocio. |
| `entity_ref` | uuid | SÍ | Debe coincidir con `parent`. Redundante por conveniencia en consumo de API. |
| `fields` | array<FormField> | SÍ | Al menos un field en un form. |

> **Nota sobre `x_path`:** el mecanismo de navegación entre relaciones se denomina `xPath` y se expresa en dot notation. Cada segmento debe corresponder a un `Relation.name` válido en la entidad activa de la navegación, excepto el último, que debe corresponder a un `attribute.name`. El backend resuelve el `xPath` contra el modelo en tiempo de validación (estructural) y en tiempo de ejecución (resolviendo joins). Este mismo mecanismo se usa en `data_view.columns[].x_path` (§6.5).

## 6.5 `data_view`

Representa una vista de listado **read-only** sobre una entidad. Su `parent` es siempre una `entity`. Permite visualizar conjuntos de registros con columnas configurables (incluyendo columnas que navegan relaciones vía `xPath`), ordenamiento por defecto y paginación.

> **Estado:** la firma JSON es normativa en v1.0, pero la **implementación de UI y runtime se difiere** al post-MVP (ver `pendientes.md` P-001). El backend valida la firma cuando se persiste; el módulo de Vistas no se construye en el MVP de UI. Esta separación permite cerrar el contrato sin retrabajos cuando se retome.

### Firma JSON

```json
{
  "description":  "string  — Descripción de la vista",
  "entity_ref":   "uuid    — id_object de la entidad base (redundante con parent)",
  "columns":      "array<Column> — Columnas a mostrar, en orden",
  "default_sort": "object  — { column_id, direction: 'asc'|'desc' }, opcional",
  "page_size":    "integer — Tamaño de página, default 25, rango 10-200"
}
```

### Sub-objeto `Column` (inline)

```json
{
  "id":            "string  — Identificador libre de la columna, único dentro de la vista",
  "label":         "string  — Encabezado visible de la columna",
  "attribute_ref": "uuid    — id_attribute referenciado",
  "x_path":        "string  — Ruta de relaciones para llegar al atributo, en dot notation. Opcional. Ej: 'employee.full_name'",
  "sortable":      "boolean — Si se puede ordenar por esta columna, default true",
  "width":         "string  — Ancho sugerido ('auto', '120px', '20%'), opcional"
}
```

### Ejemplo

```json
// content de un data_view
{
  "description": "Listado de solicitudes de vacaciones con datos del empleado",
  "entity_ref": "8c3b1d2e-...-...",
  "columns": [
    {
      "id": "col_request_id",
      "label": "N° solicitud",
      "attribute_ref": "a0...-...",
      "sortable": true,
      "width": "100px"
    },
    {
      "id": "col_employee_name",
      "label": "Empleado",
      "attribute_ref": "b1...-...",
      "x_path": "employee.full_name",
      "sortable": true
    },
    {
      "id": "col_days",
      "label": "Días",
      "attribute_ref": "c2...-...",
      "sortable": true,
      "width": "80px"
    },
    {
      "id": "col_status",
      "label": "Estado",
      "attribute_ref": "d3...-...",
      "sortable": true
    }
  ],
  "default_sort": { "column_id": "col_request_id", "direction": "desc" },
  "page_size": 25
}
```

| Campo | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `description` | string | NO | Descripción de la vista. |
| `entity_ref` | uuid | SÍ | Debe coincidir con `parent`. |
| `columns` | array<Column> | SÍ | Al menos una columna. |
| `default_sort` | object | NO | Si está presente, `column_id` debe corresponder a una columna existente y `sortable: true`. |
| `page_size` | integer | NO | Default 25. Rango 10–200. |

> **Sin filtros y sin acciones de fila en v1.0.** La vista es estrictamente read-only. Los filtros para el usuario final y las acciones de fila (editar, abrir caso, eliminar) no forman parte de la firma de `data_view` en esta versión; si surge la necesidad real, se introducirán como extensión documentada.

## 6.6 `process_definition`

Representa un workflow. Su `parent` es siempre `root_project`. Los **nodos viven en tabla dedicada** (`nodes`); las **transiciones y variables de contexto viven inline** en `content`.

### Firma JSON

```json
{
  "description":         "string  — Descripción del proceso",
  "version":             "integer — Versión del proceso (inicia en 1)",
  "status":              "string  — 'draft' | 'configured'",
  "context_variables":   "array<ContextVariable> — Variables del contexto del proceso (inline)",
  "transitions":         "array<Transition> — Aristas del grafo (inline)",
  "metadata_canvas":     "object  — Estado del canvas (zoom, pan, etc.), opcional"
}
```

### Sub-objeto `ContextVariable` (inline)

```json
{
  "id":            "string  — Identificador libre, único dentro del proceso",
  "name":          "string  — Nombre técnico de la variable en snake_case",
  "label":         "string  — Nombre legible",
  "data_type":     "string  — Tipo lógico (mismo catálogo §6.3.1) | 'entity_ref'",
  "entity_ref":    "uuid    — id_object de la entidad, solo si data_type='entity_ref'",
  "initial_value": "any     — Valor inicial, opcional",
  "scope":         "string  — 'process' (default) | 'system'"
}
```

### Sub-objeto `Transition` (inline)

```json
{
  "id":             "string  — Identificador libre, único dentro del proceso",
  "from_node_id":   "uuid    — id_node origen",
  "to_node_id":     "uuid    — id_node destino",
  "condition":      "string  — Expresión booleana sobre el contexto, opcional",
  "label":          "string  — Etiqueta visible sobre la flecha, opcional",
  "source_side":    "enum    — 'top' | 'right' | 'bottom' | 'left' — lado del nodo origen del que sale la arista (UI), opcional",
  "target_side":    "enum    — 'top' | 'right' | 'bottom' | 'left' — lado del nodo destino al que entra la arista (UI), opcional"
}
```

> Los campos `source_side` y `target_side` son metadatos puramente visuales utilizados por el designer para preservar la disposición exacta de las aristas. Si están ausentes, el front-end los infiere a partir de las posiciones relativas de los nodos. El motor de ejecución los ignora.

### Ejemplo

```json
// content de un process_definition
{
  "description": "Aprobación de solicitudes de vacaciones",
  "version": 1,
  "status": "draft",
  "context_variables": [
    {
      "id": "var_request",
      "name": "request",
      "label": "Solicitud",
      "data_type": "entity_ref",
      "entity_ref": "8c3b1d2e-...-...",
      "scope": "process"
    },
    {
      "id": "var_approved",
      "name": "approved",
      "label": "Aprobada",
      "data_type": "boolean",
      "initial_value": false,
      "scope": "process"
    }
  ],
  "transitions": [
    {
      "id": "t1",
      "from_node_id": "n_start",
      "to_node_id": "n_capture",
      "label": "Inicio"
    },
    {
      "id": "t2",
      "from_node_id": "n_decision",
      "to_node_id": "n_end_approved",
      "condition": "context.approved == true",
      "label": "Sí"
    }
  ],
  "metadata_canvas": { "zoom": 1.0, "pan_x": 0, "pan_y": 0 }
}
```

## 6.7 `node` (registro en tabla `nodes`)

Representa un nodo del grafo de un proceso. Vive como fila en la tabla `nodes`, no como artefacto en `metadata`.

### 6.7.1 Catálogo de `node_type`

| `node_type` | Descripción | UI: nombre visible |
| --- | --- | --- |
| `start` | Nodo de inicio del proceso. Único por proceso. | Inicio |
| `end` | Nodo de fin. Puede haber varios (resultados distintos). | Fin |
| `human_task` | Tarea ejecutada por un humano vía un `form_definition`. | Tarea de usuario |
| `script_task` | Tarea automática (script). | Tarea de sistema |
| `exclusive_gateway` | Compuerta de decisión binaria/multi-salida. | Decisión |

### 6.7.2 Estructura del JSONB `config` por `node_type`

**`start`**
```json
{}
```

**`end`**
```json
{
  "result_label": "string — Etiqueta del resultado, opcional (ej: 'Aprobada', 'Rechazada')"
}
```

**`human_task`**
```json
{
  "form_ref":     "uuid    — id_object del form_definition",
  "assignment":   "object  — Reglas de asignación (reservado para v1.1, opcional en MVP)",
  "due_in":       "string  — Duración antes de timeout (reservado)"
}
```

**`script_task`**
```json
{
  "language":  "string — 'javascript' (único en MVP)",
  "source":    "string — Código del script. Recibe `context` y debe retornar `context` actualizado"
}
```

**`exclusive_gateway`**
```json
{
  "default_transition_id": "string — id de la transición que se toma si ninguna condición se cumple"
}
```

> Las condiciones de salida del gateway viven en las `transition` que parten de él (campo `condition`), no en el `config` del nodo.

### Ejemplo

```json
// Fila en tabla `nodes`
{
  "id_node": "n_capture-uuid",
  "process_id": "8c3b1d2e-...-...",
  "node_type": "human_task",
  "name": "capturar_solicitud",
  "display_name": "Capturar solicitud",
  "position_x": 220,
  "position_y": 140,
  "width": null,
  "height": null,
  "config": {
    "form_ref": "f1a2b3c4-...-..."
  }
}
```

## 6.8 `template` (reservado)

Plantilla reutilizable de un proceso, formulario o conjunto. **Reservado en v1.0**: se documenta la firma mínima propuesta para anclar el catálogo, pero el comportamiento exacto se cerrará cuando el uso real lo demande.

### Firma JSON propuesta (no normativa en v1.0)

```json
{
  "description":   "string  — Descripción del template",
  "template_type": "string  — 'process' | 'form' | 'bundle' (qué se empaqueta)",
  "payload":       "object  — Snapshot serializado del/los artefactos empaquetados",
  "parameters":    "array<object> — Parámetros que se solicitan al instanciar, opcional",
  "version":       "integer — Versión del template"
}
```

> La estructura de `payload` y `parameters` se especificará en Definición de Metadata v1.1 una vez que el creador haya iterado con templates reales.

---

# 7. Jerarquía y referencias

## 7.1 Jerarquía `parent`

La columna `parent` de la tabla `metadata` construye un árbol estricto del proyecto:

```
root_project (1)
├── entity (N)
│   ├── form_definition (N)
│   └── data_view (N)  [firma normativa, implementación diferida]
├── process_definition (N)
└── template (N)  [reservado]
```

Reglas:

- Solo `root_project` tiene `parent = NULL`.
- `entity.parent` debe apuntar a un `root_project`.
- `form_definition.parent` debe apuntar a un `entity`.
- `data_view.parent` debe apuntar a un `entity`.
- `process_definition.parent` debe apuntar a un `root_project`.
- `template.parent` debe apuntar a un `root_project`.

## 7.2 Referencias cruzadas

Además de la jerarquía, existen referencias **lógicas** entre artefactos. Estas referencias no son FK físicas universales (algunas son string-id dentro de un JSON), y por tanto la integridad se valida en la capa de aplicación.

| Referencia | Origen | Destino | Tipo |
| --- | --- | --- | --- |
| `Relation.related_entity_id` | `entity.content.relations[]` | `metadata.id_object` (de un `entity`) | FK lógica |
| `Relation.fk_attribute_id` | `entity.content.relations[]` | `attributes.id_attribute` | FK lógica |
| `Attribute.metadata.foreign_key_ref` | `attributes.metadata` | `Relation.id` de la entidad padre | Referencia local |
| `FormField.attribute_ref` | `form_definition.content.fields[]` | `attributes.id_attribute` | FK lógica |
| `FormField.x_path` | `form_definition.content.fields[]` | Cadena de `Relation.name` + `attribute.name` | FK lógica (xPath) |
| `Column.attribute_ref` | `data_view.content.columns[]` | `attributes.id_attribute` | FK lógica |
| `Column.x_path` | `data_view.content.columns[]` | Cadena de `Relation.name` + `attribute.name` | FK lógica (xPath) |
| `default_sort.column_id` | `data_view.content` | `Column.id` dentro de la misma vista | Referencia local |
| `ContextVariable.entity_ref` | `process_definition.content.context_variables[]` | `metadata.id_object` (de un `entity`) | FK lógica |
| `Transition.from_node_id`, `to_node_id` | `process_definition.content.transitions[]` | `nodes.id_node` | FK lógica |
| `node.config.form_ref` (human_task) | `nodes.config` | `metadata.id_object` (de un `form_definition`) | FK lógica |

---

# 8. Reglas de validación

Las reglas de validación se aplican antes de persistir cualquier artefacto. El sistema rechaza la operación con un error claro si alguna regla falla.

## 8.1 Reglas estructurales

**VR-01.** El campo `content` de cada artefacto debe validar contra el JSON Schema derivado de la firma correspondiente a su `object_type` (§6).

**VR-02.** Todo artefacto excepto `root_project` debe tener `parent` no nulo y apuntar a un artefacto existente.

**VR-03.** El `parent` debe ser del tipo esperado por el catálogo §5. Ejemplo: un `form_definition` no puede tener `parent` de tipo `process_definition`.

**VR-04.** Exactamente un `root_project` debe existir en la BD del proyecto.

**VR-05.** El UNIQUE compuesto `(parent, object_name, object_type)` se respeta: no se permiten dos hermanos del mismo tipo con el mismo nombre.

## 8.2 Reglas de integridad referencial

**VR-10.** Al eliminar un `entity`, debe rechazarse si existe al menos un `form_definition` o `data_view` cuyo `parent` apunta a él (ON DELETE RESTRICT en `metadata.parent`).

**VR-11.** Al eliminar un `entity`, debe rechazarse si existe al menos otro `entity` con una `Relation` cuyo `related_entity_id` apunta a él, o si existe un `data_view` con alguna `Column.x_path` que navegue hacia esta entidad.

**VR-12.** Al eliminar un `entity`, debe rechazarse si existen filas en `attributes` con `entity_id` apuntando a él (no hay borrado en cascada de atributos en v1.0; debe vaciarse antes).

**VR-13.** Al eliminar una fila de `attributes`, debe rechazarse si existe al menos un `FormField` (en cualquier `form_definition`) o una `Column` (en cualquier `data_view`) que la referencia en `attribute_ref`.

**VR-14.** Al eliminar una fila de `attributes`, debe rechazarse si está referenciada como `fk_attribute_id` en alguna `Relation`.

**VR-15.** Al eliminar un `process_definition`, los `nodes` asociados se eliminan en cascada (FK con ON DELETE CASCADE).

**VR-16.** Al eliminar un `form_definition`, debe rechazarse si existe algún `node` de tipo `human_task` con `config.form_ref` apuntando a él.

## 8.3 Reglas de coherencia interna

**VR-20.** En `form_definition`: cada `FormField.attribute_ref` debe corresponder a un atributo de la entidad referenciada por `parent`, salvo cuando el field declara `x_path`: en ese caso, el atributo final del `xPath` puede pertenecer a otra entidad alcanzable por la cadena de relaciones.

**VR-21.** En `data_view`: cada `Column.attribute_ref` debe corresponder a un atributo de la entidad referenciada por `parent`, salvo cuando la columna declara `x_path`: en ese caso, el atributo final del `xPath` puede pertenecer a otra entidad alcanzable por la cadena de relaciones.

**VR-22.** Sobre `x_path` (en `FormField` y en `Column`): cada segmento intermedio del `xPath` debe corresponder a un `Relation.name` válido de la entidad activa en ese punto de la navegación. El último segmento debe corresponder a un `attribute.name` válido de la última entidad alcanzada. El sistema rechaza `xPaths` con segmentos inexistentes o ambiguos. El `attribute_ref` declarado debe coincidir con el `id_attribute` resultante de resolver el `xPath`.

**VR-23.** En `entity`: cada `Relation.fk_attribute_id` debe apuntar a un atributo de esta entidad (para cardinalidad N:1 o 1:1) o de la entidad referenciada (para 1:N). Se valida según `cardinality`.

**VR-24.** En `entity`: para cada `Attribute` con `metadata.is_foreign_key = true`, el campo `metadata.foreign_key_ref` debe coincidir con el `id` de alguna `Relation` de la entidad padre.

**VR-25.** En `process_definition`: debe existir exactamente un `node` con `node_type = 'start'` por proceso.

**VR-26.** En `process_definition`: debe existir al menos un `node` con `node_type = 'end'`.

**VR-27.** En `process_definition`: cada `Transition.from_node_id` y `to_node_id` debe apuntar a un `node` del mismo proceso (no se permiten transiciones cross-proceso).

**VR-28.** En `process_definition`: el nodo de tipo `start` no puede ser destino de ninguna transición. Un nodo `end` no puede ser origen de ninguna transición.

**VR-29.** En `process_definition`: todo nodo (excepto `start` y `end`) debe tener al menos una transición entrante y una saliente. Esta regla se aplica al pasar `status` a `configured`; en `draft` se permite el estado incompleto.

**VR-30.** En `process_definition`: si un nodo es de tipo `exclusive_gateway`, su `config.default_transition_id` debe corresponder a una transición que parte de ese nodo.

**VR-31.** En `process_definition`: cada `Transition.condition` debe ser sintácticamente válida como expresión booleana sobre el `context`. La validación semántica completa es responsabilidad del motor (futuro).

**VR-32.** En `data_view`: si `default_sort` está presente, su `column_id` debe corresponder a una columna existente en `columns[]` y dicha columna debe tener `sortable: true`.

**VR-33.** En `data_view`: `page_size`, si está presente, debe estar en el rango `[10, 200]`. Si está ausente, el sistema usa 25 por defecto.

## 8.4 Reglas de naming

**VR-40.** `object_name`, `attribute.name`, `node.name`, `context_variable.name`: deben coincidir con la regex `^[a-z][a-z0-9_]{0,62}$` (snake_case, hasta 63 caracteres, empieza con letra).

**VR-41.** No se permiten palabras reservadas del SQL estándar ni de PostgreSQL como nombres de `entity.source` o `attribute.metadata.source`. El sistema mantiene una lista negra.

---

# 9. Consideraciones de implementación

## 9.1 Validación JSON Schema

Cada `object_type` debe tener un JSON Schema asociado, derivado mecánicamente de la firma §6. El backend valida con AJV (Node) o equivalente antes de cualquier `INSERT` o `UPDATE` sobre `metadata`. Una validación fallida retorna HTTP 422 con el detalle del campo que falló.

## 9.2 Catálogo de tipos administrable

El catálogo de `object_type` (§5) y de `data_type` (§6.3.1) puede mantenerse en:

- Tablas de referencia (`object_types`, `data_types`) — recomendado para auditoría y extensibilidad.
- Enums hardcodeados en código — más simple pero menos flexible.

Decisión final en SRS de Backend.

## 9.3 Hidratación del API

Como establece P5, el frontend nunca recibe IDs crudos cuando consume un árbol. Endpoints típicos y su comportamiento de hidratación:

| Endpoint | Hidrata |
| --- | --- |
| `GET /api/entities/{id}` | Incluye `attributes` resueltos (no solo IDs). |
| `GET /api/forms/{id}` | Incluye `fields` con `attribute` hidratado por cada uno. |
| `GET /api/data-views/{id}` | Incluye `columns` con `attribute` hidratado por cada una; los `x_path` se resuelven a la cadena de relaciones legible. |
| `GET /api/processes/{id}` | Incluye `nodes` resueltos y, dentro de `human_task`, el `form_definition` hidratado. |
| `GET /api/projects/{id}/tree` | Árbol completo hidratado (uso administrativo, no para edición). |

El frontend puede solicitar versiones no-hidratadas con `?hydrate=false` cuando solo necesita la cáscara.

## 9.4 Performance

La regla de §4.5 garantiza que la lectura de un árbol completo de proyecto típico (50 entidades, 500 atributos, 20 procesos, 100 nodos) requiere a lo sumo 4 queries SQL con joins, no N+1. La hidratación se construye en el backend con un único `SELECT ... JOIN` por nivel.

## 9.5 Concurrencia

Operaciones concurrentes sobre el mismo artefacto se resuelven con optimistic locking: cada artefacto en `metadata` incluye `updated_at`, y los UPDATE comparan el `updated_at` enviado con el actual. Implementación detallada en SRS de Backend.

---

# 10. Glosario

| Término | Definición |
| --- | --- |
| Artefacto | Cualquier elemento del metamodelo: artefactos en `metadata`, atributos en `attributes`, nodos en `nodes`, o sub-objetos inline. |
| `id_object` | UUID que identifica unívocamente a un artefacto que reside en la tabla `metadata`. |
| `object_type` | Discriminante string del tipo de artefacto en `metadata`. Ver catálogo §5. |
| `content` | Columna JSONB de `metadata` con las propiedades específicas del artefacto. |
| `parent` | Columna UUID auto-referencial que construye la jerarquía del proyecto. |
| Tabla dedicada | Tabla SQL propia para un tipo de elemento masivo u operable individualmente (`attributes`, `nodes`). |
| Inline | Sub-objeto JSON contenido en el `content` de un artefacto padre (`form_field`, `column`, `transition`, `context_variable`). |
| Hidratación | Operación del backend que resuelve referencias por ID a sub-árboles completos antes de responder al frontend. |
| FK lógica | Referencia entre artefactos validada en capa de aplicación, no como FK física de BD. |
| `root_project` | Nodo raíz único del proyecto. |
| `entity` | Artefacto que representa una tabla del modelo de datos. |
| `attribute` | Registro en la tabla `attributes` que representa una columna de una entidad. |
| `form_definition` | Artefacto que representa un formulario asociado a una entidad. |
| `form_field` | Sub-objeto inline que representa un campo de un formulario. |
| `data_view` | Artefacto que representa una vista de listado read-only sobre una entidad. Firma normativa en v1.0; implementación diferida (ver `pendientes.md` P-001). |
| `column` | Sub-objeto inline de un `data_view` que representa una columna de la vista. |
| `xPath` | Mecanismo de navegación entre relaciones expresado en dot notation (ej: `employee.full_name`). Cada segmento intermedio referencia un `Relation.name`; el último referencia un `attribute.name`. Usado en `FormField.x_path` y `Column.x_path`. |
| `process_definition` | Artefacto que representa un workflow. |
| `node` | Registro en la tabla `nodes` que representa un paso del grafo de un proceso. |
| `transition` | Sub-objeto inline que representa una arista del grafo de un proceso. |
| `context_variable` | Sub-objeto inline que representa una variable del contexto de un proceso. |
| `template` | Plantilla reutilizable. Reservado en v1.0. |
| Greenfield | Modo de proyecto en que el modelo de datos se crea desde cero en la herramienta. |
| Brownfield | Modo de proyecto en que el modelo de datos se ingiere de una BD existente. |
| Metamodelo | Conjunto de artefactos y sus firmas que permiten describir cualquier dominio de negocio. |

---

# 11. Historial de versiones

| Versión | Fecha | Descripción |
| --- | --- | --- |
| 1.0 | Mayo 2026 | Versión inicial de la Definición de Metadata para Workflow Platform. Establece el metamodelo del proyecto, la estrategia de persistencia mixta (tabla `metadata` genérica + tablas dedicadas `attributes` y `nodes` + sub-objetos inline), el catálogo de `object_type` en formato string, las firmas JSON canónicas de los artefactos `root_project`, `entity`, `attribute`, `form_definition`, `process_definition`, `node`, y la firma reservada de `template`. Hereda los principios del Framework Conceptual v1.1 del MVP previo (Metadata Framework Tool) y los rediseña para soportar procesos. Establece 31 reglas de validación referenciables (VR-01 a VR-41 con saltos). Deja explícitamente fuera de alcance la capa de runtime de procesos y el catálogo administrativo de la BD central, ambos diferidos a v1.1. |
| 1.1 | Mayo 2026 | **Eliminación de tipificación de `form_definition`**: se quitan los campos `form_type`, `pagination` y `search` de la firma. El formulario es uno solo; su comportamiento se infiere del estado del contexto en ejecución (si los campos vienen con valores, se muestran prellenados; si llegan vacíos, se diligencian). **Introducción del artefacto `data_view`** (§6.5) como vista de listado read-only sobre una entidad, con columnas configurables, ordenamiento por defecto y paginación. Su firma JSON es normativa, pero su implementación en UI y runtime se difiere al post-MVP (ver `pendientes.md` P-001). **Formalización de `xPath`** como mecanismo de navegación entre relaciones en dot notation (ej: `employee.full_name`), usado tanto en `FormField.x_path` como en `Column.x_path`. Se renumera §6: `process_definition` pasa a §6.6, `node` pasa a §6.7, `template` pasa a §6.8. Reglas de validación: se reemplazan VR-21 y VR-22 (eran sobre `form_type`) por reglas para `data_view` y `xPath`; VR-10, VR-11 y VR-13 se extienden para incluir `data_view`; se agregan VR-32 y VR-33 (validación de `default_sort` y `page_size`). Se actualizan §7.1 (jerarquía), §7.2 (referencias cruzadas), §9.3 (hidratación API) y §10 (glosario) en consecuencia. |

*— Fin del documento —*

Confidencial · Mayo 2026 · Workflow Platform · Definición de Metadata v1.1