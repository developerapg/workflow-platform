# MODELO DE DATOS FÍSICO

**Workflow Platform**

*DDL ejecutable de PostgreSQL para la BD de proyecto: tipos, constraints, índices, secuencias y estrategia de migración*

Mayo 2026 · v1.1 · Confidencial — Documento interno

---

# 1. Introducción

## 1.1 Propósito

Este documento traduce el metamodelo conceptual definido en la **Definición de Metadata v1.0** a **DDL ejecutable de PostgreSQL** para la base de datos de un **proyecto** de Workflow Platform. Especifica:

- Tipos PostgreSQL exactos por columna.
- Constraints (PK, FK, UNIQUE, CHECK, NOT NULL).
- Índices recomendados con justificación.
- Defaults y generadores de UUID.
- Scripts de creación de BD nueva por proyecto (plantilla del modelo multi-tenant).
- Estrategia de versionado y migración de schema, sin elegir herramienta concreta.

Es un documento **ejecutable**: los bloques SQL contenidos pueden correrse contra un servidor PostgreSQL 16+ para levantar un entorno funcional. Es la fuente de verdad para todo lo que sea estructura física de la BD de proyecto. Cualquier divergencia entre este documento y el código de migraciones debe resolverse a favor de este documento.

## 1.2 Audiencia

- **Equipo de Backend**, que lo usa como contrato físico para construir el acceso a datos (EF Core, Dapper) y para generar/mantener los scripts de migración.
- **Operador de la plataforma** (creador), que lo usa para entender qué se aplica al crear un proyecto nuevo y qué cambia entre versiones.
- **Equipo de Frontend**, sólo en aspectos que afecten payloads del API (los tipos físicos influyen en serialización).

## 1.3 Alcance

| Incluido en v1.1 | Fuera de alcance |
| --- | --- |
| BD de un **proyecto** (multi-tenancy por BD; ver Visión §7). | BD central de administración (catálogo de clientes, proyectos, usuarios, sesiones, conexiones). **Pertenece a un proyecto desacoplado**, no a Workflow Platform. Especificación referencial en SRS Catálogo Administrativo v1.0 (trabajo guardado, no parte del MVP). |
| Schema operativo `wf_meta` con tablas de diseño: `metadata`, `attributes`, `nodes`. | Tablas del schema de negocio (las que `entity` representan). Estas se generan dinámicamente en greenfield o se ingieren en brownfield; su DDL no es estático. |
| **Schema operativo `wf_runtime` con tablas de ejecución básica: `process_instance`, `node_instance`, `context_variable_value`, `task`.** Soporta el flujo MVP `start → human_task → end`. | Ejecución de `exclusive_gateway`, `script_task`, transiciones con `condition` no nula. El diseñador permite crear estos elementos y se persisten en BD; el motor MVP los rechaza al instanciar con error de tipo no soportado. Se habilitarán en v1.2. |
| Constraints, índices, defaults, secuencias para diseño + runtime básico. | Tablas de auditoría detallada de ejecución (`process_history`, `task_history`), reintentos automáticos, dead-letter de procesos fallidos. Quedan para v1.2. |
| Plantilla SQL de creación de BD nueva por proyecto. | Configuración de PostgreSQL a nivel servidor (tuning, replicación, backups). |
| Estrategia general de migración (versionado, idempotencia, orden de aplicación sobre N proyectos). | Elección de herramienta concreta de migración (EF Core Migrations / FluentMigrator / SQL puro). Se decide en SRS de Backend. |

## 1.4 Documentos de referencia

| Documento | Versión | Propiedad sobre |
| --- | --- | --- |
| Workflow Platform — Documento de Visión | 1.0 | Visión de negocio, multi-tenancy por BD, criterios de éxito. |
| Workflow Platform — Definición de Metadata | 1.1 | Metamodelo conceptual, firmas JSON, reglas de validación VR-01 a VR-41, decisiones de persistencia (inline vs. tabla dedicada). |
| Workflow Platform — UX Spec | 1.0 | Patrones de UI; consultado para entender qué operaciones lecturas/escrituras dispara cada módulo (de ahí derivan algunos índices). |

## 1.5 Convenciones del documento

- Los bloques `sql` son **ejecutables** sobre PostgreSQL 16+. Pueden copiarse y aplicarse directamente.
- Los nombres de tabla y columna se escriben en `snake_case` en minúsculas, sin comillas, sin prefijos hungarianos.
- Las constraints se nombran explícitamente con el patrón `[tipo]_[tabla]_[detalle]`: `pk_metadata`, `fk_attributes_entity`, `uq_metadata_parent_name_type`, `ck_metadata_object_type`, `ix_metadata_parent`. Esto permite identificarlas en errores y en scripts de migración.
- Las reglas de validación referenciadas como **VR-NN** corresponden a la numeración de la Definición de Metadata §8.
- Las reglas de runtime referenciadas como **RT-NN** son nuevas en v1.1 y se definen en §6.5.7.
- Los bloques marcados como `MIGRACIÓN N` corresponden a la secuencia de migraciones que lleva una BD vacía al estado v1.1. Ver §10.

---

# 2. Principios físicos

Cuatro principios rigen las decisiones de este documento. Cualquier extensión futura debe poder justificarse contra ellos.

**PF1 — Una BD por proyecto, un schema operativo dentro de ella.** Cada proyecto vive en una BD PostgreSQL dedicada. Dentro de esa BD existe un único schema operativo (`wf_meta` por defecto) donde residen todas las tablas del metamodelo. Las tablas del negocio (las que las `entity` representan) viven en otro schema del mismo proyecto (típicamente `public`). La separación física en dos schemas es deliberada: facilita backups selectivos, permisos diferenciados y migración independiente.

**PF2 — UUID v4 como identidad universal, generado en BD.** Todos los identificadores son `UUID` con default `gen_random_uuid()` (extensión `pgcrypto`). No se usan SERIAL/BIGSERIAL. Razones: identidad inmutable que sobrevive a exports/imports entre proyectos, ausencia de colisiones al fusionar metadata de templates, y consistencia con el contrato de la Definición de Metadata (P4 — identidad estable).

**PF3 — JSONB con validación en aplicación, no con `jsonb_typeof` ni triggers.** El campo `content` es `JSONB`. La validación de su forma (contra los JSON Schemas derivados de las firmas §6 de la Definición de Metadata) es responsabilidad del backend antes de cada `INSERT`/`UPDATE`. No se imponen triggers de validación a nivel BD porque (a) la lógica es compleja y cambia con el metamodelo, (b) el costo de mantener triggers paralelos al schema de aplicación es alto, (c) PostgreSQL no es el lugar adecuado para evaluar JSON Schemas. Lo que sí se impone son índices GIN para consultas eficientes.

**PF4 — Constraints declarativos siempre que sean estables.** Las reglas que no cambian con el metamodelo (cardinalidad, unicidad, integridad referencial básica) se imponen como constraints SQL. Las reglas que dependen del `object_type` o del contenido JSON (por ejemplo, VR-25 "exactamente un nodo start por proceso") se validan en aplicación. La frontera entre uno y otro se documenta explícitamente en §6.

---

# 3. Prerequisitos del servidor PostgreSQL

## 3.1 Versión

PostgreSQL **16 o superior**. Justificación: `gen_random_uuid()` nativa en `pgcrypto`, mejoras de rendimiento en JSONB con índices GIN, soporte estable de tipos `numeric` para coordenadas del canvas.

## 3.2 Extensiones requeridas

Cada BD de proyecto debe tener instaladas las siguientes extensiones antes de aplicar las migraciones:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- (reservado, ver §3.3)
```

| Extensión | Propósito en v1.0 | Obligatoria |
| --- | --- | --- |
| `pgcrypto` | `gen_random_uuid()` para defaults de PKs. | Sí |
| `citext` | Reservada para columnas que en iteraciones futuras requieran comparación case-insensitive (ej. nombres de tabla física). En v1.0 no se usa. | No (instalar igualmente para evitar migración de añadirla después) |

## 3.3 Locale y encoding

- **Encoding:** `UTF8`.
- **Collation:** `en_US.UTF-8` (estable, conocida, no impone reglas idiomáticas que afecten comparaciones técnicas).
- Los nombres técnicos del metamodelo son `snake_case` ASCII por regla VR-40, por lo que la collation no afecta integridad. Sí afecta `ORDER BY` sobre `description` cuando contiene español; aceptable para v1.0.

## 3.4 Permisos y usuarios PostgreSQL

Cada BD de proyecto se opera con dos roles:

| Rol | Permisos | Usado por |
| --- | --- | --- |
| `wf_app` | `CONNECT`, `USAGE` sobre schemas `wf_meta` y `wf_runtime`, `SELECT/INSERT/UPDATE/DELETE` sobre todas sus tablas. `USAGE/CREATE` sobre schema `public` (para greenfield). | El backend de la aplicación en operación normal. |
| `wf_admin` | Superusuario sobre la BD. | Operador / scripts de migración. |

El detalle de creación y asignación de roles vive en el SRS del Catálogo Administrativo (BD central tiene la responsabilidad de crear BDs y otorgar permisos). Aquí solo se documenta el contrato.

---

# 4. Schemas dentro de la BD de proyecto

Cada BD de proyecto contiene tres schemas:

| Schema | Propósito | Quién lo crea |
| --- | --- | --- |
| `wf_meta` | Tablas del metamodelo de **diseño**: `metadata`, `attributes`, `nodes`. Es donde vive lo que el diseñador crea. | Script de bootstrap del proyecto (§9). |
| `wf_runtime` | Tablas de **ejecución**: `process_instance`, `node_instance`, `context_variable_value`, `task`. Es donde vive el estado vivo del motor. Separado de `wf_meta` deliberadamente: ciclos de vida distintos, volúmenes distintos, políticas de backup potencialmente distintas. | Script de bootstrap del proyecto (§9). |
| `public` | Tablas del negocio: las que las `entity` representan físicamente. En greenfield las crea/altera la plataforma dinámicamente; en brownfield ya existen al ingerir. | Plataforma (greenfield) o cliente (brownfield). |

`search_path` recomendado a nivel BD:

```sql
ALTER DATABASE current_database() SET search_path = wf_meta, wf_runtime, public;
```

Esto permite que el backend escriba `SELECT * FROM metadata` o `SELECT * FROM process_instance` sin calificar el schema, manteniendo la separación física.

---

# 5. Tablas del schema `wf_meta`

Tres tablas componen el metamodelo en v1.0. Cada una se documenta con: diagrama de columnas, DDL ejecutable, constraints, índices, justificación de tipos.

## 5.1 Tabla `metadata`

### 5.1.1 Propósito

Tabla genérica que aloja todos los artefactos no masivos del metamodelo: `root_project`, `entity`, `form_definition`, `process_definition`, `template`. La distinción entre tipos se hace por la columna discriminante `object_type`. Justificación completa en Definición de Metadata §4.2.

### 5.1.2 DDL

```sql
CREATE TABLE wf_meta.metadata (
    id_object    uuid          NOT NULL DEFAULT gen_random_uuid(),
    object_name  varchar(255)  NOT NULL,
    object_type  varchar(64)   NOT NULL,
    content      jsonb         NOT NULL DEFAULT '{}'::jsonb,
    parent       uuid          NULL,
    created_at   timestamptz   NOT NULL DEFAULT now(),
    updated_at   timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT pk_metadata
        PRIMARY KEY (id_object),

    CONSTRAINT fk_metadata_parent
        FOREIGN KEY (parent)
        REFERENCES wf_meta.metadata (id_object)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT uq_metadata_parent_name_type
        UNIQUE (parent, object_name, object_type),

    CONSTRAINT ck_metadata_object_type
        CHECK (object_type IN (
            'root_project',
            'entity',
            'form_definition',
            'process_definition',
            'template'
        )),

    CONSTRAINT ck_metadata_object_name_format
        CHECK (object_name ~ '^[a-z][a-z0-9_]{0,62}$'),

    CONSTRAINT ck_metadata_root_has_no_parent
        CHECK (
            (object_type = 'root_project' AND parent IS NULL)
            OR
            (object_type <> 'root_project' AND parent IS NOT NULL)
        )
);
```

### 5.1.3 Decisiones por columna

| Columna | Tipo elegido | Justificación |
| --- | --- | --- |
| `id_object` | `uuid` con default `gen_random_uuid()` | PF2. Identidad inmutable, portable entre proyectos. |
| `object_name` | `varchar(255)` | Suficiente para snake_case técnico + márgenes. VR-40 lo restringe a 63 caracteres, pero damos margen para extensiones futuras. |
| `object_type` | `varchar(64)` | String legible en queries directos y logs. `CHECK` impide valores fuera del catálogo (§5 Definición de Metadata). |
| `content` | `jsonb` | Almacenamiento eficiente, soporta GIN. Default `'{}'::jsonb` evita NULL accidentales; la firma real se valida en aplicación. |
| `parent` | `uuid` NULL | FK auto-referencial. NULL únicamente para `root_project` (impuesto por `ck_metadata_root_has_no_parent`). |
| `created_at` / `updated_at` | `timestamptz` | Auditoría mínima. `timestamptz` por consistencia con cualquier cliente en cualquier zona horaria. |

### 5.1.4 Reglas materializadas como constraints

| Constraint | Regla VR cubierta | Notas |
| --- | --- | --- |
| `pk_metadata` | — | Estructural. |
| `fk_metadata_parent` | VR-02 (parent debe existir), VR-10/11 parcialmente (ON DELETE RESTRICT) | Garantiza que un padre eliminado no deje huérfanos. |
| `uq_metadata_parent_name_type` | VR-05 (no hermanos con mismo nombre y tipo) | Compuesto. NULL en parent se trata como valor real por defecto en PostgreSQL, por lo que múltiples `root_project` con mismo nombre serían posibles; esto se mitiga con `ck_metadata_root_singleton` (ver §5.1.6). |
| `ck_metadata_object_type` | Cataloga §5 Definición de Metadata | Si el catálogo crece, requiere migración (ver §10). |
| `ck_metadata_object_name_format` | VR-40 (snake_case) | Regex idéntica a la del documento canónico. |
| `ck_metadata_root_has_no_parent` | VR-02 + estructural | Garantiza coherencia entre tipo raíz y ausencia de padre. |

### 5.1.5 Reglas NO materializadas (se validan en aplicación)

- **VR-04** (exactamente un `root_project`). PostgreSQL no soporta un constraint declarativo trivial para "exactamente uno"; podría implementarse con un índice único parcial (ver §5.1.6), pero la decisión se toma en la siguiente sección.
- **VR-03** (el `parent` debe ser del tipo esperado según catálogo). Imposible expresar con CHECK porque requiere lookup a otra fila. Se valida en aplicación con un `SELECT` previo o con triggers (no usados en v1.0).
- **VR-01** (validación JSON Schema de `content`). Se valida en aplicación.

### 5.1.6 Decisión sobre VR-04 (singleton de root_project)

Se materializa con un **índice único parcial**:

```sql
CREATE UNIQUE INDEX uq_metadata_root_project_singleton
    ON wf_meta.metadata (object_type)
    WHERE object_type = 'root_project';
