# SRS — CATÁLOGO ADMINISTRATIVO

**Workflow Platform**

*BD central `workflow_platform_admin`: customers, projects, users, sessions, connections, templates*

Mayo 2026 · v1.0 · Confidencial — Documento interno

---

# 1. Introducción

## 1.1 Propósito

Este documento especifica el **Catálogo Administrativo** de Workflow Platform: el subsistema responsable de orquestar el modelo multi-tenant, autenticar usuarios y administrar el ciclo de vida de proyectos. Su artefacto físico es una base de datos PostgreSQL llamada **`workflow_platform_admin`**, distinta y central respecto a las BDs de proyecto.

El documento cubre:

- Requisitos funcionales del subsistema (FR).
- Modelo de datos físico de la BD `workflow_platform_admin` (DDL ejecutable).
- Reglas de negocio y constraints.
- Endpoints REST del API administrativo.
- Modelo de autenticación, autorización y sesiones.
- Requisitos no funcionales (NFR).

Es la pieza que el resto de la plataforma asume como prerequisito: sin Catálogo Administrativo no hay forma de crear un proyecto, autenticar a un usuario, ni resolver qué BD usar para una petición.

## 1.2 Audiencia

- **Equipo de Backend**, que implementa los endpoints, la lógica de auth y el orquestador de creación de proyectos.
- **Operador de la plataforma** (`project_admin`), que entiende el alcance de sus permisos y el flujo de creación de proyectos.
- **Equipo de Frontend**, que consume el API administrativo desde las pantallas de login, listado de proyectos, gestión de usuarios.

## 1.3 Alcance

| Incluido en v1.0 | Fuera de alcance |
| --- | --- |
| BD central `workflow_platform_admin`: customers, projects, users, project_members, sessions, refresh_tokens, sso_identities, templates. | BDs de proyecto (cubiertas por Definición de Metadata v1.0 y Modelo de Datos Físico v1.0). |
| Autenticación local (email + password con hash bcrypt). | Autenticación con factor adicional (2FA, TOTP, hardware keys). |
| SSO opcional con Google y Microsoft (OAuth 2.0 / OpenID Connect). | Otros proveedores SSO (Okta, Auth0, SAML genérico). |
| Sesiones con JWT short-lived (15 min) + refresh token (7 días). | Sesiones long-lived, "remember me" persistente. |
| Roles globales: `project_admin`, `user`. | Roles configurables por el cliente. |
| Roles por proyecto: `admin`, `designer`, `viewer`. | Roles granulares por módulo (entity_designer, process_designer, etc.). |
| Creación, listado y eliminación lógica de proyectos. | Edición masiva, archivado avanzado, exportación de proyectos. |
| Biblioteca compartida de templates (catálogo central). | Marketplace, ratings, versionado avanzado de templates. |
| Endpoints REST administrativos (`/admin/*`). | Webhooks de eventos administrativos. |
| Auditoría básica (`created_at`, `updated_at`, `last_login_at`). | Audit log completo de cambios (quién modificó qué y cuándo). |

## 1.4 Documentos de referencia

| Documento | Versión | Propiedad sobre |
| --- | --- | --- |
| Workflow Platform — Documento de Visión | 1.0 | Multi-tenancy por BD, modelo de negocio, criterios de éxito. |
| Workflow Platform — Definición de Metadata | 1.0 | Metamodelo de proyecto. Este documento se conecta con `metadata.id_object` del root_project de cada BD de proyecto. |
| Workflow Platform — Modelo de Datos Físico | 1.0 | Define qué se aplica al crear una BD nueva de proyecto. Este documento orquesta esa creación. |
| Workflow Platform — UX Spec | 1.0 | Pantallas de login, selector de proyecto, gestión de usuarios. |

## 1.5 Convenciones

- Bloques `sql` ejecutables sobre PostgreSQL 16+.
- Endpoints REST listados como `MÉTODO /ruta`.
- Reglas de negocio numeradas como **AR-NN** (Admin Rule).
- Requisitos funcionales numerados como **FR-NN**.

---

# 2. Visión del subsistema

## 2.1 Posición en la arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    Workflow Platform                         │
│                                                              │
│  ┌───────────────────────────┐    ┌──────────────────────┐  │
│  │  workflow_platform_admin  │    │  BD proyecto 1       │  │
│  │  (BD central)             │    │  (wf_meta + public)  │  │
│  │                           │    └──────────────────────┘  │
│  │  - customers              │                              │
│  │  - projects ──────────────┼────► (apunta a 1..N BDs)    │
│  │  - users                  │    ┌──────────────────────┐  │
│  │  - project_members        │    │  BD proyecto 2       │  │
│  │  - sessions               │    │  (wf_meta + public)  │  │
│  │  - refresh_tokens         │    └──────────────────────┘  │
│  │  - sso_identities         │                              │
│  │  - templates              │            ...               │
│  └───────────────────────────┘                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

La BD central es **única** en la instalación. Las BDs de proyecto son **N** y se crean dinámicamente. La BD central conoce dónde vive cada BD de proyecto (`connection_string` en `projects`).

## 2.2 Principios

**AP1 — Una sola BD administrativa por instalación.** No hay multi-tenancy en el catálogo: todos los customers, projects, users comparten la misma BD central. Esto simplifica enormemente la operación.

**AP2 — Los `customers` agrupan proyectos, no usuarios.** Un `customer` representa una organización contratante (ej. "ACME Corp"). Tiene N proyectos, pero los usuarios viven en una tabla plana global, no debajo del customer. En MVP no hay aislamiento de usuarios por customer.

**AP3 — Los usuarios se asignan directo a proyectos.** La tabla `project_members` registra la relación `(user_id, project_id, role)`. Un usuario puede estar en N proyectos, cada uno con un rol potencialmente distinto.

**AP4 — Roles globales mínimos.** Solo dos: `project_admin` (puede crear/eliminar proyectos) y `user` (solo accede a proyectos donde lo asignen). Sin combinaciones, sin permisos finos a nivel global.

**AP5 — JWT short-lived + refresh.** Acceso vía JWT de 15 min. Renovación vía refresh token opaco de 7 días. El refresh se invalida en logout y rotación obligatoria en cada uso.

**AP6 — Eliminación lógica para entidades con dependencias.** `customers` y `projects` usan soft delete (`deleted_at`). `users` también, para preservar referencias en `project_members` y auditoría.

---

# 3. Actores y roles

## 3.1 Roles globales

| Rol | Descripción | Permisos clave |
| --- | --- | --- |
| `project_admin` | Operador de plataforma. Es parte del equipo interno de Workflow Platform o del operador comercial. | Crear/eliminar customers, crear/eliminar proyectos, asignar usuarios a proyectos, gestionar templates de la biblioteca central, listar todos los proyectos. |
| `user` | Usuario regular. Cualquier persona que use Workflow Platform pero no opere la plataforma. | Iniciar sesión, acceder a los proyectos donde está asignado, ejercer su rol dentro de cada proyecto. |

## 3.2 Roles por proyecto

Definidos en la tabla `project_members.role`. Aplican únicamente dentro del contexto de un proyecto.

| Rol | Permisos dentro del proyecto |
| --- | --- |
| `admin` | Todo lo que puede `designer` + invitar/remover otros usuarios del proyecto, cambiar su rol. NO puede eliminar el proyecto (eso es prerrogativa de `project_admin` global). |
| `designer` | Crear/editar/eliminar entidades, formularios, procesos, templates del proyecto. Leer todo. |
| `viewer` | Solo lectura del metamodelo del proyecto. No puede modificar nada. Útil para auditoría, revisión, onboarding. |

## 3.3 Combinaciones

Un `project_admin` global tiene acceso implícito de `admin` a cualquier proyecto que cree (queda registrado en `project_members` al crear). Si pierde el rol global, mantiene su acceso por proyecto vía `project_members`.

## 3.4 Tabla resumen de permisos por endpoint

Esta tabla se detalla por endpoint en §6. Aquí solo el esquema:

| Acción | `project_admin` global | `admin` del proyecto | `designer` del proyecto | `viewer` del proyecto |
| --- | --- | --- | --- | --- |
| Listar todos los proyectos | ✅ todos | ❌ | ❌ | ❌ |
| Listar mis proyectos | ✅ | ✅ | ✅ | ✅ |
| Crear proyecto | ✅ | ❌ | ❌ | ❌ |
| Eliminar proyecto | ✅ | ❌ | ❌ | ❌ |
| Invitar usuario al proyecto | ✅ | ✅ | ❌ | ❌ |
| Cambiar rol de miembro | ✅ | ✅ | ❌ | ❌ |
| Crear/editar metadata en el proyecto | (vía rol de proyecto) | ✅ | ✅ | ❌ |
| Leer metadata del proyecto | (vía rol de proyecto) | ✅ | ✅ | ✅ |

---

# 4. Requisitos funcionales

## 4.1 Autenticación

- **FR-01 [Auth/Local]:** El sistema deberá permitir registro de un usuario nuevo con email único y password. El password se persiste con hash bcrypt (cost ≥ 12). El registro queda en estado `pending` hasta que el `project_admin` lo active.
- **FR-02 [Auth/Local]:** El sistema deberá permitir login con email + password. En éxito, emite un JWT de acceso (15 min) y un refresh token opaco (7 días). En fallo, responde 401 sin distinguir entre "email no existe" y "password incorrecto".
- **FR-03 [Auth/Local]:** El sistema deberá bloquear temporalmente la cuenta tras 5 intentos fallidos consecutivos en 15 minutos. Bloqueo de 15 minutos. Se registra en `users.locked_until`.
- **FR-04 [Auth/SSO]:** El sistema deberá soportar SSO con Google y Microsoft vía OAuth 2.0 / OpenID Connect. En primer login SSO, si el email no existe en `users`, se crea automáticamente en estado `pending` (igual que registro local).
- **FR-05 [Auth/SSO]:** El sistema deberá vincular múltiples identidades SSO (Google + Microsoft) al mismo `user` si comparten email verificado. Tabla `sso_identities`.
- **FR-06 [Auth/Sesión]:** El sistema deberá renovar el JWT de acceso a partir de un refresh token válido. La renovación **rota** el refresh token: el anterior se invalida y se emite uno nuevo. Si se recibe un refresh token ya rotado (uso doble), se invalidan todos los refresh tokens del usuario por seguridad.
- **FR-07 [Auth/Sesión]:** El sistema deberá soportar logout que invalida el refresh token presentado. El JWT de acceso expira por sí solo en ≤ 15 min.
- **FR-08 [Auth/Sesión]:** El JWT deberá contener: `sub` (user_id), `email`, `global_role`, `iat`, `exp`, `jti`. No contiene la lista de proyectos del usuario (eso se resuelve por endpoint, no cabe en el token).

## 4.2 Gestión de customers

- **FR-09 [Customer]:** Un `project_admin` deberá poder crear un customer con `name` único, `description` opcional, `contact_email` opcional.
- **FR-10 [Customer]:** Un `project_admin` deberá poder listar customers, filtrar por nombre, paginar.
- **FR-11 [Customer]:** Un `project_admin` deberá poder eliminar (soft delete) un customer **solo si no tiene proyectos activos**. Si tiene, la API responde 409 con la lista de proyectos bloqueantes.
- **FR-12 [Customer]:** No es posible reactivar un customer eliminado en MVP. Se decide en próxima versión si se añade endpoint de undelete.

## 4.3 Gestión de proyectos

- **FR-13 [Project]:** Un `project_admin` deberá poder crear un proyecto asociado a un customer. Datos requeridos: `customer_id`, `name` (único dentro del customer), `description`, `mode` (`greenfield` o `brownfield`).
- **FR-14 [Project/Bootstrap]:** Al crear un proyecto, el sistema deberá ejecutar de forma transaccional (con rollback completo si alguna falla):
  1. Insertar fila en `projects` con estado `provisioning`.
  2. `CREATE DATABASE` con el naming `wf_{customer_slug}_{project_slug}_{short_uuid}`.
  3. Aplicar el script bootstrap del Modelo de Datos Físico v1.0 §9.2 a la BD recién creada.
  4. Insertar la fila `root_project` (Modelo de Datos Físico §9.3) con `description` y `mode` provistos.
  5. Guardar el `connection_string` cifrado en `projects.connection_string_encrypted`.
  6. Insertar al `project_admin` que creó el proyecto en `project_members` con rol `admin`.
  7. Cambiar estado a `active`.
- **FR-15 [Project/Bootstrap]:** Si cualquier paso de FR-14 falla, el sistema deberá hacer rollback: eliminar la BD si llegó a crearse (`DROP DATABASE`) y eliminar la fila de `projects`. Se registra el error y se responde 500 al cliente.
- **FR-16 [Project]:** Un `project_admin` deberá poder listar todos los proyectos (con paginación, filtro por customer, filtro por estado).
- **FR-17 [Project]:** Un usuario regular deberá poder listar **solo** sus proyectos (aquellos donde es miembro). Endpoint distinto: `GET /admin/me/projects`.
- **FR-18 [Project]:** Un `project_admin` deberá poder eliminar (soft delete) un proyecto. La BD física **no se elimina** automáticamente en MVP: queda marcada como `deleted` en `projects` y la BD queda intacta hasta limpieza manual. (Decisión de seguridad: evitar pérdida accidental de datos del cliente).
- **FR-19 [Project]:** Un proyecto en estado `deleted` no aparece en ningún listado por defecto. Los miembros pierden acceso. El endpoint de hidratación de metadata del proyecto responde 404.

## 4.4 Gestión de miembros del proyecto