```

Razón: barato, declarativo, imposible de evadir desde aplicación. La aplicación además valida antes de insertar para entregar un error útil, pero el índice es la red de seguridad.

### 5.1.7 Índices

```sql
-- Búsqueda por tipo (listado de procesos, listado de entidades, etc.)
CREATE INDEX ix_metadata_object_type
    ON wf_meta.metadata (object_type);

-- Búsqueda por padre (cargar hijos de un nodo del árbol)
CREATE INDEX ix_metadata_parent
    ON wf_meta.metadata (parent);

-- Combinada: hijos de tipo T de un padre P (consulta más frecuente del API de árbol)
CREATE INDEX ix_metadata_parent_type
    ON wf_meta.metadata (parent, object_type);

-- Singleton de root_project (ya declarado en §5.1.6)
-- CREATE UNIQUE INDEX uq_metadata_root_project_singleton ...

-- GIN sobre content para queries por propiedades JSON
-- Útil para búsquedas como "entidades con source = 'vacation_request'"
CREATE INDEX ix_metadata_content_gin
    ON wf_meta.metadata
    USING gin (content jsonb_path_ops);
```

Notas:

- `jsonb_path_ops` ocupa menos espacio que `jsonb_ops` y es más rápido para queries `@>` (contención). Se prefiere para v1.0 porque los queries esperados son del tipo "el `content` contiene esta clave/valor".
- No se crean índices funcionales por propiedad específica del JSON en v1.0 (`content->>'mode'`, etc.). Se añadirán si métricas reales muestran queries lentas.

### 5.1.8 Trigger de `updated_at`

PostgreSQL no actualiza `updated_at` automáticamente; se requiere trigger explícito.

```sql
CREATE OR REPLACE FUNCTION wf_meta.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_metadata_updated_at
    BEFORE UPDATE ON wf_meta.metadata
    FOR EACH ROW
    EXECUTE FUNCTION wf_meta.touch_updated_at();
```

La función `touch_updated_at` se reutiliza en `attributes` y `nodes`.

## 5.2 Tabla `attributes`

### 5.2.1 Propósito

Tabla dedicada para atributos de entidad. Justificación en Definición de Metadata §4.3 y §4.5: volumen alto, operación individual frecuente.

### 5.2.2 DDL

```sql
CREATE TABLE wf_meta.attributes (
    id_attribute     uuid          NOT NULL DEFAULT gen_random_uuid(),
    entity_id        uuid          NOT NULL,
    name             varchar(128)  NOT NULL,
    description      text          NULL,
    data_type        varchar(32)   NOT NULL,
    required         boolean       NOT NULL DEFAULT false,
    is_unique        boolean       NOT NULL DEFAULT false,
    default_value    jsonb         NULL,
    is_business_key  boolean       NOT NULL DEFAULT false,
    metadata         jsonb         NOT NULL DEFAULT '{}'::jsonb,
    ordinal          integer       NOT NULL DEFAULT 0,
    created_at       timestamptz   NOT NULL DEFAULT now(),
    updated_at       timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT pk_attributes
        PRIMARY KEY (id_attribute),

    CONSTRAINT fk_attributes_entity
        FOREIGN KEY (entity_id)
        REFERENCES wf_meta.metadata (id_object)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT uq_attributes_entity_name
        UNIQUE (entity_id, name),

    CONSTRAINT ck_attributes_name_format
        CHECK (name ~ '^[a-z][a-z0-9_]{0,62}$'),

    CONSTRAINT ck_attributes_data_type
        CHECK (data_type IN (
            'string',
            'integer',
            'decimal',
            'boolean',
            'date',
            'datetime',
            'uuid',
            'json'
        ))
);
```

### 5.2.3 Decisiones por columna

| Columna | Tipo elegido | Justificación |
| --- | --- | --- |
| `id_attribute` | `uuid` | PF2. |
| `entity_id` | `uuid` NOT NULL | FK obligatoria. Un atributo huérfano no tiene sentido. |
| `name` | `varchar(128)` | VR-40 lo restringe a 63 chars; margen amplio. |
| `description` | `text` NULL | Sin límite arbitrario; rara vez muy largo. |
| `data_type` | `varchar(32)` con CHECK | Catálogo §6.3.1 de Definición de Metadata. |
| `required` | `boolean` NOT NULL DEFAULT false | Propiedad de negocio. |
| `is_unique` | `boolean` NOT NULL DEFAULT false | **Renombrado de `unique` a `is_unique`** porque `unique` es palabra reservada en SQL y aunque PostgreSQL lo permite con comillas, evitamos el conflicto en código de aplicación. La firma JSON canónica de la Definición de Metadata sigue siendo `unique`; la traducción es responsabilidad del ORM/mapper. |
| `default_value` | `jsonb` NULL | Tipado según `data_type`. JSONB permite cualquier valor primitivo o estructura. |
| `is_business_key` | `boolean` NOT NULL DEFAULT false | Marca para llaves de negocio. |
| `metadata` | `jsonb` NOT NULL | Propiedades técnico-físicas (mapeo a columna, FK física, constraints). Default `'{}'`. |
| `ordinal` | `integer` NOT NULL DEFAULT 0 | **Añadido respecto a Definición de Metadata.** Permite ordenamiento estable de atributos en la UI sin depender del orden de inserción. Justificación: el diseñador de entidades (UX Spec §8.3) soporta drag-to-reorder; sin un campo persistente de orden, el orden se perdería al releer. Se persiste explícitamente. |
| `created_at` / `updated_at` | `timestamptz` | Auditoría. |

### 5.2.4 Reglas materializadas y NO materializadas

Materializadas: `fk_attributes_entity`, `uq_attributes_entity_name`, `ck_attributes_name_format`, `ck_attributes_data_type`.

No materializadas (se validan en aplicación):

- **VR-13** (no eliminar atributo referenciado en `FormField.attribute_ref`). Imposible como FK física porque `attribute_ref` vive dentro de un JSONB (`form_definition.content.fields[].attribute_ref`). Se valida en aplicación con búsqueda GIN sobre `metadata.content`.
- **VR-14** (no eliminar atributo referenciado en `Relation.fk_attribute_id`). Igual razón.
- **VR-20** (los `FormField.attribute_ref` deben pertenecer a la entidad del form). Se valida en aplicación al guardar el `form_definition`.

### 5.2.5 Que el `entity_id` apunte solo a `metadata` con `object_type='entity'`

La FK `fk_attributes_entity` apunta a `metadata.id_object` sin filtrar por tipo. PostgreSQL no soporta FK condicional ("FK a esta tabla pero solo si la columna T tiene valor X"). Mitigación: la aplicación valida antes de insertar. Como red adicional, se puede añadir un trigger:

```sql
CREATE OR REPLACE FUNCTION wf_meta.assert_entity_id_is_entity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    parent_type text;
BEGIN
    SELECT object_type INTO parent_type
    FROM wf_meta.metadata
    WHERE id_object = NEW.entity_id;

    IF parent_type IS DISTINCT FROM 'entity' THEN
        RAISE EXCEPTION 'attributes.entity_id (%) does not reference an entity (object_type=%)',
            NEW.entity_id, COALESCE(parent_type, '<not found>');
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_attributes_assert_entity
    BEFORE INSERT OR UPDATE OF entity_id ON wf_meta.attributes
    FOR EACH ROW
    EXECUTE FUNCTION wf_meta.assert_entity_id_is_entity();
```

**Decisión v1.0:** se aplica el trigger. La sobrecarga es mínima (un SELECT por escritura) y la red de seguridad vale la pena en una BD que mezcla todos los tipos de artefactos.

### 5.2.6 Índices

```sql
-- Búsqueda de atributos por entidad (consulta más frecuente: cargar entidad con sus atributos)
CREATE INDEX ix_attributes_entity
    ON wf_meta.attributes (entity_id);

-- Búsqueda de atributos por entidad y orden (carga ordenada para UI)
CREATE INDEX ix_attributes_entity_ordinal
    ON wf_meta.attributes (entity_id, ordinal);

-- Búsqueda de atributos que son business key
CREATE INDEX ix_attributes_business_key
    ON wf_meta.attributes (entity_id)
    WHERE is_business_key = true;

-- GIN sobre metadata JSONB (queries por foreign_key_ref, etc.)
CREATE INDEX ix_attributes_metadata_gin
    ON wf_meta.attributes
    USING gin (metadata jsonb_path_ops);
```

### 5.2.7 Trigger de `updated_at`

```sql
CREATE TRIGGER trg_attributes_updated_at
    BEFORE UPDATE ON wf_meta.attributes
    FOR EACH ROW
    EXECUTE FUNCTION wf_meta.touch_updated_at();
```

## 5.3 Tabla `nodes`

### 5.3.1 Propósito

Tabla dedicada para nodos de procesos. Justificación en Definición de Metadata §4.4: operación individual en canvas, volumen moderado pero suficiente para no anidar en JSON.

### 5.3.2 DDL

```sql
CREATE TABLE wf_meta.nodes (
    id_node      uuid          NOT NULL DEFAULT gen_random_uuid(),
    process_id   uuid          NOT NULL,
    node_type    varchar(32)   NOT NULL,
    name         varchar(128)  NOT NULL,
    position_x   numeric(10,2) NOT NULL DEFAULT 0,
    position_y   numeric(10,2) NOT NULL DEFAULT 0,
    config       jsonb         NOT NULL DEFAULT '{}'::jsonb,
    created_at   timestamptz   NOT NULL DEFAULT now(),
    updated_at   timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT pk_nodes
        PRIMARY KEY (id_node),

    CONSTRAINT fk_nodes_process
        FOREIGN KEY (process_id)
        REFERENCES wf_meta.metadata (id_object)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,

    CONSTRAINT uq_nodes_process_name
        UNIQUE (process_id, name),

    CONSTRAINT ck_nodes_name_format
        CHECK (name ~ '^[a-z][a-z0-9_]{0,62}$'),

    CONSTRAINT ck_nodes_node_type
        CHECK (node_type IN (
            'start',
            'end',
            'human_task',
            'script_task',
            'exclusive_gateway'
        ))
);
```

### 5.3.3 Decisiones por columna

| Columna | Tipo elegido | Justificación |
| --- | --- | --- |
| `id_node` | `uuid` | PF2. |
| `process_id` | `uuid` NOT NULL | FK obligatoria. |
| `node_type` | `varchar(32)` con CHECK | Catálogo §6.6.1 de Definición de Metadata. |
| `name` | `varchar(128)` | Mismo razonamiento que en otras tablas. |
| `position_x`, `position_y` | `numeric(10,2)` | Coordenadas en el canvas, dos decimales para snap fino. Rango ±9.999.999,99 sobra para canvas finitos. |
| `config` | `jsonb` NOT NULL | Configuración por tipo de nodo. |
| `created_at` / `updated_at` | `timestamptz` | Auditoría. |

### 5.3.4 Cascada vs. restrict

A diferencia de `attributes` (que usa `ON DELETE RESTRICT`), `nodes` usa `ON DELETE CASCADE`. Razón: un proceso eliminado debe arrastrar sus nodos (Definición de Metadata VR-15), porque los nodos no tienen vida independiente del proceso. Los atributos en cambio pueden ser referenciados desde múltiples lugares, así que se exige limpieza explícita.

### 5.3.5 Trigger de tipo de padre

Misma razón que en `attributes`. `process_id` debe apuntar a un `metadata` con `object_type='process_definition'`.

```sql
CREATE OR REPLACE FUNCTION wf_meta.assert_process_id_is_process()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    parent_type text;
BEGIN
    SELECT object_type INTO parent_type
    FROM wf_meta.metadata
    WHERE id_object = NEW.process_id;

    IF parent_type IS DISTINCT FROM 'process_definition' THEN
        RAISE EXCEPTION 'nodes.process_id (%) does not reference a process_definition (object_type=%)',
            NEW.process_id, COALESCE(parent_type, '<not found>');
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_nodes_assert_process
    BEFORE INSERT OR UPDATE OF process_id ON wf_meta.nodes
    FOR EACH ROW
    EXECUTE FUNCTION wf_meta.assert_process_id_is_process();