- **FR-20 [Member]:** Un `admin` de proyecto (o `project_admin` global) deberá poder invitar a un usuario existente al proyecto con un rol (`admin`, `designer`, `viewer`).
- **FR-21 [Member]:** Un `admin` de proyecto deberá poder cambiar el rol de un miembro existente, excepto el suyo propio (para evitar quedarse sin admins).
- **FR-22 [Member]:** Un `admin` de proyecto deberá poder remover a un miembro del proyecto, excepto el último `admin`. Si solo queda un `admin`, no se permite removerlo ni cambiarle el rol; debe primero promoverse a otro.
- **FR-23 [Member]:** Un usuario removido de un proyecto pierde acceso inmediato. Sus JWTs siguen siendo válidos hasta su expiración natural (≤ 15 min), pero el backend valida pertenencia en cada request al endpoint de proyecto.

## 4.5 Gestión de usuarios

- **FR-24 [User]:** Un `project_admin` deberá poder listar todos los usuarios, filtrar por email, estado, rol global.
- **FR-25 [User]:** Un `project_admin` deberá poder activar un usuario en estado `pending`, desactivar uno activo, o eliminarlo (soft delete).
- **FR-26 [User]:** Un usuario activo deberá poder ver y editar su propio perfil (nombre, foto). No puede cambiar su email ni su rol global; eso lo hace `project_admin`.
- **FR-27 [User]:** Un usuario deberá poder cambiar su password proveyendo el actual. Si usa SSO exclusivamente, no tiene password local: el endpoint responde 400 indicándolo.

## 4.6 Templates (biblioteca central compartida)

- **FR-28 [Template]:** Un `project_admin` deberá poder publicar un template en la biblioteca central. Un template es un snapshot exportado de uno o más artefactos de un proyecto (`entity`, `form_definition`, `process_definition`, o combinaciones).
- **FR-29 [Template]:** Cualquier usuario con acceso a un proyecto deberá poder listar los templates disponibles y aplicarlos a su proyecto. La aplicación consiste en insertar copias de los artefactos con nuevos UUIDs en la BD del proyecto destino.
- **FR-30 [Template]:** Un template está versionado: cada `publish` incrementa la versión. Las versiones anteriores quedan disponibles. La aplicación toma la última versión por defecto, salvo que se pida explícitamente otra.
- **FR-31 [Template]:** Un `project_admin` deberá poder retirar un template (lo marca como `deprecated`, ya no aparece en listados por defecto pero sigue siendo aplicable).

## 4.7 Sesiones y refresh tokens

- **FR-32 [Session]:** El sistema deberá persistir cada refresh token emitido con: `user_id`, `token_hash` (no el token plano), `issued_at`, `expires_at`, `rotated_at` (NULL si vigente), `replaced_by` (FK al siguiente token si fue rotado).
- **FR-33 [Session]:** Al cerrar sesión, el refresh token presentado se marca con `rotated_at = now()` y `replaced_by = NULL`.
- **FR-34 [Session]:** Si un refresh token ya rotado se intenta usar de nuevo, se asume robo: todos los refresh tokens del usuario se invalidan inmediatamente. Se registra el evento.

## 4.8 Conexiones a BDs de proyecto

- **FR-35 [Connection]:** El `connection_string` de cada BD de proyecto se persiste cifrado en `projects.connection_string_encrypted` con AES-256-GCM. La clave maestra de cifrado vive en variables de entorno del backend (no en BD).
- **FR-36 [Connection]:** El backend deberá descifrar el connection string solo al momento de abrir una conexión a la BD del proyecto. No se loguea, no se devuelve por API.
- **FR-37 [Connection]:** Si la clave maestra cambia (rotación), todos los `connection_string_encrypted` deben re-cifrarse vía script administrativo. No se documenta el procedimiento aquí; entra en runbook operacional.

---

# 5. Modelo de datos físico — BD `workflow_platform_admin`

## 5.1 Prerequisitos

PostgreSQL 16+, extensiones `pgcrypto` y `citext`.

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
```

`citext` se usa para emails (case-insensitive).

## 5.2 Schema

```sql
CREATE SCHEMA IF NOT EXISTS admin;
ALTER DATABASE workflow_platform_admin SET search_path = admin;
```

## 5.3 Tabla `customers`

```sql
CREATE TABLE admin.customers (
    id_customer    uuid          NOT NULL DEFAULT gen_random_uuid(),
    name           varchar(255)  NOT NULL,
    slug           varchar(64)   NOT NULL,
    description    text          NULL,
    contact_email  citext        NULL,
    created_at     timestamptz   NOT NULL DEFAULT now(),
    updated_at     timestamptz   NOT NULL DEFAULT now(),
    deleted_at     timestamptz   NULL,

    CONSTRAINT pk_customers PRIMARY KEY (id_customer),
    CONSTRAINT uq_customers_slug UNIQUE (slug),
    CONSTRAINT ck_customers_slug_format
        CHECK (slug ~ '^[a-z][a-z0-9_-]{0,62}$')
);

CREATE INDEX ix_customers_deleted_at ON admin.customers (deleted_at);
CREATE INDEX ix_customers_name ON admin.customers (lower(name));
```

**Decisiones:**

- `slug` es el identificador URL-safe usado para construir el nombre de la BD de proyecto (`wf_{customer_slug}_{project_slug}_{short_uuid}`).
- `name` y `slug` son independientes: el name puede tener mayúsculas, espacios y tildes; el slug es ASCII puro.
- `deleted_at` permite soft delete. Listados filtran `WHERE deleted_at IS NULL` por defecto.
- `contact_email` es opcional. Si se necesita notificar al customer (ej. cuando un proyecto está cerca de un límite), se usa este.

## 5.4 Tabla `projects`

```sql
CREATE TABLE admin.projects (
    id_project                    uuid          NOT NULL DEFAULT gen_random_uuid(),
    customer_id                   uuid          NOT NULL,
    name                          varchar(255)  NOT NULL,
    slug                          varchar(64)   NOT NULL,
    description                   text          NULL,
    mode                          varchar(16)   NOT NULL DEFAULT 'greenfield',
    status                        varchar(16)   NOT NULL DEFAULT 'provisioning',
    database_name                 varchar(63)   NOT NULL,
    connection_string_encrypted   bytea         NOT NULL,
    created_by                    uuid          NOT NULL,
    created_at                    timestamptz   NOT NULL DEFAULT now(),
    updated_at                    timestamptz   NOT NULL DEFAULT now(),
    deleted_at                    timestamptz   NULL,

    CONSTRAINT pk_projects PRIMARY KEY (id_project),
    CONSTRAINT fk_projects_customer
        FOREIGN KEY (customer_id) REFERENCES admin.customers (id_customer)
        ON DELETE RESTRICT,
    CONSTRAINT fk_projects_created_by
        FOREIGN KEY (created_by) REFERENCES admin.users (id_user)
        ON DELETE RESTRICT,
    CONSTRAINT uq_projects_customer_slug UNIQUE (customer_id, slug),
    CONSTRAINT uq_projects_database_name UNIQUE (database_name),
    CONSTRAINT ck_projects_mode
        CHECK (mode IN ('greenfield', 'brownfield')),
    CONSTRAINT ck_projects_status
        CHECK (status IN ('provisioning', 'active', 'suspended', 'deleted')),
    CONSTRAINT ck_projects_slug_format
        CHECK (slug ~ '^[a-z][a-z0-9_-]{0,62}$')
);

CREATE INDEX ix_projects_customer ON admin.projects (customer_id);
CREATE INDEX ix_projects_status ON admin.projects (status);
CREATE INDEX ix_projects_deleted_at ON admin.projects (deleted_at);
```

**Decisiones:**

- `database_name` (varchar 63): PostgreSQL limita nombres de BD a 63 caracteres. Patrón: `wf_{customer_slug}_{project_slug}_{8_chars_uuid}`.
- `connection_string_encrypted` (bytea): contiene cifrado AES-256-GCM del connection string completo incluyendo IV y tag. Formato exacto definido en SRS de Backend.
- `status='provisioning'` inicial, pasa a `active` solo al final del bootstrap exitoso. Si falla, se elimina la fila (no se queda en `provisioning` huérfano).
- `status='suspended'` reservado para futuras pausas administrativas (no expirado, no eliminado).
- `mode` solo es informativo aquí; la lógica vive en el `root_project` de la BD del proyecto.
- `ON DELETE RESTRICT` sobre `customer_id`: no se puede eliminar un customer con proyectos activos (refuerza FR-11).

## 5.5 Tabla `users`

```sql
CREATE TABLE admin.users (
    id_user           uuid          NOT NULL DEFAULT gen_random_uuid(),
    email             citext        NOT NULL,
    password_hash     varchar(255)  NULL,
    full_name         varchar(255)  NULL,
    avatar_url        text          NULL,
    global_role       varchar(32)   NOT NULL DEFAULT 'user',
    status            varchar(16)   NOT NULL DEFAULT 'pending',
    failed_attempts   integer       NOT NULL DEFAULT 0,
    locked_until      timestamptz   NULL,
    last_login_at     timestamptz   NULL,
    created_at        timestamptz   NOT NULL DEFAULT now(),
    updated_at        timestamptz   NOT NULL DEFAULT now(),
    deleted_at        timestamptz   NULL,

    CONSTRAINT pk_users PRIMARY KEY (id_user),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_global_role
        CHECK (global_role IN ('project_admin', 'user')),
    CONSTRAINT ck_users_status
        CHECK (status IN ('pending', 'active', 'disabled'))
);

CREATE INDEX ix_users_deleted_at ON admin.users (deleted_at);
CREATE INDEX ix_users_status ON admin.users (status);
```

**Decisiones:**

- `email` es `citext` y UNIQUE: comparación case-insensitive nativa.
- `password_hash` puede ser NULL: usuarios que se registraron solo vía SSO no tienen password local. El login local responde 401 ("invalid credentials") si `password_hash IS NULL`.
- `failed_attempts` y `locked_until` implementan FR-03 (bloqueo por intentos). El campo se resetea a 0 en cada login exitoso.
- `global_role='user'` por defecto. La promoción a `project_admin` solo la hace otro `project_admin` (bootstrap manual del primer admin vía script SQL, ver §9).
- `status='pending'` inicial; pasa a `active` cuando un `project_admin` aprueba. En SSO, queda igual en `pending` hasta aprobación (regla AR-08).

## 5.6 Tabla `sso_identities`

```sql
CREATE TABLE admin.sso_identities (
    id_sso_identity    uuid          NOT NULL DEFAULT gen_random_uuid(),
    user_id            uuid          NOT NULL,
    provider           varchar(32)   NOT NULL,
    provider_user_id   varchar(255)  NOT NULL,
    email_at_provider  citext        NOT NULL,
    raw_profile        jsonb         NOT NULL DEFAULT '{}'::jsonb,
    created_at         timestamptz   NOT NULL DEFAULT now(),
    updated_at         timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT pk_sso_identities PRIMARY KEY (id_sso_identity),
    CONSTRAINT fk_sso_identities_user
        FOREIGN KEY (user_id) REFERENCES admin.users (id_user)
        ON DELETE CASCADE,
    CONSTRAINT uq_sso_identities_provider_subject UNIQUE (provider, provider_user_id),
    CONSTRAINT ck_sso_identities_provider
        CHECK (provider IN ('google', 'microsoft'))
);

CREATE INDEX ix_sso_identities_user ON admin.sso_identities (user_id);
```

**Decisiones:**

- `provider_user_id` es el `sub` que devuelve el proveedor OIDC. Único por proveedor.
- Un mismo usuario puede tener una identidad por proveedor (1 Google + 1 Microsoft), no dos del mismo.
- `raw_profile` JSONB guarda el último claim recibido del proveedor (debugging, futuras integraciones).
- `ON DELETE CASCADE`: si se elimina el usuario, sus identidades SSO se borran.

## 5.7 Tabla `project_members`

```sql
CREATE TABLE admin.project_members (
    id_project_member   uuid          NOT NULL DEFAULT gen_random_uuid(),
    project_id          uuid          NOT NULL,
    user_id             uuid          NOT NULL,
    role                varchar(16)   NOT NULL,
    invited_by          uuid          NULL,
    invited_at          timestamptz   NOT NULL DEFAULT now(),
    accepted_at         timestamptz   NULL,

    CONSTRAINT pk_project_members PRIMARY KEY (id_project_member),
    CONSTRAINT fk_project_members_project
        FOREIGN KEY (project_id) REFERENCES admin.projects (id_project)
        ON DELETE CASCADE,
    CONSTRAINT fk_project_members_user
        FOREIGN KEY (user_id) REFERENCES admin.users (id_user)
        ON DELETE CASCADE,
    CONSTRAINT fk_project_members_invited_by
        FOREIGN KEY (invited_by) REFERENCES admin.users (id_user)
        ON DELETE SET NULL,
    CONSTRAINT uq_project_members_unique UNIQUE (project_id, user_id),
    CONSTRAINT ck_project_members_role
        CHECK (role IN ('admin', 'designer', 'viewer'))
);