```

### 5.3.6 Índices

```sql
-- Búsqueda de nodos por proceso (la consulta dominante)
CREATE INDEX ix_nodes_process
    ON wf_meta.nodes (process_id);

-- Búsqueda de nodos por tipo dentro de un proceso (validar singleton de start, etc.)
CREATE INDEX ix_nodes_process_type
    ON wf_meta.nodes (process_id, node_type);

-- GIN sobre config (queries por form_ref dentro de human_task, etc.)
CREATE INDEX ix_nodes_config_gin
    ON wf_meta.nodes
    USING gin (config jsonb_path_ops);
```

### 5.3.7 Singleton de `start` por proceso (VR-25)

Materializable con índice único parcial:

```sql
CREATE UNIQUE INDEX uq_nodes_one_start_per_process
    ON wf_meta.nodes (process_id)
    WHERE node_type = 'start';
```

**Decisión v1.0:** se aplica. El costo es nulo y previene un estado inválido a nivel BD.

### 5.3.8 Trigger de `updated_at`

```sql
CREATE TRIGGER trg_nodes_updated_at
    BEFORE UPDATE ON wf_meta.nodes
    FOR EACH ROW
    EXECUTE FUNCTION wf_meta.touch_updated_at();
```

---

# 6. Tablas del schema `wf_runtime`

## 6.1 Visión general

El schema `wf_runtime` aloja el **estado vivo** del motor: cada vez que se instancia un `process_definition`, se crean filas en estas tablas que el motor lee y muta hasta que el proceso termina.

Cuatro tablas componen el runtime básico v1.1:

| Tabla | Propósito | Cardinalidad típica |
| --- | --- | --- |
| `process_instance` | Una fila por cada ejecución de un proceso. | N por proceso, persiste indefinidamente. |
| `node_instance` | Una fila por cada nodo recorrido por una instancia. | N por instancia (al menos: start, K human_task, end). |
| `context_variable_value` | Valores actuales de las variables del contexto de cada instancia. | M por instancia (M = número de variables del proceso). |
| `task` | Una fila por cada `human_task` pendiente de ser completada por un humano. | 0 o 1 por `node_instance` de tipo human_task activo. |

## 6.2 Alcance MVP y rechazos explícitos

El motor MVP solo soporta procesos cuyo grafo contiene **únicamente** nodos `start`, `human_task`, `end`, conectados por transiciones con `condition` nula. Al recibir un `POST /processes/{id}/instances` para iniciar un proceso, el motor:

1. Carga el `process_definition` y sus `nodes`.
2. Verifica que todo `node.node_type ∈ {'start', 'human_task', 'end'}`. Si encuentra `script_task` o `exclusive_gateway`, rechaza con `422 unsupported_node_type`.
3. Verifica que ninguna transición tenga `condition` no nula. Si encuentra alguna, rechaza con `422 unsupported_transition_condition`.
4. Solo entonces crea el `process_instance` y comienza la ejecución.

Esta restricción se aplica **únicamente al instanciar**, no al diseñar. El diseñador permite crear procesos con cualquier tipo de nodo y condiciones; el motor MVP simplemente no los ejecuta. En v1.2 se levanta la restricción.

## 6.3 Tabla `process_instance`

### 6.3.1 Propósito

Una fila representa una ejecución de un `process_definition`. Es el ancla de todo lo que pase durante esa ejecución: nodos recorridos, valores de contexto, tareas creadas.

### 6.3.2 DDL

```sql
CREATE TABLE wf_runtime.process_instance (
    id_process_instance   uuid          NOT NULL DEFAULT gen_random_uuid(),
    process_definition_id uuid          NOT NULL,
    process_version       integer       NOT NULL,
    status                varchar(16)   NOT NULL DEFAULT 'running',
    started_at            timestamptz   NOT NULL DEFAULT now(),
    completed_at          timestamptz   NULL,
    started_by            uuid          NULL,
    end_node_id           uuid          NULL,
    error_message         text          NULL,
    created_at            timestamptz   NOT NULL DEFAULT now(),
    updated_at            timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT pk_process_instance
        PRIMARY KEY (id_process_instance),

    CONSTRAINT fk_process_instance_definition
        FOREIGN KEY (process_definition_id)
        REFERENCES wf_meta.metadata (id_object)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_process_instance_end_node
        FOREIGN KEY (end_node_id)
        REFERENCES wf_meta.nodes (id_node)
        ON DELETE SET NULL
        ON UPDATE RESTRICT,

    CONSTRAINT ck_process_instance_status
        CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),

    CONSTRAINT ck_process_instance_terminal_consistency
        CHECK (
            (status = 'running' AND completed_at IS NULL)
            OR
            (status <> 'running' AND completed_at IS NOT NULL)
        ),

    CONSTRAINT ck_process_instance_version_positive
        CHECK (process_version >= 1)
);
```

### 6.3.3 Decisiones por columna

| Columna | Tipo elegido | Justificación |
| --- | --- | --- |
| `id_process_instance` | `uuid` | PF2. Es el identificador que ve el usuario en URLs de seguimiento (`/instances/{id}`). |
| `process_definition_id` | `uuid` NOT NULL | FK al `process_definition` que se está ejecutando. |
| `process_version` | `integer` NOT NULL | **Snapshot de la versión del proceso al momento de instanciar.** Si el diseñador modifica el proceso después, las instancias en curso siguen ejecutando la versión con la que arrancaron. Detalle de cómo se obtiene esta versión: ver RT-04. |
| `status` | `varchar(16)` con CHECK | Catálogo: `running`, `completed`, `failed`, `cancelled`. Inicial `running`. |
| `started_at` / `completed_at` | `timestamptz` | Marcas de ciclo de vida. `completed_at` NULL mientras `status='running'`. |
| `started_by` | `uuid` NULL | Identifica quién disparó el inicio del proceso. En MVP sin auth robusta, queda NULL si no hay identidad. |
| `end_node_id` | `uuid` NULL | Cuando el proceso termina, registra cuál nodo `end` cerró el ciclo (puede haber varios `end` en un mismo proceso; saber cuál se alcanzó es información de negocio). NULL hasta que termine. |
| `error_message` | `text` NULL | Mensaje libre poblado solo si `status='failed'`. |
| `created_at`, `updated_at` | `timestamptz` | Auditoría. |

### 6.3.4 ON DELETE RESTRICT al `process_definition`

Un `process_definition` que tiene **al menos una `process_instance`** (en cualquier estado, incluido `completed`) **no se puede eliminar**. Esto preserva la trazabilidad histórica: si se permitiera eliminar la definición, las instancias completadas quedarían sin referencia a su grafo de ejecución.

Esta es una **regla adicional al ciclo de vida de diseño** definido en VR-15: VR-15 dice que eliminar un `process_definition` arrastra sus `nodes`. RT-07 (nueva, ver §6.5.7) dice que un `process_definition` con `process_instance` asociadas no se puede eliminar en absoluto, ni siquiera en cascada. Se materializa con `ON DELETE RESTRICT` en `fk_process_instance_definition`.

### 6.3.5 Índices

```sql
-- Búsqueda de instancias de un proceso (cardinalidad: alta sobre algunos procesos)
CREATE INDEX ix_process_instance_definition
    ON wf_runtime.process_instance (process_definition_id);

-- Búsqueda de instancias por estado (dashboard "qué está corriendo")
CREATE INDEX ix_process_instance_status
    ON wf_runtime.process_instance (status)
    WHERE status = 'running';

-- Búsqueda de instancias por quien las inició (mis instancias)
CREATE INDEX ix_process_instance_started_by
    ON wf_runtime.process_instance (started_by)
    WHERE started_by IS NOT NULL;

-- Búsqueda histórica por rango de fechas (reportes)
CREATE INDEX ix_process_instance_started_at
    ON wf_runtime.process_instance (started_at);
```

El índice parcial sobre `status='running'` es deliberado: el dashboard de seguimiento del operador filtra dominantemente por instancias activas; este índice se mantiene pequeño porque las instancias completadas se acumulan sin entrar al índice.

### 6.3.6 Trigger de `updated_at`

```sql
CREATE OR REPLACE FUNCTION wf_runtime.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_process_instance_updated_at
    BEFORE UPDATE ON wf_runtime.process_instance
    FOR EACH ROW
    EXECUTE FUNCTION wf_runtime.touch_updated_at();
```

La función `wf_runtime.touch_updated_at()` es análoga a `wf_meta.touch_updated_at()` (definida en §5.1.8). Se mantiene una por schema para preservar la separación de privilegios y permitir extender una sin tocar la otra.

## 6.4 Tabla `node_instance`

### 6.4.1 Propósito

Cada vez que el motor "entra" en un nodo de una instancia, crea una fila `node_instance`. Es el ledger de ejecución: orden en que se visitaron los nodos, cuándo entraron, cuándo salieron.

### 6.4.2 DDL

```sql
CREATE TABLE wf_runtime.node_instance (
    id_node_instance      uuid          NOT NULL DEFAULT gen_random_uuid(),
    process_instance_id   uuid          NOT NULL,
    node_id               uuid          NOT NULL,
    status                varchar(16)   NOT NULL DEFAULT 'active',
    entered_at            timestamptz   NOT NULL DEFAULT now(),
    completed_at          timestamptz   NULL,
    sequence_number       integer       NOT NULL,
    error_message         text          NULL,
    created_at            timestamptz   NOT NULL DEFAULT now(),
    updated_at            timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT pk_node_instance
        PRIMARY KEY (id_node_instance),

    CONSTRAINT fk_node_instance_process_instance
        FOREIGN KEY (process_instance_id)
        REFERENCES wf_runtime.process_instance (id_process_instance)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,

    CONSTRAINT fk_node_instance_node
        FOREIGN KEY (node_id)
        REFERENCES wf_meta.nodes (id_node)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT ck_node_instance_status
        CHECK (status IN ('active', 'completed', 'failed')),

    CONSTRAINT ck_node_instance_terminal_consistency
        CHECK (
            (status = 'active' AND completed_at IS NULL)
            OR
            (status <> 'active' AND completed_at IS NOT NULL)
        ),

    CONSTRAINT uq_node_instance_sequence
        UNIQUE (process_instance_id, sequence_number)
);
```

### 6.4.3 Decisiones por columna

| Columna | Tipo elegido | Justificación |
| --- | --- | --- |
| `process_instance_id` | `uuid` NOT NULL | FK a la instancia padre. `ON DELETE CASCADE` (RT-08): si la instancia se elimina, sus nodos también. |
| `node_id` | `uuid` NOT NULL | FK al nodo del diseño que se está ejecutando. `ON DELETE RESTRICT`: no se puede borrar un nodo del diseño si tiene `node_instance` históricas (incluso completadas). |
| `status` | `varchar(16)` con CHECK | Solo tres valores: `active` (motor está en este nodo), `completed` (salió exitosamente), `failed` (error). |
| `entered_at` / `completed_at` | `timestamptz` | Ciclo de vida. |
| `sequence_number` | `integer` NOT NULL | Número monotónico dentro de la instancia, asignado por la aplicación (`MAX + 1` al insertar). Permite reconstruir el orden de visita sin depender de `entered_at` (que podría empatarse en operaciones rápidas). UNIQUE por `(process_instance_id, sequence_number)`. |
| `error_message` | `text` NULL | Si el nodo falló, mensaje libre. |

### 6.4.4 Restricción de un solo `active` por instancia (MVP)

En el MVP, el motor es **estrictamente secuencial**: en cada instancia hay como máximo un `node_instance` con `status='active'` (no hay paralelismo ni gateways AND). Esto se materializa con un índice único parcial:

```sql
CREATE UNIQUE INDEX uq_node_instance_one_active_per_process
    ON wf_runtime.node_instance (process_instance_id)
    WHERE status = 'active';
```

En v1.2, cuando se introduzcan gateways paralelos, este índice se elimina por migración.

### 6.4.5 Índices

```sql
-- Búsqueda de nodos de una instancia (consulta dominante del motor)
CREATE INDEX ix_node_instance_process_instance
    ON wf_runtime.node_instance (process_instance_id, sequence_number);

-- Búsqueda del nodo activo de una instancia (ya cubierto por uq_node_instance_one_active_per_process)

-- Búsqueda histórica por nodo del diseño (analytics: "cuántas veces se ejecutó este nodo")
CREATE INDEX ix_node_instance_node
    ON wf_runtime.node_instance (node_id);
```

### 6.4.6 Trigger de `updated_at`

```sql
CREATE TRIGGER trg_node_instance_updated_at
    BEFORE UPDATE ON wf_runtime.node_instance
    FOR EACH ROW
    EXECUTE FUNCTION wf_runtime.touch_updated_at();
```

## 6.5 Tabla `context_variable_value`

### 6.5.1 Propósito

Materializa los valores actuales de las variables del contexto de cada `process_instance`. Una fila por `(process_instance, variable)`.

El proceso define sus variables en `process_definition.content.context_variables[]` (inline, según §6.5 de la Definición de Metadata). Al instanciar, el motor crea una fila por variable con el `initial_value` declarado. A medida que avanza la ejecución (formularios completados, valores asignados por la lógica), las filas se actualizan.

### 6.5.2 DDL

```sql
CREATE TABLE wf_runtime.context_variable_value (
    id_context_variable_value  uuid          NOT NULL DEFAULT gen_random_uuid(),
    process_instance_id        uuid          NOT NULL,
    variable_id                varchar(64)   NOT NULL,
    variable_name              varchar(128)  NOT NULL,
    data_type                  varchar(32)   NOT NULL,
    value                      jsonb         NULL,
    set_by_node_instance_id    uuid          NULL,
    set_at                     timestamptz   NOT NULL DEFAULT now(),
    created_at                 timestamptz   NOT NULL DEFAULT now(),
    updated_at                 timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT pk_context_variable_value
        PRIMARY KEY (id_context_variable_value),

    CONSTRAINT fk_context_variable_value_process_instance
        FOREIGN KEY (process_instance_id)
        REFERENCES wf_runtime.process_instance (id_process_instance)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,

    CONSTRAINT fk_context_variable_value_set_by
        FOREIGN KEY (set_by_node_instance_id)
        REFERENCES wf_runtime.node_instance (id_node_instance)
        ON DELETE SET NULL
        ON UPDATE RESTRICT,

    CONSTRAINT uq_context_variable_value_per_instance
        UNIQUE (process_instance_id, variable_id),

    CONSTRAINT ck_context_variable_value_data_type
        CHECK (data_type IN (
            'string', 'integer', 'decimal', 'boolean',
            'date', 'datetime', 'uuid', 'json', 'entity_ref'
        ))
);
```

### 6.5.3 Decisiones por columna

| Columna | Tipo elegido | Justificación |
| --- | --- | --- |
| `variable_id` | `varchar(64)` | El `id` libre que el diseñador asignó a la variable en `context_variables[].id`. Es string porque la Definición de Metadata permite identificadores libres (`var_request`, `var_approved`). |
| `variable_name` | `varchar(128)` | El `name` técnico de la variable (snake_case). Se denormaliza aquí para evitar tener que cargar el `process_definition.content` para mostrar el contexto. |
| `data_type` | `varchar(32)` con CHECK | Catálogo extendido respecto a `attributes.data_type`: añade `entity_ref` (referencia a fila de tabla de negocio). Cubre el catálogo de `ContextVariable.data_type` de §6.5 de la Definición de Metadata. |
| `value` | `jsonb` NULL | El valor actual de la variable. Tipado según `data_type`. NULL = sin asignar. Se valida en aplicación que el JSON respete `data_type` (string → JSON string, integer → JSON number entero, etc.). |
| `set_by_node_instance_id` | `uuid` NULL | Qué `node_instance` fue el último que escribió este valor. Útil para depuración y para reconstruir trazas. NULL para el `initial_value` (no fue puesto por ningún nodo). |
| `set_at` | `timestamptz` | Timestamp de la última asignación. |

### 6.5.4 Por qué denormalizar `variable_name` y `data_type`

La fuente canónica de qué variables tiene un proceso es `process_definition.content.context_variables[]` (JSONB en `wf_meta.metadata`). En estricta normalización, se podría guardar solo `variable_id` y resolver el nombre y tipo cargando el JSON.

Se decide **denormalizar** ambos campos en `context_variable_value` por tres razones:

1. **Lectura barata.** El dashboard de seguimiento muestra el contexto completo de una instancia constantemente; no queremos cargar el JSON del proceso en cada lectura.
2. **Robustez ante cambios.** Si el diseñador modifica un nombre de variable después de iniciar la instancia, queremos que la instancia siga mostrando el nombre con el que arrancó (consistencia con el snapshot de `process_instance.process_version`).
3. **Simplicidad de queries.** "Dame todas las variables `approved=true` activas" es un query directo, no requiere unboxear JSON.

El costo es que si el diseñador renombra una variable, las instancias en curso no se "actualizan". Esto es la conducta deseada: las instancias respetan su snapshot.

### 6.5.5 Índices

```sql
-- Búsqueda de variables de una instancia (consulta dominante: cargar contexto)
CREATE INDEX ix_context_variable_value_process_instance
    ON wf_runtime.context_variable_value (process_instance_id);

-- Búsqueda por variable_name dentro de una instancia (lookup directo)
CREATE INDEX ix_context_variable_value_process_instance_name
    ON wf_runtime.context_variable_value (process_instance_id, variable_name);

-- GIN sobre value para queries por contenido (raros pero útiles para analytics)
CREATE INDEX ix_context_variable_value_value_gin
    ON wf_runtime.context_variable_value
    USING gin (value jsonb_path_ops);
```

### 6.5.6 Trigger de `updated_at`

```sql
CREATE TRIGGER trg_context_variable_value_updated_at
    BEFORE UPDATE ON wf_runtime.context_variable_value
    FOR EACH ROW
    EXECUTE FUNCTION wf_runtime.touch_updated_at();
```

## 6.6 Tabla `task`

### 6.6.1 Propósito

Cuando una `node_instance` corresponde a un `human_task`, el motor crea una `task` que representa el trabajo pendiente para un humano. La `task` vive hasta que un usuario la completa enviando el formulario asociado.

### 6.6.2 DDL

```sql
CREATE TABLE wf_runtime.task (
    id_task               uuid          NOT NULL DEFAULT gen_random_uuid(),
    node_instance_id      uuid          NOT NULL,
    process_instance_id   uuid          NOT NULL,
    form_definition_id    uuid          NOT NULL,
    assigned_to           uuid          NULL,
    assigned_role         varchar(64)   NULL,
    status                varchar(16)   NOT NULL DEFAULT 'pending',
    title                 varchar(255)  NOT NULL,
    created_at            timestamptz   NOT NULL DEFAULT now(),
    claimed_at            timestamptz   NULL,
    completed_at          timestamptz   NULL,
    completed_by          uuid          NULL,
    submitted_data        jsonb         NULL,
    updated_at            timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT pk_task
        PRIMARY KEY (id_task),

    CONSTRAINT fk_task_node_instance
        FOREIGN KEY (node_instance_id)
        REFERENCES wf_runtime.node_instance (id_node_instance)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,

    CONSTRAINT fk_task_process_instance
        FOREIGN KEY (process_instance_id)
        REFERENCES wf_runtime.process_instance (id_process_instance)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,

    CONSTRAINT fk_task_form_definition
        FOREIGN KEY (form_definition_id)
        REFERENCES wf_meta.metadata (id_object)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT uq_task_node_instance
        UNIQUE (node_instance_id),

    CONSTRAINT ck_task_status
        CHECK (status IN ('pending', 'claimed', 'completed', 'cancelled')),

    CONSTRAINT ck_task_terminal_consistency
        CHECK (
            (status IN ('pending', 'claimed') AND completed_at IS NULL)
            OR
            (status IN ('completed', 'cancelled') AND completed_at IS NOT NULL)
        ),

    CONSTRAINT ck_task_claimed_consistency
        CHECK (
            (status = 'claimed' AND claimed_at IS NOT NULL)
            OR
            (status <> 'claimed')
        )
);
```

### 6.6.3 Decisiones por columna

| Columna | Tipo elegido | Justificación |
| --- | --- | --- |
| `node_instance_id` | `uuid` NOT NULL UNIQUE | Cada `node_instance` de tipo `human_task` tiene **exactamente una** `task`. UNIQUE materializa esa cardinalidad. |
| `process_instance_id` | `uuid` NOT NULL | Denormalizado para queries "mis tareas activas" sin joins. |
| `form_definition_id` | `uuid` NOT NULL | FK al formulario que el usuario debe completar. `ON DELETE RESTRICT`: no se puede borrar un form referenciado por tareas históricas (refuerza VR-16 a nivel runtime). |
| `assigned_to` | `uuid` NULL | El usuario específico al que se asignó. Puede ser NULL si solo hay `assigned_role`. En MVP la lógica de asignación es manual o "first-claim-wins"; ver siguiente sección. |
| `assigned_role` | `varchar(64)` NULL | Rol genérico asignado ("manager", "rrhh"). En MVP es texto libre informativo. La resolución a usuarios concretos vive en SRS de Backend. |
| `status` | `varchar(16)` con CHECK | `pending` (creada, sin tomar), `claimed` (alguien la tomó), `completed` (enviada), `cancelled` (instancia cancelada). |
| `title` | `varchar(255)` NOT NULL | Título visible en la bandeja de tareas. Se genera al crear (típicamente: nombre del nodo + nombre del proceso). |
| `submitted_data` | `jsonb` NULL | Payload completo del formulario enviado al completar. NULL hasta `status='completed'`. Es la fuente de verdad de qué se llenó, separada del contexto del proceso (el motor puede mapear partes de `submitted_data` al contexto, pero el blob completo queda persistido aquí). |
| `claimed_at` | `timestamptz` NULL | Cuándo alguien la tomó. NULL si nunca se claimeó. |
| `completed_at` | `timestamptz` NULL | Cuándo se cerró. |
| `completed_by` | `uuid` NULL | Quién la cerró. Puede ser distinto de `assigned_to` si admin la cerró por otro. |

### 6.6.4 Asignación de tareas en MVP

El MVP soporta un modelo simple:

- Al crear la `task`, el motor lee `node.config.assignment` (ver Definición de Metadata §6.6.2 — campo reservado en MVP).
- Si `assignment.user_id` está presente, se asigna `assigned_to = ese user_id`.
- Si `assignment.role` está presente, se asigna `assigned_role = ese rol`.
- Si nada está presente, la tarea queda sin asignación específica (`assigned_to` y `assigned_role` ambos NULL); cualquier usuario con permiso sobre el proyecto puede tomarla.

La lógica de **qué usuarios pueden ver/claim una tarea** es responsabilidad del backend, no de la BD. La BD solo persiste las marcas; el filtrado de tareas por usuario se hace en el endpoint `GET /tasks/me`.

### 6.6.5 Índices

```sql
-- Bandeja de tareas: "mis tareas pendientes"
CREATE INDEX ix_task_assigned_to_pending
    ON wf_runtime.task (assigned_to)
    WHERE status IN ('pending', 'claimed');

-- Bandeja por rol
CREATE INDEX ix_task_assigned_role_pending
    ON wf_runtime.task (assigned_role)
    WHERE status IN ('pending', 'claimed') AND assigned_role IS NOT NULL;

-- Tareas de una instancia (vista de seguimiento)
CREATE INDEX ix_task_process_instance
    ON wf_runtime.task (process_instance_id);

-- Tareas pendientes globales (operador de soporte)
CREATE INDEX ix_task_status_pending
    ON wf_runtime.task (created_at)
    WHERE status = 'pending';
```

### 6.6.6 Trigger de `updated_at`

```sql
CREATE TRIGGER trg_task_updated_at
    BEFORE UPDATE ON wf_runtime.task
    FOR EACH ROW
    EXECUTE FUNCTION wf_runtime.touch_updated_at();