CREATE INDEX ix_project_members_user ON admin.project_members (user_id);
CREATE INDEX ix_project_members_project ON admin.project_members (project_id);
```

**Decisiones:**

- `accepted_at` NULL = invitación pendiente. En MVP la "invitación" es directa (al invitar, el usuario tiene acceso inmediato si ya existe), entonces `accepted_at = invited_at`. Se deja la columna para soportar flujo de invitación con confirmación en versiones futuras.
- `ON DELETE CASCADE` en project y user: si se elimina cualquiera, las filas de membresía se borran.
- `invited_by` con `ON DELETE SET NULL`: si el invitador se elimina, no se cascada la membresía del invitado.
- UNIQUE `(project_id, user_id)`: un usuario no puede tener dos roles en el mismo proyecto.

## 5.8 Tabla `refresh_tokens`

```sql
CREATE TABLE admin.refresh_tokens (
    id_refresh_token    uuid          NOT NULL DEFAULT gen_random_uuid(),
    user_id             uuid          NOT NULL,
    token_hash          varchar(255)  NOT NULL,
    issued_at           timestamptz   NOT NULL DEFAULT now(),
    expires_at          timestamptz   NOT NULL,
    rotated_at          timestamptz   NULL,
    replaced_by         uuid          NULL,
    revoked_at          timestamptz   NULL,
    revoked_reason      varchar(64)   NULL,
    user_agent          text          NULL,
    ip_address          inet          NULL,

    CONSTRAINT pk_refresh_tokens PRIMARY KEY (id_refresh_token),
    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id) REFERENCES admin.users (id_user)
        ON DELETE CASCADE,
    CONSTRAINT fk_refresh_tokens_replaced_by
        FOREIGN KEY (replaced_by) REFERENCES admin.refresh_tokens (id_refresh_token)
        ON DELETE SET NULL,
    CONSTRAINT uq_refresh_tokens_hash UNIQUE (token_hash)
);

CREATE INDEX ix_refresh_tokens_user ON admin.refresh_tokens (user_id);
CREATE INDEX ix_refresh_tokens_expires ON admin.refresh_tokens (expires_at)
    WHERE rotated_at IS NULL AND revoked_at IS NULL;
```

**Decisiones:**

- `token_hash`: el refresh token plano se entrega al cliente una sola vez. En BD solo vive su hash SHA-256 (no necesita bcrypt: es una cadena aleatoria de alta entropía, hash rápido es suficiente).
- `rotated_at` + `replaced_by` traquean la cadena de rotación. Si el cliente presenta un token con `rotated_at IS NOT NULL`, se detecta reuso (FR-34).
- `revoked_at` y `revoked_reason` para invalidación administrativa (logout global, detección de robo).
- `user_agent` e `ip_address` opcionales: ayudan a diagnosticar y a mostrar "tus sesiones activas" en versiones futuras.
- Índice parcial sobre `expires_at` filtra solo tokens vigentes; eficiente para limpieza periódica.

## 5.9 Tabla `templates`

```sql
CREATE TABLE admin.templates (
    id_template       uuid          NOT NULL DEFAULT gen_random_uuid(),
    name              varchar(255)  NOT NULL,
    slug              varchar(64)   NOT NULL,
    description       text          NULL,
    category          varchar(64)   NULL,
    version           integer       NOT NULL,
    content           jsonb         NOT NULL,
    status            varchar(16)   NOT NULL DEFAULT 'active',
    published_by      uuid          NOT NULL,
    published_at      timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT pk_templates PRIMARY KEY (id_template),
    CONSTRAINT fk_templates_published_by
        FOREIGN KEY (published_by) REFERENCES admin.users (id_user)
        ON DELETE RESTRICT,
    CONSTRAINT uq_templates_slug_version UNIQUE (slug, version),
    CONSTRAINT ck_templates_status
        CHECK (status IN ('active', 'deprecated')),
    CONSTRAINT ck_templates_slug_format
        CHECK (slug ~ '^[a-z][a-z0-9_-]{0,62}$'),
    CONSTRAINT ck_templates_version_positive
        CHECK (version >= 1)
);

CREATE INDEX ix_templates_slug ON admin.templates (slug);
CREATE INDEX ix_templates_status ON admin.templates (status);
CREATE INDEX ix_templates_content_gin ON admin.templates USING gin (content jsonb_path_ops);
```

**Decisiones:**

- `slug` + `version` UNIQUE: el slug es estable, la versión incrementa. Listado por defecto muestra la mayor `version` de cada slug.
- `content` (JSONB): contiene la metadata exportada del proyecto origen. Estructura interna: `{ "exported_at": "...", "source_project": "...", "artifacts": { "entities": [...], "forms": [...], "processes": [...] } }`. El formato exacto se documenta en el SRS de Backend (export/import).
- `category` opcional para futura organización en UI (HR, Finance, Operations, ...).
- `status='deprecated'` esconde de listados por defecto pero permite seguir aplicando (FR-31).

## 5.10 Tabla `schema_version`

Análoga a la de la BD de proyecto.

```sql
CREATE TABLE admin.schema_version (
    version       integer      NOT NULL,
    applied_at    timestamptz  NOT NULL DEFAULT now(),
    description   text         NULL,
    CONSTRAINT pk_admin_schema_version PRIMARY KEY (version)
);

INSERT INTO admin.schema_version (version, description)
VALUES (1, 'Initial schema v1.0 for workflow_platform_admin')
ON CONFLICT (version) DO NOTHING;
```

## 5.11 Trigger genérico `updated_at`

```sql
CREATE OR REPLACE FUNCTION admin.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON admin.customers
    FOR EACH ROW EXECUTE FUNCTION admin.touch_updated_at();
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON admin.projects
    FOR EACH ROW EXECUTE FUNCTION admin.touch_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON admin.users
    FOR EACH ROW EXECUTE FUNCTION admin.touch_updated_at();
CREATE TRIGGER trg_sso_identities_updated_at BEFORE UPDATE ON admin.sso_identities
    FOR EACH ROW EXECUTE FUNCTION admin.touch_updated_at();