```

## 6.7 Reglas de runtime (RT)

Análogas a las VR de la Definición de Metadata, pero aplicables al runtime. Se numeran como **RT-NN**.

| ID | Regla | Dónde se aplica |
| --- | --- | --- |
| **RT-01** | Al instanciar un proceso, se verifica que todos sus nodos sean del tipo soportado (`start`, `human_task`, `end` en MVP). Si no, rechazo `422 unsupported_node_type`. | Aplicación. |
| **RT-02** | Al instanciar un proceso, se verifica que ninguna transición tenga `condition` no nula. Si la tiene, rechazo `422 unsupported_transition_condition`. | Aplicación. |
| **RT-03** | En cada `process_instance` hay como máximo un `node_instance` con `status='active'`. | BD: `uq_node_instance_one_active_per_process`. |
| **RT-04** | Al instanciar un proceso, se hace snapshot de su versión actual en `process_instance.process_version`. La instancia ejecuta esa versión aunque el diseño cambie después. | Aplicación. |
| **RT-05** | Cada `node_instance` de tipo `human_task` debe tener exactamente una `task` asociada. | BD: `uq_task_node_instance`. |
| **RT-06** | `task.form_definition_id` referencia un `metadata.id_object` cuyo `object_type='form_definition'`. | Aplicación (idéntica razón a `assert_entity_id_is_entity`: BD no soporta FK condicional). Trigger opcional documentado en §6.7.1. |
| **RT-07** | No se puede eliminar un `process_definition` que tiene `process_instance` asociadas (en cualquier estado). | BD: `ON DELETE RESTRICT` en `fk_process_instance_definition`. |
| **RT-08** | Eliminar un `process_instance` arrastra en cascada sus `node_instance`, `context_variable_value` y `task`. | BD: `ON DELETE CASCADE` en las FKs respectivas. |
| **RT-09** | No se puede eliminar un `form_definition` referenciado desde una `task` (histórica o activa). | BD: `ON DELETE RESTRICT` en `fk_task_form_definition`. |
| **RT-10** | El `status` de `process_instance` y `node_instance` solo puede transicionar en el sentido permitido: `running → completed`, `running → failed`, `running → cancelled`. Una instancia completada no vuelve a `running`. | Aplicación. La BD no impone transiciones de estado. |
| **RT-11** | `context_variable_value.data_type` debe coincidir con el `data_type` declarado en `process_definition.content.context_variables[].data_type` para esa `variable_id`. | Aplicación. |
| **RT-12** | El JSON en `context_variable_value.value` debe ser compatible con `data_type` (string → JSON string, integer → JSON integer, etc.). | Aplicación. |
| **RT-13** | El JSON en `task.submitted_data` debe satisfacer el schema del `form_definition` referenciado (validación de FormField requeridos, tipos, etc.). | Aplicación. |
| **RT-14** | Una `task` en estado `completed` no puede modificarse (campos `submitted_data`, `completed_by`, `completed_at` son inmutables después de completion). | Aplicación. Triggers opcionales en v1.2. |

### 6.7.1 Trigger opcional para RT-06

Análogo a los triggers de §5.2.5 y §5.3.5:

```sql
CREATE OR REPLACE FUNCTION wf_runtime.assert_form_id_is_form()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    parent_type text;
BEGIN
    SELECT object_type INTO parent_type
    FROM wf_meta.metadata WHERE id_object = NEW.form_definition_id;
    IF parent_type IS DISTINCT FROM 'form_definition' THEN
        RAISE EXCEPTION 'task.form_definition_id (%) does not reference a form_definition (object_type=%)',
            NEW.form_definition_id, COALESCE(parent_type, '<not found>');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_task_assert_form
    BEFORE INSERT OR UPDATE OF form_definition_id ON wf_runtime.task
    FOR EACH ROW
    EXECUTE FUNCTION wf_runtime.assert_form_id_is_form();
```

**Decisión v1.1:** se aplica. Coherente con la política adoptada para `attributes` y `nodes`.

---

# 7. Resumen: qué se materializa en BD y qué no

Esta tabla resume cómo se distribuyen las **reglas de diseño (VR)** de la Definición de Metadata §8 y las **reglas de runtime (RT)** definidas en §6.7 entre BD y aplicación.

## 7.1 Reglas de diseño (VR)

| Regla | Descripción resumida | Dónde se aplica | Mecanismo físico |
| --- | --- | --- | --- |
| VR-01 | Validación JSON Schema del `content`. | Aplicación | Backend valida antes de INSERT/UPDATE. |
| VR-02 | `parent` no nulo excepto en `root_project`. | BD | `ck_metadata_root_has_no_parent` + `fk_metadata_parent`. |
| VR-03 | `parent` debe ser del tipo esperado. | Aplicación | Lookup previo, opcionalmente trigger. |
| VR-04 | Exactamente un `root_project`. | BD | `uq_metadata_root_project_singleton` (índice parcial). |
| VR-05 | UNIQUE `(parent, name, type)`. | BD | `uq_metadata_parent_name_type`. |
| VR-10 | No eliminar `entity` con `form_definition` hijo. | BD | `ON DELETE RESTRICT` en `fk_metadata_parent`. |
| VR-11 | No eliminar `entity` referenciada desde `Relation` de otra entidad. | Aplicación | `metadata.content` es JSONB; búsqueda GIN. |
| VR-12 | No eliminar `entity` con atributos. | BD | `ON DELETE RESTRICT` en `fk_attributes_entity`. |
| VR-13 | No eliminar `attribute` referenciado en `FormField`. | Aplicación | Búsqueda GIN en `metadata.content`. |
| VR-14 | No eliminar `attribute` referenciado en `Relation.fk_attribute_id`. | Aplicación | Búsqueda GIN. |
| VR-15 | Eliminar `process_definition` cascada a `nodes`. | BD | `ON DELETE CASCADE` en `fk_nodes_process`. |
| VR-16 | No eliminar `form_definition` referenciado por `human_task`. | Aplicación + BD | Aplicación para diseño (JSONB); `fk_task_form_definition` RESTRICT para runtime. |
| VR-20 | `FormField.attribute_ref` debe pertenecer a la entidad del form. | Aplicación | Validación al guardar `form_definition`. |
| VR-21 | `form_type='list_search'` requiere `pagination` y `search`. | Aplicación | Validación JSON Schema. |
| VR-22 | `search.mode='semantic'` aceptado en diseño, no ejecutable. | Aplicación / Runtime | Sin restricción BD. |
| VR-23 | Coherencia de `Relation.fk_attribute_id` según cardinalidad. | Aplicación | Lógica compleja. |
| VR-24 | `Attribute.metadata.foreign_key_ref` debe coincidir con un `Relation.id`. | Aplicación | Validación cruzada. |
| VR-25 | Exactamente un `start` por proceso. | BD | `uq_nodes_one_start_per_process`. |
| VR-26 | Al menos un `end` por proceso. | Aplicación | "Al menos uno" no es expresable declarativamente; se valida al `status='configured'`. |
| VR-27 | Transiciones entre nodos del mismo proceso. | Aplicación | `transitions` vive inline en `metadata.content`. |
| VR-28 | `start` sin entrada, `end` sin salida. | Aplicación | Idem. |
| VR-29 | Todo nodo intermedio con al menos una entrada y una salida. | Aplicación | Idem. Solo en `configured`. |
| VR-30 | `default_transition_id` de gateway debe ser una transición saliente. | Aplicación | Validación cruzada al guardar. |
| VR-31 | `Transition.condition` sintácticamente válida. | Aplicación | Parser de expresiones del backend (post-MVP). |
| VR-40 | Naming `snake_case` para identificadores técnicos. | BD | `ck_metadata_object_name_format`, `ck_attributes_name_format`, `ck_nodes_name_format`. |
| VR-41 | Lista negra de palabras reservadas SQL. | Aplicación | Validación previa antes de INSERT/UPDATE. |

## 7.2 Reglas de runtime (RT)

| Regla | Descripción resumida | Dónde se aplica | Mecanismo físico |
| --- | --- | --- | --- |
| RT-01 | Solo nodos `start`, `human_task`, `end` soportados en MVP. | Aplicación | Validación al instanciar. |
| RT-02 | Transiciones sin `condition` en MVP. | Aplicación | Validación al instanciar. |
| RT-03 | Un solo `node_instance` activo por instancia. | BD | `uq_node_instance_one_active_per_process`. |
| RT-04 | Snapshot de versión al instanciar. | Aplicación | `process_instance.process_version`. |
| RT-05 | Exactamente una `task` por `human_task` node_instance. | BD | `uq_task_node_instance`. |
| RT-06 | `task.form_definition_id` apunta a un `form_definition`. | Aplicación + trigger | `trg_task_assert_form`. |
| RT-07 | No eliminar `process_definition` con instancias. | BD | `ON DELETE RESTRICT` en `fk_process_instance_definition`. |
| RT-08 | Cascada al eliminar `process_instance`. | BD | `ON DELETE CASCADE` en FKs respectivas. |
| RT-09 | No eliminar `form_definition` referenciado por `task`. | BD | `ON DELETE RESTRICT` en `fk_task_form_definition`. |
| RT-10 | Transiciones de estado solo en sentido permitido. | Aplicación | Lógica del motor. |
| RT-11 | `context_variable_value.data_type` consistente con el diseño. | Aplicación | Validación al asignar. |
| RT-12 | `value` compatible con `data_type`. | Aplicación | Validación al asignar. |
| RT-13 | `task.submitted_data` valida contra el schema del form. | Aplicación | Validación al completar. |
| RT-14 | `task` completada es inmutable. | Aplicación | Validación en endpoint. |

**Patrón:** lo estructural y declarativo se materializa en BD; lo que depende del estado del motor o del contenido JSON se valida en aplicación.

---

# 8. Tipos lógicos `data_type` → tipos físicos PostgreSQL (greenfield)

Cuando una `entity` está en modo greenfield, la plataforma genera dinámicamente la tabla física en el schema `public`. La traducción de `data_type` lógico a tipo PostgreSQL es:

| `data_type` lógico | Tipo PostgreSQL generado | Notas |
| --- | --- | --- |
| `string` | `text` por defecto. `varchar(N)` si `metadata.constraints.max_length = N`. | `text` es la opción idiomática en PostgreSQL; no hay penalty vs `varchar`. |
| `integer` | `integer` por defecto. `bigint` si `metadata.constraints.bigint = true`. | |
| `decimal` | `numeric(P, S)` donde `P = metadata.constraints.precision` (default 18) y `S = metadata.constraints.scale` (default 2). | |
| `boolean` | `boolean` | |
| `date` | `date` | Sin zona horaria. |
| `datetime` | `timestamptz` | Con zona horaria. |
| `uuid` | `uuid` | Con default `gen_random_uuid()` si `is_primary_key = true` y no se especifica otro default. |
| `json` | `jsonb` | |

**Decisión:** la generación de DDL para tablas de negocio greenfield es responsabilidad del **adapter de BD** del backend, no de este documento. Aquí solo se establece el contrato de traducción de tipos. La especificación detallada (incluyendo generación de FKs físicas, índices automáticos, manejo de cambios destructivos) vive en el SRS de Backend.

---

# 9. Reglas y constraints físicas adicionales

## 9.1 `ON DELETE`/`ON UPDATE` por FK

### 9.1.1 Schema `wf_meta` (diseño)

| FK | `ON DELETE` | `ON UPDATE` | Justificación |
| --- | --- | --- | --- |
| `fk_metadata_parent` | RESTRICT | RESTRICT | El padre no se elimina si tiene hijos; los IDs nunca cambian (UUID). |
| `fk_attributes_entity` | RESTRICT | RESTRICT | La entidad no se elimina si tiene atributos (VR-12); IDs inmutables. |
| `fk_nodes_process` | CASCADE | RESTRICT | El proceso eliminado arrastra nodos (VR-15); IDs inmutables. |

### 9.1.2 Schema `wf_runtime` (ejecución)

| FK | `ON DELETE` | `ON UPDATE` | Justificación |
| --- | --- | --- | --- |
| `fk_process_instance_definition` | RESTRICT | RESTRICT | No se puede eliminar un proceso con instancias (RT-07). |
| `fk_process_instance_end_node` | SET NULL | RESTRICT | Si por alguna migración se borra el nodo end, la instancia mantiene su estado pero pierde la referencia al end específico. |
| `fk_node_instance_process_instance` | CASCADE | RESTRICT | Eliminar instancia arrastra nodos (RT-08). |
| `fk_node_instance_node` | RESTRICT | RESTRICT | No se puede borrar un nodo con `node_instance` históricas. |
| `fk_context_variable_value_process_instance` | CASCADE | RESTRICT | Eliminar instancia arrastra variables (RT-08). |
| `fk_context_variable_value_set_by` | SET NULL | RESTRICT | Si por alguna razón se elimina un `node_instance`, los valores que escribió siguen vigentes pero pierden el setter. |
| `fk_task_node_instance` | CASCADE | RESTRICT | Eliminar instancia arrastra tareas (RT-08). |
| `fk_task_process_instance` | CASCADE | RESTRICT | Idem. |
| `fk_task_form_definition` | RESTRICT | RESTRICT | No se puede borrar un form referenciado por tareas (RT-09). |

## 9.2 Uso selectivo de `ON DELETE SET NULL`

A diferencia del schema `wf_meta` (donde las FKs son siempre obligatorias y `SET NULL` introduciría estados inválidos), el schema `wf_runtime` usa `SET NULL` en dos casos puntuales (`end_node_id`, `set_by_node_instance_id`): ambos son **referencias informativas** cuya pérdida no invalida la fila contenedora.

## 9.3 No se usan checks con subconsultas

PostgreSQL no soporta subqueries dentro de `CHECK`. Cualquier validación que requiera lookup a otra fila se hace con trigger o en aplicación.

---

# 10. Bootstrap de una BD nueva por proyecto

## 10.1 Flujo de creación

Cuando el operador crea un nuevo proyecto (vía UI o vía CLI administrativo), el orquestador ejecuta los siguientes pasos contra el servidor PostgreSQL:

```
1. CREATE DATABASE cliente_X_proyecto_Y
       WITH OWNER = wf_admin
            ENCODING = 'UTF8'
            LC_COLLATE = 'en_US.UTF-8'
            LC_CTYPE = 'en_US.UTF-8'
            TEMPLATE template0;