```

`templates`, `refresh_tokens` y `project_members` no usan `updated_at` (son más bien append-only o tienen su propio modelo de evolución).

---

# 6. Endpoints REST del API administrativo

Base: `/admin`. Todos los endpoints (salvo `/auth/*`) requieren Authorization Bearer con JWT válido. Errores siguen el formato definido en SRS de Backend.

## 6.1 Autenticación

| Método | Ruta | Propósito | Quién |
| --- | --- | --- | --- |
| POST | `/auth/register` | Registro local (queda `pending`) | público |
| POST | `/auth/login` | Login local | público |
| GET | `/auth/sso/{provider}` | Inicia flujo OAuth | público |
| GET | `/auth/sso/{provider}/callback` | Callback OAuth | público |
| POST | `/auth/refresh` | Renueva access token, rota refresh | requiere refresh token válido |
| POST | `/auth/logout` | Invalida refresh token actual | autenticado |
| POST | `/auth/change-password` | Cambia password (requiere actual) | autenticado |

## 6.2 Customers

| Método | Ruta | Propósito | Quién |
| --- | --- | --- | --- |
| GET | `/customers` | Lista customers | `project_admin` |
| POST | `/customers` | Crea customer | `project_admin` |
| GET | `/customers/{id}` | Detalle | `project_admin` |
| PATCH | `/customers/{id}` | Edita name/description/contact_email | `project_admin` |
| DELETE | `/customers/{id}` | Soft delete (si sin proyectos activos) | `project_admin` |

## 6.3 Projects

| Método | Ruta | Propósito | Quién |
| --- | --- | --- | --- |
| GET | `/projects` | Lista todos los proyectos | `project_admin` |
| POST | `/projects` | Crea proyecto (incluye bootstrap BD) | `project_admin` |
| GET | `/projects/{id}` | Detalle | `project_admin` o miembro |
| PATCH | `/projects/{id}` | Edita name/description | `project_admin` o `admin` del proyecto |
| DELETE | `/projects/{id}` | Soft delete | `project_admin` |
| GET | `/me/projects` | Lista MIS proyectos | autenticado |

## 6.4 Miembros del proyecto

| Método | Ruta | Propósito | Quién |
| --- | --- | --- | --- |
| GET | `/projects/{id}/members` | Lista miembros del proyecto | `admin` del proyecto, `project_admin` |
| POST | `/projects/{id}/members` | Invita usuario (existente) con rol | `admin` del proyecto, `project_admin` |
| PATCH | `/projects/{id}/members/{user_id}` | Cambia rol | `admin` del proyecto, `project_admin` |
| DELETE | `/projects/{id}/members/{user_id}` | Remueve del proyecto | `admin` del proyecto, `project_admin` |

## 6.5 Users

| Método | Ruta | Propósito | Quién |
| --- | --- | --- | --- |
| GET | `/users` | Lista usuarios | `project_admin` |
| GET | `/users/{id}` | Detalle | `project_admin` |
| PATCH | `/users/{id}` | Edita global_role/status | `project_admin` |
| DELETE | `/users/{id}` | Soft delete | `project_admin` |
| GET | `/me` | Mi perfil | autenticado |
| PATCH | `/me` | Edita full_name/avatar | autenticado |

## 6.6 Templates

| Método | Ruta | Propósito | Quién |
| --- | --- | --- | --- |
| GET | `/templates` | Lista templates activos (última versión) | autenticado |
| GET | `/templates/{slug}/versions` | Versiones de un template | autenticado |
| GET | `/templates/{id}` | Detalle | autenticado |
| POST | `/templates` | Publica nueva versión | `project_admin` |
| POST | `/templates/{id}/deprecate` | Marca deprecated | `project_admin` |
| POST | `/projects/{id}/apply-template` | Aplica template al proyecto | `admin` o `designer` del proyecto |

---

# 7. User Stories y criterios de aceptación

## 7.1 Autenticación local

**US-01.** Como nuevo usuario, quiero registrarme con email + password para acceder a la plataforma.

- *Acceptance Criteria:*
  1. **Given** no existe ningún usuario con email `ana@acme.com`, **When** POST `/auth/register` con email y password válidos, **Then** se crea el usuario con `status='pending'` y la API responde 201 con el id del usuario.
  2. **Given** ya existe un usuario con ese email, **When** POST `/auth/register`, **Then** la API responde 409 sin filtrar información sobre el usuario existente (mensaje genérico "email no disponible").
  3. **Given** el password no cumple requisitos (mínimo 10 caracteres, al menos un número), **When** POST `/auth/register`, **Then** la API responde 400 indicando la regla violada.

**US-02.** Como usuario activo, quiero iniciar sesión con email + password para obtener acceso a mis proyectos.

- *Acceptance Criteria:*
  1. **Given** existe un usuario activo con email `ana@acme.com` y password correcto, **When** POST `/auth/login` con credenciales válidas, **Then** la API responde 200 con `access_token` (JWT 15 min) y `refresh_token` (string 7 días), y se actualiza `last_login_at`.
  2. **Given** existe un usuario pero el password es incorrecto, **When** POST `/auth/login`, **Then** la API responde 401 con mensaje genérico "credenciales inválidas" y `failed_attempts` incrementa en 1.
  3. **Given** un usuario con 4 intentos fallidos previos, **When** un 5° intento fallido en 15 min, **Then** la cuenta se bloquea (`locked_until = now() + 15 min`), la API responde 423 ("account locked").
  4. **Given** un usuario en estado `pending` o `disabled`, **When** intenta login, **Then** la API responde 401 con mensaje genérico (no revelar el estado exacto).

## 7.2 SSO

**US-03.** Como usuario nuevo con cuenta corporativa de Google, quiero iniciar sesión vía SSO sin crear contraseña local.

- *Acceptance Criteria:*
  1. **Given** no existe ningún usuario con email `juan@acme.com`, **When** completo el flujo OAuth de Google y vuelvo al callback, **Then** se crea un `user` con `password_hash IS NULL`, `status='pending'`, y una entrada en `sso_identities` con `provider='google'`.
  2. **Given** existe un usuario activo `juan@acme.com` que se registró previamente con password local, **When** completo SSO con Google con email `juan@acme.com` verificado por Google, **Then** se vincula la identidad SSO al usuario existente (no se crea un usuario duplicado) y se inicia sesión.
  3. **Given** un usuario con identidad SSO Google ya activa, **When** intenta SSO con Microsoft con mismo email verificado, **Then** se añade segunda identidad SSO al mismo usuario.

## 7.3 Creación de proyecto

**US-04.** Como `project_admin`, quiero crear un proyecto nuevo asociado a un customer para empezar a diseñar su metamodelo.

- *Acceptance Criteria:*
  1. **Given** soy `project_admin` y existe el customer "ACME Corp", **When** POST `/projects` con `customer_id`, `name="HR Workflows"`, `mode="greenfield"`, **Then** la API responde 201, se crea la BD física `wf_acme_corp_hr_workflows_<8chars>`, se aplica el bootstrap del Modelo de Datos Físico, se inserta `root_project`, y quedo registrado como `admin` del proyecto.
  2. **Given** el bootstrap falla a mitad (ej. el INSERT de `root_project` falla), **When** se ejecuta el rollback, **Then** la BD se elimina, la fila en `projects` se elimina, y la API responde 500 con un correlation_id para diagnóstico.
  3. **Given** ya existe un proyecto con slug `hr-workflows` en el mismo customer, **When** intento crear otro con mismo nombre, **Then** la API responde 409 ("project name already in use").
  4. **Given** no soy `project_admin`, **When** POST `/projects`, **Then** la API responde 403.

## 7.4 Gestión de miembros

**US-05.** Como `admin` de un proyecto, quiero invitar a un colega `designer` para que diseñe el modelo conmigo.

- *Acceptance Criteria:*
  1. **Given** soy `admin` del proyecto P, existe el usuario `colega@acme.com` activo y no es miembro de P, **When** POST `/projects/P/members` con `user_id` y `role='designer'`, **Then** la API responde 201 y `colega@acme.com` puede acceder al proyecto con permisos de designer.
  2. **Given** soy `admin` y `colega@acme.com` ya es miembro de P, **When** intento agregarlo de nuevo, **Then** la API responde 409 ("user is already a member").
  3. **Given** soy `viewer` (no `admin`) del proyecto, **When** intento invitar a alguien, **Then** la API responde 403.

**US-06.** Como `admin` único de un proyecto, no debo poder removerme a mí mismo ni bajarme de rol sin antes promover a otro.

- *Acceptance Criteria:*
  1. **Given** soy el único `admin` del proyecto P, **When** intento DELETE `/projects/P/members/me`, **Then** la API responde 409 ("cannot remove last admin").
  2. **Given** soy el único `admin`, **When** intento PATCH cambiando mi rol a `designer`, **Then** la API responde 409 ("cannot demote last admin").
  3. **Given** soy uno de dos `admin`, **When** intento removerme, **Then** la API responde 200.

## 7.5 Refresh y rotación

**US-07.** Como cliente con un access token expirado, quiero renovar mi sesión usando el refresh token sin tener que volver a loguearme.

- *Acceptance Criteria:*
  1. **Given** tengo un refresh token vigente, **When** POST `/auth/refresh` con ese token, **Then** la API responde 200 con un nuevo `access_token` y un nuevo `refresh_token`; el anterior queda marcado con `rotated_at`.
  2. **Given** tengo un refresh token ya rotado (uso doble por error o ataque), **When** POST `/auth/refresh`, **Then** la API responde 401 e invalida todos los refresh tokens del usuario (`revoked_at = now()`, `revoked_reason = 'reuse_detected'`).
  3. **Given** tengo un refresh token expirado (>7 días), **When** POST `/auth/refresh`, **Then** la API responde 401 ("refresh token expired").

## 7.6 Eliminación con dependencias

**US-08.** Como `project_admin`, no debo poder eliminar un customer que tiene proyectos activos sin antes resolverlos.

- *Acceptance Criteria:*
  1. **Given** el customer C tiene 2 proyectos activos, **When** DELETE `/customers/C`, **Then** la API responde 409 con la lista `[ {id: P1, name: "..."}, {id: P2, name: "..."} ]` de bloqueantes.
  2. **Given** el customer C no tiene proyectos activos (ninguno o todos deleted), **When** DELETE `/customers/C`, **Then** la API responde 200 y `deleted_at = now()`.

## 7.7 Aplicación de template

**US-09.** Como `designer` de un proyecto, quiero aplicar un template de la biblioteca central para arrancar con un modelo predefinido.

- *Acceptance Criteria:*
  1. **Given** existe el template `hr-vacation-request` v3 activo y soy `designer` del proyecto P, **When** POST `/projects/P/apply-template` con `template_slug='hr-vacation-request'`, **Then** los artefactos del template se insertan en P con nuevos UUIDs (no colisionan con existentes), y la API responde 200 con un resumen de qué se creó.
  2. **Given** algún artefacto del template tendría conflicto de nombre con uno existente en P (ej. ya existe una entidad `vacation_request`), **When** aplico el template, **Then** la API responde 409 con la lista de conflictos.
  3. **Given** soy `viewer` del proyecto, **When** intento aplicar un template, **Then** la API responde 403.

---

# 8. Reglas de negocio (AR — Admin Rules)

Reglas que el backend debe imponer; las que pueden materializarse como constraints están marcadas con ✅.

| ID | Regla | Materializada en BD |
| --- | --- | --- |
| **AR-01** | El email es UNIQUE (case-insensitive). | ✅ `uq_users_email` (citext) |
| **AR-02** | El `global_role` solo puede ser `project_admin` o `user`. | ✅ CHECK |
| **AR-03** | El `status` del usuario solo puede ser `pending`, `active`, `disabled`. | ✅ CHECK |
| **AR-04** | El slug de customer y de proyecto cumple `^[a-z][a-z0-9_-]{0,62}$`. | ✅ CHECK |
| **AR-05** | El slug de proyecto es único dentro del customer. | ✅ `uq_projects_customer_slug` |
| **AR-06** | El `database_name` de proyecto es único globalmente. | ✅ `uq_projects_database_name` |
| **AR-07** | El `role` en `project_members` solo puede ser `admin`, `designer`, `viewer`. | ✅ CHECK |
| **AR-08** | Un usuario nuevo (local o SSO) queda `pending` hasta que un `project_admin` lo active. | ❌ aplicación |
| **AR-09** | Un proyecto no se puede eliminar mientras está en `provisioning`. | ❌ aplicación |
| **AR-10** | No se puede eliminar al último `admin` de un proyecto. | ❌ aplicación (consulta antes del DELETE) |
| **AR-11** | No se puede eliminar un customer con proyectos activos. | ❌ aplicación |
| **AR-12** | El `password_hash` solo es NULL si el usuario tiene al menos una `sso_identity`. | ❌ aplicación |
| **AR-13** | El usuario que crea un proyecto se agrega automáticamente como `admin` en `project_members`. | ❌ aplicación (parte del flujo de creación) |
| **AR-14** | Un refresh token rotado no puede usarse de nuevo: detección de robo. | ❌ aplicación |
| **AR-15** | El JWT contiene `sub`, `email`, `global_role`, `iat`, `exp`, `jti`. No contiene lista de proyectos. | ❌ aplicación |
| **AR-16** | Al login exitoso, `failed_attempts = 0` y `locked_until = NULL`. | ❌ aplicación |
| **AR-17** | Un usuario `disabled` o `pending` no puede loguearse, sin importar credenciales correctas. | ❌ aplicación |
| **AR-18** | Las versiones de template son monotónicas dentro del mismo slug. | ❌ aplicación (al publicar, version = MAX + 1) |
| **AR-19** | Los proyectos en estado `deleted` no aparecen en listados por defecto. | ❌ aplicación (filtros en query) |
| **AR-20** | El `connection_string_encrypted` no se devuelve nunca por API. | ❌ aplicación (excluir de DTOs) |

---

# 9. Bootstrap inicial de la plataforma

Cuando se instala Workflow Platform por primera vez, la BD `workflow_platform_admin` debe inicializarse y debe existir al menos un `project_admin` para empezar a operar.

## 9.1 Script de inicialización

```sql
-- 1. Crear la BD central (ejecutado por DBA)
CREATE DATABASE workflow_platform_admin
    WITH ENCODING = 'UTF8'
         LC_COLLATE = 'en_US.UTF-8'
         LC_CTYPE = 'en_US.UTF-8'
         TEMPLATE template0;

-- 2. Conectar a workflow_platform_admin y aplicar el DDL completo de §5.
--    (script idempotente, igual patrón que el bootstrap de BD de proyecto).

-- 3. Crear el primer project_admin manualmente
INSERT INTO admin.users (
    email, password_hash, full_name, global_role, status
) VALUES (
    'admin@example.com',
    '<bcrypt hash generado externamente>',
    'Platform Admin',
    'project_admin',
    'active'
);
```

El paso 3 se hace una sola vez. A partir de ahí, ese `project_admin` puede activar a otros usuarios y promoverlos.

## 9.2 Verificación post-bootstrap

```sql
-- Schema existe
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'admin';

-- Tablas creadas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'admin' ORDER BY table_name;
-- Esperado: customers, projects, project_members, refresh_tokens,
--           schema_version, sso_identities, templates, users (8 tablas)

-- Versión
SELECT version FROM admin.schema_version ORDER BY version DESC LIMIT 1;
-- Esperado: 1

-- Al menos un project_admin
SELECT COUNT(*) FROM admin.users
WHERE global_role = 'project_admin' AND status = 'active' AND deleted_at IS NULL;
-- Esperado: >= 1
```

---

# 10. Requisitos no funcionales

| Categoría | Requisito |
| --- | --- |
| **Seguridad / passwords** | bcrypt con cost ≥ 12. Passwords nunca en logs, nunca en respuestas API. Política mínima: 10 caracteres, al menos 1 número. |
| **Seguridad / tokens** | JWT firmados con HS256 o RS256, secreto/clave gestionada vía variables de entorno. Refresh tokens son cadenas aleatorias de 256 bits, hash SHA-256 en BD. |
| **Seguridad / connection strings** | Cifrados con AES-256-GCM. Clave maestra en variable de entorno o secret manager. Nunca en logs. |
| **Seguridad / transport** | Todas las APIs admin solo sobre HTTPS (TLS 1.2+). HTTP redirect a HTTPS. |
| **Seguridad / headers** | Respuestas incluyen `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin`. |
| **Seguridad / rate limiting** | `/auth/login` y `/auth/register`: máximo 10 req/min por IP. `/auth/refresh`: máximo 30/min por IP. Otros endpoints: 100 req/min por usuario. |
| **Performance** | Latencia p95 < 200ms para endpoints de auth y consulta. Creación de proyecto puede tardar hasta 5s (incluye CREATE DATABASE + bootstrap). |
| **Performance / queries** | Listado de proyectos hasta 1000 customers/proyectos sin paginar < 500ms. Con paginación (default 50), < 200ms. |
| **Availability** | 99.5% en MVP (≈ 3.6 horas de downtime al mes). Mayor disponibilidad en versiones posteriores. |
| **Auditoría mínima** | Toda fila en `users`, `customers`, `projects` tiene `created_at`, `updated_at`. Logins exitosos actualizan `last_login_at`. |
| **Auditoría / refresh** | `refresh_tokens` registra `user_agent`, `ip_address`, `issued_at` para diagnóstico forense. |
| **Backups** | BD `workflow_platform_admin` con snapshot diario, retención 30 días. Es la BD más crítica de la plataforma. |
| **Compatibilidad** | PostgreSQL 16+. OIDC providers: Google + Microsoft via librerías .NET estándar. |

---

# 11. Integraciones externas

| Sistema | Propósito | Tipo | Notas |
| --- | --- | --- | --- |
| Google OAuth 2.0 / OpenID Connect | SSO con cuentas Google. | OAuth 2.0 / OIDC | Client ID + Secret configurados por variable de entorno. |
| Microsoft Identity Platform (v2.0) | SSO con cuentas Microsoft (Azure AD + personales). | OAuth 2.0 / OIDC | Idem. |
| Servidor de email (SMTP) | Notificaciones de invitación, reset de password, alertas administrativas. | SMTP | **Diferido a post-MVP.** En MVP, las notificaciones se loguean en servidor sin enviar. |

---

# 12. Asumpciones y temas abiertos

- **A-01.** El primer `project_admin` se crea manualmente vía SQL al instalar la plataforma. No hay flujo de "primer setup" automatizado por UI en MVP.
- **A-02.** El reset de password en MVP requiere intervención del `project_admin` (resetea manualmente). El flujo de "olvidé mi contraseña" por email queda diferido (depende del servidor SMTP).
- **A-03.** Las invitaciones a proyecto en MVP requieren que el usuario invitado ya exista en `users`. No hay flujo de "invitar por email a alguien que aún no tiene cuenta" en MVP.
- **A-04.** No hay endpoint para que un `project_admin` "se haga miembro" de un proyecto que él no creó. Si necesita acceso, debe modificar `project_members` directamente o pedirle al `admin` del proyecto que lo invite. Esto se reconsidera en versiones futuras.
- **A-05.** La eliminación física de la BD de un proyecto eliminado es un procedimiento manual operacional. No automatizado en MVP por seguridad.
- **A-06.** La rotación de la clave maestra de cifrado de connection strings es un procedimiento manual documentado en runbook (fuera de este SRS).
- **A-07.** No hay audit log detallado en MVP. Solo se registran timestamps mínimos en cada fila. Audit log completo (quién hizo qué) queda para v1.1.
- **A-08.** No hay capacidad de "impersonar usuario" para soporte en MVP. Se gestiona vía pedido directo al cliente.

---

# 13. Out of scope (v1.0)

- 2FA / TOTP / hardware keys.
- SSO con proveedores adicionales (Okta, Auth0, SAML).
- Self-service password reset por email.
- Invitación a proyecto por email a usuarios que aún no existen.
- Multi-tenancy de usuarios (un usuario aislado a un solo customer).
- Audit log completo (event sourcing de cambios administrativos).
- API keys / service accounts para integraciones programáticas.
- Webhooks de eventos administrativos (usuario creado, proyecto activado, etc.).
- Cuotas y límites por customer (ej. "máximo 10 proyectos").
- Métricas de uso por customer para facturación.
- UI de "primer setup" para crear el primer project_admin.
- Eliminación automática y purga de BDs de proyectos eliminados.
- Roles granulares por módulo dentro de un proyecto.

---

# 14. Historial de versiones

| Versión | Fecha | Descripción |
| --- | --- | --- |
| 1.0 | Mayo 2026 | SRS inicial del Catálogo Administrativo. Define la BD central `workflow_platform_admin` con 8 tablas (customers, projects, users, sso_identities, project_members, refresh_tokens, templates, schema_version), modelo de autenticación dual local + SSO (Google/Microsoft) con JWT short-lived (15 min) + refresh token rotativo (7 días), dos roles globales (`project_admin`, `user`) y tres roles por proyecto (`admin`, `designer`, `viewer`). Especifica 37 requisitos funcionales, 20 reglas de negocio, 9 user stories con criterios de aceptación, endpoints REST bajo `/admin/*`, NFRs de seguridad y performance. Define el flujo transaccional de creación de proyecto (CREATE DATABASE + bootstrap de Modelo de Datos Físico + INSERT root_project + asignación de admin) con rollback completo en fallo. Incluye DDL ejecutable PostgreSQL 16+, biblioteca compartida de templates con versionado por slug, y bootstrap inicial de plataforma (primer project_admin manual). Deja explícitamente fuera de alcance: 2FA, SSO de terceros adicionales, password reset por email, audit log completo, cuotas/facturación, eliminación física automática de BDs, e invitación de usuarios inexistentes. |

*— Fin del documento —*

Confidencial · Mayo 2026 · Workflow Platform · SRS Catálogo Administrativo v1.0