2. Conectar a la BD recién creada.

3. Aplicar el script bootstrap (§10.2).

4. Insertar la fila inicial de root_project (§10.3).

5. Registrar la BD en el catálogo administrativo (workflow_platform_admin).
```

El paso 5 vive fuera de este documento (SRS del Catálogo Administrativo).

## 10.2 Script bootstrap (idempotente)

Este script lleva una BD vacía al estado v1.1 (schemas `wf_meta` y `wf_runtime` completos). Es **idempotente**: aplicarlo dos veces no produce error.

```sql
-- ============================================================
-- WORKFLOW PLATFORM — BOOTSTRAP SCHEMA v1.1
-- BD: <una BD vacía recién creada>
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- Schemas operativos
CREATE SCHEMA IF NOT EXISTS wf_meta;
CREATE SCHEMA IF NOT EXISTS wf_runtime;

-- Schema de negocio (greenfield lo poblará dinámicamente)
CREATE SCHEMA IF NOT EXISTS public;

-- search_path
ALTER DATABASE current_database()
    SET search_path = wf_meta, wf_runtime, public;

-- Función reutilizable para updated_at (schema wf_meta)
CREATE OR REPLACE FUNCTION wf_meta.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Función reutilizable para updated_at (schema wf_runtime)
CREATE OR REPLACE FUNCTION wf_runtime.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- ============================================================
-- Tabla metadata
-- ============================================================
CREATE TABLE IF NOT EXISTS wf_meta.metadata (
    id_object    uuid          NOT NULL DEFAULT gen_random_uuid(),
    object_name  varchar(255)  NOT NULL,
    object_type  varchar(64)   NOT NULL,
    content      jsonb         NOT NULL DEFAULT '{}'::jsonb,
    parent       uuid          NULL,
    created_at   timestamptz   NOT NULL DEFAULT now(),
    updated_at   timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT pk_metadata PRIMARY KEY (id_object),
    CONSTRAINT fk_metadata_parent
        FOREIGN KEY (parent) REFERENCES wf_meta.metadata (id_object)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT uq_metadata_parent_name_type
        UNIQUE (parent, object_name, object_type),
    CONSTRAINT ck_metadata_object_type CHECK (object_type IN (
        'root_project', 'entity', 'form_definition', 'process_definition', 'template'
    )),
    CONSTRAINT ck_metadata_object_name_format
        CHECK (object_name ~ '^[a-z][a-z0-9_]{0,62}$'),
    CONSTRAINT ck_metadata_root_has_no_parent CHECK (
        (object_type = 'root_project' AND parent IS NULL)
        OR (object_type <> 'root_project' AND parent IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS ix_metadata_object_type
    ON wf_meta.metadata (object_type);
CREATE INDEX IF NOT EXISTS ix_metadata_parent
    ON wf_meta.metadata (parent);
CREATE INDEX IF NOT EXISTS ix_metadata_parent_type
    ON wf_meta.metadata (parent, object_type);
CREATE UNIQUE INDEX IF NOT EXISTS uq_metadata_root_project_singleton
    ON wf_meta.metadata (object_type) WHERE object_type = 'root_project';
CREATE INDEX IF NOT EXISTS ix_metadata_content_gin
    ON wf_meta.metadata USING gin (content jsonb_path_ops);

DROP TRIGGER IF EXISTS trg_metadata_updated_at ON wf_meta.metadata;
CREATE TRIGGER trg_metadata_updated_at
    BEFORE UPDATE ON wf_meta.metadata
    FOR EACH ROW EXECUTE FUNCTION wf_meta.touch_updated_at();

-- ============================================================
-- Tabla attributes
-- ============================================================
CREATE TABLE IF NOT EXISTS wf_meta.attributes (
    id_attribute     uuid          NOT NULL DEFAULT gen_random_uuid(),
    entity_id        uuid          NOT NULL,
    name             varchar(128)  NOT NULL,
    description      text          NULL,
    data_type        varchar(32)   NOT NULL,
    required         boolean       NOT NULL DEFAULT false,
    is_unique        boolean       NOT NULL DEFAULT false,
    default_value    jsonb         NULL,
    is_business_key  boolean       NOT NULL DEFAULT false,
    metadata         jsonb         NOT NULL DEFAULT '{}'::jsonb,
    ordinal          integer       NOT NULL DEFAULT 0,
    created_at       timestamptz   NOT NULL DEFAULT now(),
    updated_at       timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT pk_attributes PRIMARY KEY (id_attribute),
    CONSTRAINT fk_attributes_entity
        FOREIGN KEY (entity_id) REFERENCES wf_meta.metadata (id_object)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT uq_attributes_entity_name UNIQUE (entity_id, name),
    CONSTRAINT ck_attributes_name_format
        CHECK (name ~ '^[a-z][a-z0-9_]{0,62}$'),
    CONSTRAINT ck_attributes_data_type CHECK (data_type IN (
        'string', 'integer', 'decimal', 'boolean',
        'date', 'datetime', 'uuid', 'json'
    ))
);

CREATE INDEX IF NOT EXISTS ix_attributes_entity
    ON wf_meta.attributes (entity_id);
CREATE INDEX IF NOT EXISTS ix_attributes_entity_ordinal
    ON wf_meta.attributes (entity_id, ordinal);
CREATE INDEX IF NOT EXISTS ix_attributes_business_key
    ON wf_meta.attributes (entity_id) WHERE is_business_key = true;
CREATE INDEX IF NOT EXISTS ix_attributes_metadata_gin
    ON wf_meta.attributes USING gin (metadata jsonb_path_ops);

CREATE OR REPLACE FUNCTION wf_meta.assert_entity_id_is_entity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    parent_type text;
BEGIN
    SELECT object_type INTO parent_type
    FROM wf_meta.metadata WHERE id_object = NEW.entity_id;
    IF parent_type IS DISTINCT FROM 'entity' THEN
        RAISE EXCEPTION 'attributes.entity_id (%) does not reference an entity (object_type=%)',
            NEW.entity_id, COALESCE(parent_type, '<not found>');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attributes_assert_entity ON wf_meta.attributes;
CREATE TRIGGER trg_attributes_assert_entity
    BEFORE INSERT OR UPDATE OF entity_id ON wf_meta.attributes
    FOR EACH ROW EXECUTE FUNCTION wf_meta.assert_entity_id_is_entity();

DROP TRIGGER IF EXISTS trg_attributes_updated_at ON wf_meta.attributes;
CREATE TRIGGER trg_attributes_updated_at
    BEFORE UPDATE ON wf_meta.attributes
    FOR EACH ROW EXECUTE FUNCTION wf_meta.touch_updated_at();

-- ============================================================
-- Tabla nodes
-- ============================================================
CREATE TABLE IF NOT EXISTS wf_meta.nodes (
    id_node      uuid          NOT NULL DEFAULT gen_random_uuid(),
    process_id   uuid          NOT NULL,
    node_type    varchar(32)   NOT NULL,
    name         varchar(128)  NOT NULL,
    position_x   numeric(10,2) NOT NULL DEFAULT 0,
    position_y   numeric(10,2) NOT NULL DEFAULT 0,
    config       jsonb         NOT NULL DEFAULT '{}'::jsonb,
    created_at   timestamptz   NOT NULL DEFAULT now(),
    updated_at   timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT pk_nodes PRIMARY KEY (id_node),
    CONSTRAINT fk_nodes_process
        FOREIGN KEY (process_id) REFERENCES wf_meta.metadata (id_object)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT uq_nodes_process_name UNIQUE (process_id, name),
    CONSTRAINT ck_nodes_name_format
        CHECK (name ~ '^[a-z][a-z0-9_]{0,62}$'),
    CONSTRAINT ck_nodes_node_type CHECK (node_type IN (
        'start', 'end', 'human_task', 'script_task', 'exclusive_gateway'
    ))
);

CREATE INDEX IF NOT EXISTS ix_nodes_process
    ON wf_meta.nodes (process_id);
CREATE INDEX IF NOT EXISTS ix_nodes_process_type
    ON wf_meta.nodes (process_id, node_type);
CREATE INDEX IF NOT EXISTS ix_nodes_config_gin
    ON wf_meta.nodes USING gin (config jsonb_path_ops);
CREATE UNIQUE INDEX IF NOT EXISTS uq_nodes_one_start_per_process
    ON wf_meta.nodes (process_id) WHERE node_type = 'start';

CREATE OR REPLACE FUNCTION wf_meta.assert_process_id_is_process()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    parent_type text;
BEGIN
    SELECT object_type INTO parent_type
    FROM wf_meta.metadata WHERE id_object = NEW.process_id;
    IF parent_type IS DISTINCT FROM 'process_definition' THEN
        RAISE EXCEPTION 'nodes.process_id (%) does not reference a process_definition (object_type=%)',
            NEW.process_id, COALESCE(parent_type, '<not found>');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nodes_assert_process ON wf_meta.nodes;
CREATE TRIGGER trg_nodes_assert_process
    BEFORE INSERT OR UPDATE OF process_id ON wf_meta.nodes
    FOR EACH ROW EXECUTE FUNCTION wf_meta.assert_process_id_is_process();

DROP TRIGGER IF EXISTS trg_nodes_updated_at ON wf_meta.nodes;
CREATE TRIGGER trg_nodes_updated_at
    BEFORE UPDATE ON wf_meta.nodes
    FOR EACH ROW EXECUTE FUNCTION wf_meta.touch_updated_at();

-- ============================================================
-- Tabla process_instance (wf_runtime)
-- ============================================================
CREATE TABLE IF NOT EXISTS wf_runtime.process_instance (
    id_process_instance   uuid          NOT NULL DEFAULT gen_random_uuid(),
    process_definition_id uuid          NOT NULL,
    process_version       integer       NOT NULL,
    status                varchar(16)   NOT NULL DEFAULT 'running',
    started_at            timestamptz   NOT NULL DEFAULT now(),
    completed_at          timestamptz   NULL,
    started_by            uuid          NULL,
    end_node_id           uuid          NULL,
    error_message         text          NULL,
    created_at            timestamptz   NOT NULL DEFAULT now(),
    updated_at            timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT pk_process_instance PRIMARY KEY (id_process_instance),
    CONSTRAINT fk_process_instance_definition
        FOREIGN KEY (process_definition_id) REFERENCES wf_meta.metadata (id_object)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_process_instance_end_node
        FOREIGN KEY (end_node_id) REFERENCES wf_meta.nodes (id_node)
        ON DELETE SET NULL ON UPDATE RESTRICT,
    CONSTRAINT ck_process_instance_status
        CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    CONSTRAINT ck_process_instance_terminal_consistency CHECK (
        (status = 'running' AND completed_at IS NULL)
        OR (status <> 'running' AND completed_at IS NOT NULL)
    ),
    CONSTRAINT ck_process_instance_version_positive CHECK (process_version >= 1)
);

CREATE INDEX IF NOT EXISTS ix_process_instance_definition
    ON wf_runtime.process_instance (process_definition_id);
CREATE INDEX IF NOT EXISTS ix_process_instance_status
    ON wf_runtime.process_instance (status) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS ix_process_instance_started_by
    ON wf_runtime.process_instance (started_by) WHERE started_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_process_instance_started_at
    ON wf_runtime.process_instance (started_at);

DROP TRIGGER IF EXISTS trg_process_instance_updated_at ON wf_runtime.process_instance;
CREATE TRIGGER trg_process_instance_updated_at
    BEFORE UPDATE ON wf_runtime.process_instance
    FOR EACH ROW EXECUTE FUNCTION wf_runtime.touch_updated_at();

-- ============================================================
-- Tabla node_instance (wf_runtime)
-- ============================================================
CREATE TABLE IF NOT EXISTS wf_runtime.node_instance (
    id_node_instance      uuid          NOT NULL DEFAULT gen_random_uuid(),
    process_instance_id   uuid          NOT NULL,
    node_id               uuid          NOT NULL,
    status                varchar(16)   NOT NULL DEFAULT 'active',
    entered_at            timestamptz   NOT NULL DEFAULT now(),
    completed_at          timestamptz   NULL,
    sequence_number       integer       NOT NULL,
    error_message         text          NULL,
    created_at            timestamptz   NOT NULL DEFAULT now(),
    updated_at            timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT pk_node_instance PRIMARY KEY (id_node_instance),
    CONSTRAINT fk_node_instance_process_instance
        FOREIGN KEY (process_instance_id) REFERENCES wf_runtime.process_instance (id_process_instance)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_node_instance_node
        FOREIGN KEY (node_id) REFERENCES wf_meta.nodes (id_node)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_node_instance_status CHECK (status IN ('active', 'completed', 'failed')),
    CONSTRAINT ck_node_instance_terminal_consistency CHECK (
        (status = 'active' AND completed_at IS NULL)
        OR (status <> 'active' AND completed_at IS NOT NULL)
    ),
    CONSTRAINT uq_node_instance_sequence UNIQUE (process_instance_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS ix_node_instance_process_instance
    ON wf_runtime.node_instance (process_instance_id, sequence_number);
CREATE INDEX IF NOT EXISTS ix_node_instance_node
    ON wf_runtime.node_instance (node_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_node_instance_one_active_per_process
    ON wf_runtime.node_instance (process_instance_id) WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_node_instance_updated_at ON wf_runtime.node_instance;
CREATE TRIGGER trg_node_instance_updated_at
    BEFORE UPDATE ON wf_runtime.node_instance
    FOR EACH ROW EXECUTE FUNCTION wf_runtime.touch_updated_at();

-- ============================================================
-- Tabla context_variable_value (wf_runtime)
-- ============================================================
CREATE TABLE IF NOT EXISTS wf_runtime.context_variable_value (
    id_context_variable_value  uuid          NOT NULL DEFAULT gen_random_uuid(),
    process_instance_id        uuid          NOT NULL,
    variable_id                varchar(64)   NOT NULL,
    variable_name              varchar(128)  NOT NULL,
    data_type                  varchar(32)   NOT NULL,
    value                      jsonb         NULL,
    set_by_node_instance_id    uuid          NULL,
    set_at                     timestamptz   NOT NULL DEFAULT now(),
    created_at                 timestamptz   NOT NULL DEFAULT now(),
    updated_at                 timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT pk_context_variable_value PRIMARY KEY (id_context_variable_value),
    CONSTRAINT fk_context_variable_value_process_instance
        FOREIGN KEY (process_instance_id) REFERENCES wf_runtime.process_instance (id_process_instance)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_context_variable_value_set_by
        FOREIGN KEY (set_by_node_instance_id) REFERENCES wf_runtime.node_instance (id_node_instance)
        ON DELETE SET NULL ON UPDATE RESTRICT,
    CONSTRAINT uq_context_variable_value_per_instance UNIQUE (process_instance_id, variable_id),
    CONSTRAINT ck_context_variable_value_data_type CHECK (data_type IN (
        'string', 'integer', 'decimal', 'boolean',
        'date', 'datetime', 'uuid', 'json', 'entity_ref'
    ))
);

CREATE INDEX IF NOT EXISTS ix_context_variable_value_process_instance
    ON wf_runtime.context_variable_value (process_instance_id);
CREATE INDEX IF NOT EXISTS ix_context_variable_value_process_instance_name
    ON wf_runtime.context_variable_value (process_instance_id, variable_name);
CREATE INDEX IF NOT EXISTS ix_context_variable_value_value_gin
    ON wf_runtime.context_variable_value USING gin (value jsonb_path_ops);

DROP TRIGGER IF EXISTS trg_context_variable_value_updated_at ON wf_runtime.context_variable_value;
CREATE TRIGGER trg_context_variable_value_updated_at
    BEFORE UPDATE ON wf_runtime.context_variable_value
    FOR EACH ROW EXECUTE FUNCTION wf_runtime.touch_updated_at();

-- ============================================================
-- Tabla task (wf_runtime)
-- ============================================================
CREATE TABLE IF NOT EXISTS wf_runtime.task (
    id_task               uuid          NOT NULL DEFAULT gen_random_uuid(),
    node_instance_id      uuid          NOT NULL,
    process_instance_id   uuid          NOT NULL,
    form_definition_id    uuid          NOT NULL,
    assigned_to           uuid          NULL,
    assigned_role         varchar(64)   NULL,
    status                varchar(16)   NOT NULL DEFAULT 'pending',
    title                 varchar(255)  NOT NULL,
    created_at            timestamptz   NOT NULL DEFAULT now(),
    claimed_at            timestamptz   NULL,
    completed_at          timestamptz   NULL,
    completed_by          uuid          NULL,
    submitted_data        jsonb         NULL,
    updated_at            timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT pk_task PRIMARY KEY (id_task),
    CONSTRAINT fk_task_node_instance
        FOREIGN KEY (node_instance_id) REFERENCES wf_runtime.node_instance (id_node_instance)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_task_process_instance
        FOREIGN KEY (process_instance_id) REFERENCES wf_runtime.process_instance (id_process_instance)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_task_form_definition
        FOREIGN KEY (form_definition_id) REFERENCES wf_meta.metadata (id_object)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT uq_task_node_instance UNIQUE (node_instance_id),
    CONSTRAINT ck_task_status CHECK (status IN ('pending', 'claimed', 'completed', 'cancelled')),
    CONSTRAINT ck_task_terminal_consistency CHECK (
        (status IN ('pending', 'claimed') AND completed_at IS NULL)
        OR (status IN ('completed', 'cancelled') AND completed_at IS NOT NULL)
    ),
    CONSTRAINT ck_task_claimed_consistency CHECK (
        (status = 'claimed' AND claimed_at IS NOT NULL)
        OR (status <> 'claimed')
    )
);

CREATE INDEX IF NOT EXISTS ix_task_assigned_to_pending
    ON wf_runtime.task (assigned_to) WHERE status IN ('pending', 'claimed');
CREATE INDEX IF NOT EXISTS ix_task_assigned_role_pending
    ON wf_runtime.task (assigned_role) WHERE status IN ('pending', 'claimed') AND assigned_role IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_task_process_instance
    ON wf_runtime.task (process_instance_id);
CREATE INDEX IF NOT EXISTS ix_task_status_pending
    ON wf_runtime.task (created_at) WHERE status = 'pending';

CREATE OR REPLACE FUNCTION wf_runtime.assert_form_id_is_form()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    parent_type text;
BEGIN
    SELECT object_type INTO parent_type
    FROM wf_meta.metadata WHERE id_object = NEW.form_definition_id;
    IF parent_type IS DISTINCT FROM 'form_definition' THEN
        RAISE EXCEPTION 'task.form_definition_id (%) does not reference a form_definition (object_type=%)',
            NEW.form_definition_id, COALESCE(parent_type, '<not found>');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_assert_form ON wf_runtime.task;
CREATE TRIGGER trg_task_assert_form
    BEFORE INSERT OR UPDATE OF form_definition_id ON wf_runtime.task
    FOR EACH ROW EXECUTE FUNCTION wf_runtime.assert_form_id_is_form();

DROP TRIGGER IF EXISTS trg_task_updated_at ON wf_runtime.task;
CREATE TRIGGER trg_task_updated_at
    BEFORE UPDATE ON wf_runtime.task
    FOR EACH ROW EXECUTE FUNCTION wf_runtime.touch_updated_at();

-- ============================================================
-- Tabla de control de versiones del schema
-- ============================================================
CREATE TABLE IF NOT EXISTS wf_meta.schema_version (
    version       integer      NOT NULL,
    applied_at    timestamptz  NOT NULL DEFAULT now(),
    description   text         NULL,
    CONSTRAINT pk_schema_version PRIMARY KEY (version)
);

INSERT INTO wf_meta.schema_version (version, description)
VALUES
    (1, 'Initial schema v1.0 (wf_meta: metadata, attributes, nodes)'),
    (2, 'Runtime tables v1.1 (wf_runtime: process_instance, node_instance, context_variable_value, task)')
ON CONFLICT (version) DO NOTHING;
```

## 10.3 Inserción inicial de `root_project`

Después del bootstrap, el orquestador inserta la fila única de `root_project`:

```sql
INSERT INTO wf_meta.metadata (object_name, object_type, content, parent)
VALUES (
    'root',
    'root_project',
    jsonb_build_object(
        'description', '<descripción provista por el operador>',
        'version', 1,
        'mode', 'greenfield',
        'tags', '[]'::jsonb
    ),
    NULL
);
```

A partir de este momento la BD está lista para que la aplicación cree `entity`, `process_definition`, etc.

---

# 11. Estrategia de versionado y migración

## 11.1 Principios

**M1 — El schema es versionado.** Existe una tabla `wf_meta.schema_version` (declarada en §10.2) que registra las versiones aplicadas. v1.1 deja las versiones 1 (diseño) y 2 (runtime básico) aplicadas.

**M2 — Cada cambio de schema es una migración numerada.** No se modifica un script existente: se crea uno nuevo (`migration_002_*.sql`, `migration_003_*.sql`, ...) que aplica el delta y registra su número en `schema_version`.

**M3 — Las migraciones son idempotentes en la medida de lo posible.** Usar `IF NOT EXISTS`, `IF EXISTS`, `ON CONFLICT DO NOTHING`. Las migraciones que no pueden ser idempotentes (data fixups) verifican antes de aplicar.

**M4 — Las migraciones se aplican en orden estricto.** El orquestador lee `schema_version`, identifica la última versión aplicada, y aplica las migraciones pendientes en orden ascendente. Nunca se salta una migración.

**M5 — Multi-tenant: las migraciones se aplican a TODOS los proyectos.** Una migración se considera completada cuando se ha aplicado a la BD central de admin (cuando exista) Y a todas las BDs de proyecto registradas. La herramienta de orquestación (no especificada aquí) garantiza esto.

## 11.2 Estructura de un archivo de migración

```sql
-- migration_NNN_<descripcion>.sql
-- Aplica el cambio del schema de la versión (NNN-1) a la versión NNN.

BEGIN;

-- 1. Verificación previa
DO $$
BEGIN
    IF (SELECT MAX(version) FROM wf_meta.schema_version) <> NNN - 1 THEN
        RAISE EXCEPTION 'Cannot apply migration NNN: previous version is not NNN-1';
    END IF;
END $$;

-- 2. Cambios de schema
ALTER TABLE wf_meta.metadata ADD COLUMN new_column ...;
-- ...

-- 3. Data fixup si aplica

-- 4. Registrar versión
INSERT INTO wf_meta.schema_version (version, description)
VALUES (NNN, '<descripción del cambio>');

COMMIT;
```

## 11.3 Herramienta de migraciones

**Decisión diferida al SRS de Backend.** Las opciones razonables son:

- **EF Core Migrations** (idiomático en .NET, pero opaco con DDL crudo y JSONB).
- **FluentMigrator** (más explícito, mejor control de SQL crudo).
- **SQL puro versionado** (archivos `.sql` numerados, aplicados por un script .NET propio o herramientas como `dbup`, `Roundhouse`).

Cualquiera de los tres es viable con el contrato definido aquí (`schema_version`, idempotencia, numeración). La elección final se documenta en el SRS de Backend.

## 11.4 Migraciones que requieren cambiar el catálogo de `object_type` o `node_type`

Si una versión futura añade un nuevo `object_type` (por ejemplo, `rule`), la migración debe:

1. Alterar el CHECK constraint:
   ```sql
   ALTER TABLE wf_meta.metadata DROP CONSTRAINT ck_metadata_object_type;
   ALTER TABLE wf_meta.metadata ADD CONSTRAINT ck_metadata_object_type
       CHECK (object_type IN ('root_project', 'entity', 'form_definition',
                              'process_definition', 'template', 'rule'));
   ```
2. No se elimina valor existente; solo se añaden.

Si en una versión futura se decide eliminar un valor del catálogo, la migración debe primero verificar que no haya filas con ese valor (o migrarlas) antes de alterar el CHECK.

## 11.5 Migración de datos vs. migración de schema

Las migraciones de **schema** son cambios DDL (añadir columna, índice, constraint). Las migraciones de **datos** transforman filas existentes (ej. rellenar una nueva columna a partir de las existentes). Ambas viven en archivos numerados consecutivos; la mezcla en un solo archivo es aceptable si el cambio lo requiere lógicamente (añadir columna NOT NULL exige migrar datos antes de aplicar el NOT NULL).

---

# 12. Consideraciones de rendimiento

## 12.1 Carga de árbol completo de proyecto

La consulta más frecuente del backend es "dame todo el árbol del proyecto P". Con los índices definidos, esta operación es:

```sql
-- 1 query para metadata completa
SELECT * FROM wf_meta.metadata ORDER BY object_type, parent, object_name;

-- 1 query para todos los attributes
SELECT * FROM wf_meta.attributes ORDER BY entity_id, ordinal;

-- 1 query para todos los nodes
SELECT * FROM wf_meta.nodes ORDER BY process_id, name;
```

Tres queries planas, sin joins. La hidratación se hace en aplicación. Para un proyecto típico (50 entidades, 500 atributos, 20 procesos, 100 nodos), las tres queries devuelven menos de 700 filas en total y se ejecutan en milisegundos.

## 12.2 Hidratación selectiva

Para `GET /api/processes/{id}`:

```sql
-- 1 query: el proceso
SELECT * FROM wf_meta.metadata
WHERE id_object = $1 AND object_type = 'process_definition';

-- 1 query: sus nodos (usa ix_nodes_process)
SELECT * FROM wf_meta.nodes
WHERE process_id = $1 ORDER BY name;

-- 1 query: los form_definitions referenciados por human_task del proceso
-- (se construye en aplicación a partir de los form_ref encontrados en config)
SELECT * FROM wf_meta.metadata
WHERE id_object = ANY($form_ids) AND object_type = 'form_definition';
```

## 12.3 Consultas por JSONB

Para buscar "todas las entidades cuyo `source` es `vacation_request`":

```sql
SELECT * FROM wf_meta.metadata
WHERE object_type = 'entity'
  AND content @> '{"source": "vacation_request"}';
```

Usa `ix_metadata_content_gin` (operador `@>`).

Para validar VR-13 (atributo referenciado en algún `FormField`):

```sql
SELECT 1 FROM wf_meta.metadata
WHERE object_type = 'form_definition'
  AND content @> jsonb_build_object(
      'fields', jsonb_build_array(
          jsonb_build_object('attribute_ref', $attr_id::text)
      )
  )
LIMIT 1;
```

El índice GIN cubre esta búsqueda eficientemente.

## 12.4 Concurrencia y optimistic locking

Cada artefacto incluye `updated_at`. El patrón de UPDATE con optimistic locking es:

```sql
UPDATE wf_meta.metadata
SET content = $1::jsonb,
    object_name = $2
WHERE id_object = $3
  AND updated_at = $4;  -- el updated_at que el cliente leyó

-- Si rowcount = 0: el registro fue modificado por otro proceso desde la lectura.
```

La aplicación debe contar las filas afectadas y reportar conflicto cuando es 0. Detalle del manejo en SRS de Backend.

## 12.5 Lo que NO está optimizado en v1.1

- **Búsquedas full-text** sobre `description` o `content`. Si se vuelven necesarias, se añade columna `tsvector` generada y un índice GIN sobre ella.
- **Particionado** de `metadata` o `attributes`. Innecesario para los volúmenes esperados (<1000 entidades, <10.000 atributos por proyecto).
- **Caché de árbol hidratado**. Si la latencia se vuelve un problema, se cachea en el backend (Redis o memoria), no en BD.

Decisiones de optimización adicional se toman cuando métricas reales lo justifiquen.

## 12.6 Acceso a runtime

Las consultas dominantes del motor en cada paso de ejecución son:

```sql
-- Cargar instancia + nodo activo + contexto (al recibir submit de tarea)
SELECT * FROM wf_runtime.process_instance WHERE id_process_instance = $1;
SELECT * FROM wf_runtime.node_instance
WHERE process_instance_id = $1 AND status = 'active';  -- usa uq_node_instance_one_active_per_process
SELECT * FROM wf_runtime.context_variable_value
WHERE process_instance_id = $1;  -- usa ix_context_variable_value_process_instance

-- Bandeja de tareas del usuario
SELECT t.*, pi.process_definition_id
FROM wf_runtime.task t
JOIN wf_runtime.process_instance pi ON pi.id_process_instance = t.process_instance_id
WHERE t.assigned_to = $user_id AND t.status IN ('pending', 'claimed')
ORDER BY t.created_at DESC;  -- usa ix_task_assigned_to_pending
```

Todas son consultas por índice, sin scans secuenciales. Para volúmenes esperados en MVP (cientos de instancias activas, miles de tareas, decenas de miles de `node_instance` históricas), los tiempos están en milisegundos.

Para volúmenes mayores en versiones futuras se considerará:

- **Particionado de `node_instance` por mes** (tabla de mayor crecimiento).
- **Archivado de `process_instance` completadas** a un schema `wf_runtime_archive`.
- **Caché del nodo activo de una instancia** en Redis (al ser una sola fila por instancia, cachear directamente ahorra una query por cada interacción de tarea).

Ninguna de estas optimizaciones se implementa en v1.1; se documentan para que cuando lleguen métricas reales se sepa qué probar primero.

---

# 13. Verificación post-bootstrap

Después de aplicar el bootstrap (§10.2), las siguientes consultas deben retornar los resultados esperados. Sirven como prueba de humo para confirmar que la BD está sana.

```sql
-- 1. Schemas existen
SELECT schema_name FROM information_schema.schemata
WHERE schema_name IN ('wf_meta', 'wf_runtime');
-- Esperado: 2 filas.

-- 2. Tablas de wf_meta existen
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'wf_meta'
ORDER BY table_name;
-- Esperado: attributes, metadata, nodes, schema_version (4 filas).

-- 3. Tablas de wf_runtime existen
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'wf_runtime'
ORDER BY table_name;
-- Esperado: context_variable_value, node_instance, process_instance, task (4 filas).

-- 4. Versión del schema
SELECT version FROM wf_meta.schema_version ORDER BY version DESC LIMIT 1;
-- Esperado: 2 (última versión aplicada en v1.1).

-- 5. Funciones touch_updated_at existen (una por schema)
SELECT n.nspname || '.' || p.proname AS fqn
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'touch_updated_at'
ORDER BY fqn;
-- Esperado: wf_meta.touch_updated_at, wf_runtime.touch_updated_at (2 filas).

-- 6. Constraint del catálogo de object_type está activo
INSERT INTO wf_meta.metadata (object_name, object_type, parent)
VALUES ('test', 'invalid_type', NULL);
-- Esperado: error por ck_metadata_object_type.

-- 7. Singleton de root_project
INSERT INTO wf_meta.metadata (object_name, object_type, parent)
VALUES ('root1', 'root_project', NULL);
INSERT INTO wf_meta.metadata (object_name, object_type, parent)
VALUES ('root2', 'root_project', NULL);
-- Esperado: el segundo INSERT falla por uq_metadata_root_project_singleton.

-- 8. Singleton de node_instance activo por instancia
-- (requiere haber creado al menos una process_instance y un node_instance activo;
--  se omite aquí porque depende de datos previos)
```

---

# 14. Glosario

| Término | Definición |
| --- | --- |
| BD de proyecto | Base de datos PostgreSQL dedicada a un proyecto de Workflow Platform. Contiene los schemas `wf_meta` (diseño), `wf_runtime` (ejecución) y `public` (negocio). |
| Schema `wf_meta` | Schema operativo donde residen las tablas del metamodelo de diseño: `metadata`, `attributes`, `nodes`, `schema_version`. |
| Schema `wf_runtime` | Schema operativo donde reside el estado de ejecución del motor: `process_instance`, `node_instance`, `context_variable_value`, `task`. |
| Schema `public` | Schema donde residen las tablas del negocio (greenfield: creadas por la plataforma; brownfield: existentes). |
| `process_instance` | Una ejecución concreta de un `process_definition`. |
| `node_instance` | Registro de paso por un nodo dentro de una `process_instance`. |
| `context_variable_value` | Valor actual de una variable del contexto de una `process_instance`. |
| `task` | Tarea pendiente de ser completada por un humano. Asociada a una `node_instance` de tipo `human_task`. |
| Bootstrap | Script idempotente que lleva una BD vacía al estado del schema v1.1 (§10.2). |
| Migración | Cambio numerado del schema que lleva la BD de la versión N-1 a la versión N. Registrado en `wf_meta.schema_version`. |
| Constraint declarativo | Regla impuesta a nivel SQL (CHECK, UNIQUE, FK, NOT NULL) que la BD garantiza sin intervención de la aplicación. |
| Trigger | Función que se dispara antes/después de INSERT/UPDATE/DELETE en una tabla. En v1.1 se usan triggers `BEFORE INSERT/UPDATE` para tipo de padre, integridad de form_definition referenciado por task, y actualización de `updated_at`. |
| Índice GIN | Tipo de índice de PostgreSQL óptimo para consultas sobre JSONB y arrays. Usado en `content`, `config`, `metadata` de atributos, y `value` de variables de contexto. |
| Optimistic locking | Patrón de control de concurrencia donde el UPDATE incluye una condición sobre `updated_at`; si el rowcount es 0, otro proceso modificó el registro. |
| `gen_random_uuid()` | Función de la extensión `pgcrypto` que genera UUIDs v4. Default de todas las PKs. |
| Schema version | Tabla `wf_meta.schema_version` que registra qué migraciones se han aplicado. v1.1 corresponde a versión 2 (versión 1 = diseño, versión 2 = runtime básico). |
| Regla VR-NN | Regla de validación de **diseño** definida en Definición de Metadata §8 (numeradas VR-01 a VR-41). |
| Regla RT-NN | Regla de validación de **runtime** definida en §6.7 de este documento (RT-01 a RT-14). |

---

# 15. Historial de versiones

| Versión | Fecha | Descripción |
| --- | --- | --- |
| 1.0 | Mayo 2026 | Versión inicial del Modelo de Datos Físico para Workflow Platform. Traduce a DDL ejecutable de PostgreSQL 16+ las tablas del schema `wf_meta` definidas conceptualmente en la Definición de Metadata v1.0: `metadata` (genérica para artefactos), `attributes` (dedicada), `nodes` (dedicada), más la tabla de control `schema_version`. Especifica tipos exactos, constraints (PK, FK, UNIQUE, CHECK, índices únicos parciales), índices (B-tree y GIN), triggers (validación de tipo de padre y `updated_at`), defaults y secuencias. Materializa en BD las reglas VR-02, VR-04, VR-05, VR-10, VR-12, VR-15, VR-25 y VR-40 de la Definición de Metadata; documenta cuáles otras quedan en aplicación y por qué. Incluye script bootstrap idempotente para crear una BD nueva de proyecto, plantilla de migraciones numeradas, y consideraciones de rendimiento. Deja explícitamente fuera de alcance la BD central de administración, las tablas de runtime, y la elección de herramienta concreta de migración (EF Core / FluentMigrator / SQL puro), que se decide en SRS de Backend. |
| 1.1 | Mayo 2026 | Añade el schema `wf_runtime` con cuatro tablas para soportar el **runtime básico del MVP** (`start → human_task → end`): `process_instance` (ancla de ejecución con snapshot de versión y estados running/completed/failed/cancelled), `node_instance` (ledger de paso por nodos con sequence_number monotónico y singleton de nodo activo por instancia vía índice único parcial), `context_variable_value` (valores actuales de contexto con denormalización de variable_name y data_type para lecturas baratas), y `task` (tareas humanas con ciclo pending/claimed/completed/cancelled, asignación por user o role, y persistencia del submitted_data). Define 14 reglas de runtime (RT-01 a RT-14): cuáles se materializan en BD (RT-03 singleton de activo, RT-05 unicidad task por node_instance, RT-07/RT-09 restricciones de delete sobre process_definition y form_definition con instancias/tareas, RT-08 cascadas dentro del runtime) y cuáles en aplicación (RT-01/RT-02 rechazo de nodos y condiciones no soportadas en MVP, RT-04 snapshot de versión, RT-10/RT-11/RT-12/RT-13/RT-14 transiciones de estado y validaciones de payload). Incluye trigger `assert_form_id_is_form` análogo a los existentes para `attributes` y `nodes`. Actualiza el script bootstrap idempotente para crear ambos schemas (`wf_meta` + `wf_runtime`) en una sola pasada y registra las versiones 1 y 2 en `schema_version`. Aclara en §1.3 que la BD central de administración pertenece a un **proyecto desacoplado** de Workflow Platform, no a una versión futura del mismo proyecto: el SRS del Catálogo Administrativo v1.0 queda como trabajo de referencia pero fuera del MVP. Restringe explícitamente el motor MVP a procesos sin `exclusive_gateway`, `script_task` ni transiciones con `condition`: el diseñador permite crearlos y se persisten en BD sin restricción, pero el motor los rechaza al instanciar con `422 unsupported_node_type` o `422 unsupported_transition_condition`. La habilitación de esos elementos en runtime se planifica para v1.2. |

*— Fin del documento —*

Confidencial · Mayo 2026 · Workflow Platform · Modelo de Datos Físico v1.1
