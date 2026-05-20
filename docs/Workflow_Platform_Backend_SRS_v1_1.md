# SRS — BACKEND

**Workflow Platform**

*Servicio HTTP en .NET 9 + Dapper sobre PostgreSQL: API de persistencia, lecturas y runtime básico del motor de workflow*

Mayo 2026 · v1.1 · Confidencial — Documento interno

---

# 1. Introducción

## 1.1 Propósito

Este documento especifica el **servicio backend** del MVP de Workflow Platform: un servicio HTTP construido en **.NET 9** que expone un API minimalista para:

- Persistir y leer metadata de diseño (entidades, atributos, formularios, procesos, nodos).
- Crear físicamente las tablas de negocio en greenfield cuando se diseñan entidades.
- Instanciar procesos y ejecutar el flujo básico `start → human_task → end`.
- Servir la bandeja de tareas y procesar la completitud de tareas humanas.

El backend opera contra una BD PostgreSQL 16+ de un único proyecto (su `connection string` es configuración del deployment). La integración con la BD administrativa (multi-proyecto, autenticación) queda para versiones posteriores, cuando el módulo administrativo se desarrolle como proyecto desacoplado.

## 1.2 Audiencia

- **Equipo de Backend**, como contrato funcional y arquitectónico del servicio a construir.
- **Equipo de Frontend**, como contrato de los endpoints que va a consumir.
- **Operador de deployment**, para entender qué se configura, cómo se levanta y cómo se monitorea.

## 1.3 Alcance

| Incluido en v1.0 | Fuera de alcance |
| --- | --- |
| API HTTP con 8 endpoints (4 de metadata, 4 de runtime). | API GraphQL, gRPC, WebSockets. |
| Endpoint genérico `POST /api/persist` con batch atómico y resolución de alias temporales. | Versionado de API (`/v1`, `/v2`). El API es v1 implícita. |
| Endpoint genérico `GET /api/read` por `object_type` y/o `id`. | Filtros y queries complejas vía URL params (ej. búsqueda full-text, agregaciones). |
| Acceso a datos con **Dapper** (SQL crudo). | EF Core, NHibernate u otros ORMs. |
| Greenfield: creación/alteración dinámica de tablas físicas en `public` con FKs reales al cambiar entidades. | Brownfield (ingesta de schema existente): diferido a v1.2. |
| Motor de runtime básico: `start → human_task → end` con avance vía `System.Threading.Channels` y job de reconciliación al arranque. | `exclusive_gateway`, `script_task`, transiciones con `condition`: el motor las rechaza al instanciar con `422 unsupported_*`. |
| Bandeja de tareas, claim, complete con `submitted_data` validado contra el formulario. | Reasignación de tareas, escalado por timeout, delegación. |
| Logging estructurado, health check, manejo uniforme de errores. | Métricas detalladas (OpenTelemetry, Prometheus), tracing distribuido. |
| Despliegue en un único proceso (sin HA, sin clustering). | Múltiples instancias backend coordinadas (broker externo). |
| Sin autenticación: deploy local controlado, perímetro de confianza. | JWT, SSO, refresh tokens, autorización por proyecto. Pertenece al módulo administrativo (desacoplado). |

## 1.4 Documentos de referencia

| Documento | Versión | Cómo se usa aquí |
| --- | --- | --- |
| Workflow Platform — Documento de Visión | 1.0 | Multi-tenancy por BD, modelo de negocio, posicionamiento. |
| Workflow Platform — Definición de Metadata | 1.0 | Firmas JSON canónicas del `content`, reglas VR-01 a VR-41. Este SRS opera sobre ese metamodelo. |
| Workflow Platform — Modelo de Datos Físico | 1.1 | DDL ejecutable de la BD de proyecto. El backend lee y escribe contra estas tablas exactas. Define también las reglas RT-01 a RT-14 que rigen el runtime. |
| Workflow Platform — UX Spec | 1.0 | Comportamientos del frontend que el backend debe soportar (qué se carga al abrir un módulo, qué se persiste al guardar, etc.). |

## 1.5 Convenciones

- Bloques `csharp` son ilustrativos del diseño, no normativos en su sintaxis exacta.
- Bloques `http` ilustran requests/responses.
- Reglas funcionales numeradas como **BR-NN** (Backend Rule).
- Las reglas VR-NN provienen de Definición de Metadata §8 (validación de diseño).
- Las reglas RT-NN provienen de Modelo de Datos Físico v1.1 §6.7 (validación de runtime).

---

# 2. Visión arquitectónica

## 2.1 Posición del backend

```
┌────────────────────────┐       ┌─────────────────────────┐
│                        │       │                         │
│      Frontend          │──────▶│   Backend (.NET 9)      │
│      (React SPA)       │ HTTP  │   - 1 proceso           │
│                        │ JSON  │   - puerto configurable │
└────────────────────────┘       └────────────┬────────────┘
                                              │
                                              │ Npgsql + Dapper
                                              ▼
                                 ┌─────────────────────────┐
                                 │  PostgreSQL 16+         │
                                 │  BD del proyecto        │
                                 │   - wf_meta             │
                                 │   - wf_runtime          │
                                 │   - public              │
                                 └─────────────────────────┘
```

El backend es el único actor que toca la BD. El frontend nunca se conecta a PostgreSQL.

## 2.2 Principios arquitectónicos

**BA1 — Arquitectura n-capas con features aisladas.** El código se organiza en proyectos .NET independientes con dependencias unidireccionales. Cada feature (Designer, Runtime) vive en su propio scope sin conocer a la otra. Lo transversal (logging, validación, errores) en una capa común.

**BA2 — Dapper directo, sin ORM.** Acceso a BD con SQL crudo, parámetros tipados, mapeo manual a DTOs/entidades. Ventaja: control total, performance predecible, sin sorpresas de generación de queries.

**BA3 — Endpoints minimalistas y opinados.** El API expone 8 endpoints. Dos son genéricos para metadata (`/persist`, `/read`); seis son específicos del runtime. No hay un CRUD REST clásico por recurso porque la unidad natural de cambio es el batch atómico, no la fila aislada.

**BA4 — Atomicidad por defecto.** Toda operación de escritura corre dentro de una transacción PostgreSQL. Si cualquier paso falla, todo se revierte. Los batches son todo-o-nada.

**BA5 — Motor de runtime in-process, persistente en BD, idempotente.** El motor avanza vía `System.Threading.Channels` (cola in-memory). El estado vive en BD. Si el proceso se reinicia, un job de reconciliación al arranque reanuda lo pendiente. No hay broker externo.

**BA6 — Sin autenticación en MVP.** El servicio confía en su perímetro de despliegue. Cuando llegue el módulo administrativo, se introduce un middleware único de identidad sin tocar la lógica de negocio.

## 2.3 Estructura de la solución

```
WorkflowPlatform.sln
└── src/
    ├── WorkflowPlatform.Api/          → ASP.NET Core, endpoints, middlewares, Program.cs
    ├── WorkflowPlatform.Domain/       → Entidades del dominio, interfaces, DTOs, errores
    ├── WorkflowPlatform.Data/         → Repositorios Dapper, conexión, transacciones
    ├── WorkflowPlatform.Queries/      → Librería de clases con todos los queries SQL crudos del sistema (constantes static readonly), organizados por área funcional. Consumida por Data.
    ├── WorkflowPlatform.Designer/     → Feature: lógica del diseñador (persist/read de metadata, greenfield adapter)
    ├── WorkflowPlatform.Runtime/      → Feature: motor de runtime básico
    ├── WorkflowPlatform.Common/       → Cross-cutting: logging, errores, helpers JSONB, validación
    └── WorkflowPlatform.Packages/     → Referencias centralizadas de NuGets (sin código, solo Directory.Build.props o PackageReferences agregadas)
└── tests/
    ├── WorkflowPlatform.Designer.Tests/
    ├── WorkflowPlatform.Runtime.Tests/
    └── WorkflowPlatform.Data.Tests/
```

### Propósito de `WorkflowPlatform.Queries`

Proyecto de librería de clases cuya responsabilidad **exclusiva** es alojar, organizar y versionar todos los queries SQL crudos que Dapper ejecuta contra la BD. Existe para evitar que el SQL quede disperso como strings literales dentro de los métodos de los repositorios — patrón que escala mal a medida que crecen los módulos de diseñador, runtime, greenfield adapter y reconciliación.

Estructura interna por área funcional:

```
WorkflowPlatform.Queries/
├── Meta/
│   ├── MetadataQueries.cs        → queries sobre wf_meta.metadata
│   ├── AttributesQueries.cs      → queries sobre wf_meta.attributes
│   └── NodesQueries.cs           → queries sobre wf_meta.nodes
├── Runtime/
│   ├── ProcessInstanceQueries.cs
│   ├── NodeInstanceQueries.cs
│   ├── ContextVariableQueries.cs
│   └── TaskQueries.cs
└── Greenfield/
    └── GreenfieldDdlQueries.cs   → sentencias DDL dinámicas
```

Cada clase expone constantes o propiedades `static readonly string` con el SQL. Los repositorios en `WorkflowPlatform.Data` importan `WorkflowPlatform.Queries` y consumen las constantes sin repetir texto SQL.

Beneficios:

- **Punto único de auditoría:** un solo lugar donde buscar cualquier query del sistema (debugging, revisiones de schema, code review).
- **Trazabilidad con el DDL:** facilita detectar queries que requieren actualización cuando el schema cambia — búsqueda global sobre un solo proyecto.
- **Versionado conjunto con migraciones:** al aplicar `migration_NNN`, se actualiza el archivo de queries correspondiente en el mismo commit. Schema y SQL evolucionan juntos.
- **Reutilización:** si dos repositorios necesitan el mismo subquery, lo comparten vía constante.
- **`Data` queda enfocado** en lógica de acceso (transacciones, mapeo Dapper, optimistic locking) sin contaminarse con texto SQL embebido.

- **BR-145:** Todo SQL crudo del backend reside en `WorkflowPlatform.Queries`. Los repositorios de `WorkflowPlatform.Data` no contienen strings literales con SQL; consumen exclusivamente las constantes definidas en `Queries`.
- **BR-146:** Cuando una migración del schema modifica una tabla, el commit debe incluir tanto el script de migración como la actualización de las constantes de query afectadas en `Queries`.

### 2.3.1 Dependencias entre proyectos

```
Api ──▶ Designer ──▶ Data ──▶ Queries
   ├──▶ Runtime ───┘    └──▶ Domain
   └──▶ Common ◀────── (todos los demás referencian Common)
         │
         └──▶ Packages ◀──── (centraliza versiones de NuGet)
```

Reglas:

- `Domain` no referencia a nadie (excepto `Common` para tipos compartidos como `Result<T>`).
- `Designer` y `Runtime` no se conocen entre sí.
- `Data` no conoce a `Designer` ni a `Runtime`; expone repositorios genéricos que ambas features consumen vía interfaces de `Domain`.
- `Data` referencia a `Queries` para consumir las constantes SQL; `Queries` no referencia a `Data` ni a ningún otro proyecto del dominio (es una capa de strings sin lógica, solo depende del BCL).
- `Queries` no es referenciado directamente por `Designer`, `Runtime` ni `Api` — el acceso a SQL pasa siempre por la capa `Data` para preservar el encapsulamiento del acceso a datos.
- `Api` es el único que orquesta features.

### 2.3.2 Capa `Packages` (gestión centralizada de NuGets)

`WorkflowPlatform.Packages` es un proyecto de clase vacío cuya función exclusiva es centralizar las versiones de NuGet de toda la solución. Se implementa con **Central Package Management** (`Directory.Packages.props` en la raíz):

```xml
<!-- Directory.Packages.props -->
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="Dapper" Version="2.x" />
    <PackageVersion Include="Npgsql" Version="8.x" />
    <PackageVersion Include="Serilog.AspNetCore" Version="8.x" />
    <PackageVersion Include="FluentValidation" Version="11.x" />
    <!-- etc. -->
  </ItemGroup>
</Project>
```

Cada `.csproj` declara solo `<PackageReference Include="Dapper" />` sin versión. La versión es la única declarada en el archivo central. Esto evita drift de versiones entre proyectos.

## 2.4 Stack tecnológico

| Componente | Tecnología | Razón |
| --- | --- | --- |
| Runtime | .NET 9 | Última versión, performance, soporte de .NET 9 a LTS posterior. |
| Web framework | ASP.NET Core Minimal APIs | Bajo boilerplate, suficiente para 8 endpoints. |
| Acceso a BD | Dapper 2.x + Npgsql 8.x | Decisión BA2. |
| Logging | Serilog estructurado a consola y a archivo | Estándar de la industria, soporta sinks y enriquecedores. |
| Validación | FluentValidation | Validación de DTOs entrantes de forma declarativa. |
| Serialización JSON | `System.Text.Json` (nativo) | Performance, nativo, suficiente. |
| Test framework | xUnit + FluentAssertions | Estándar. |
| Cola interna | `System.Threading.Channels` | BCL, sin dependencia externa. Decisión BA5. |

---

# 3. Configuración y arranque

## 3.1 Variables de entorno y `appsettings.json`

El backend lee configuración de `appsettings.json` (con override por entorno: `appsettings.Development.json`, `appsettings.Production.json`) y de variables de entorno (prefijo `WF_`).

### 3.1.1 Configuración mínima requerida

| Clave | Variable de entorno | Descripción | Default |
| --- | --- | --- | --- |
| `Database:ConnectionString` | `WF_DATABASE_CONNECTIONSTRING` | Connection string PostgreSQL al proyecto. **Obligatorio.** | — |
| `Database:CommandTimeoutSeconds` | `WF_DATABASE_COMMANDTIMEOUTSECONDS` | Timeout por query (excepto migraciones). | 30 |
| `Server:Port` | `WF_SERVER_PORT` | Puerto HTTP. | 5080 |
| `Server:CorsAllowedOrigins` | `WF_SERVER_CORSALLOWEDORIGINS` | Lista separada por comas de orígenes permitidos. | `http://localhost:3000` |
| `Runtime:ReconciliationOnStartup` | `WF_RUNTIME_RECONCILIATIONONSTARTUP` | Si `true`, al arrancar se ejecuta el job de reconciliación del motor. | `true` |
| `Runtime:ChannelCapacity` | `WF_RUNTIME_CHANNELCAPACITY` | Capacidad del canal interno del motor (eventos pendientes). | 1000 |
| `Logging:MinimumLevel` | `WF_LOGGING_MINIMUMLEVEL` | Nivel de Serilog (`Verbose`, `Debug`, `Information`, `Warning`, `Error`, `Fatal`). | `Information` |
| `Logging:FilePath` | `WF_LOGGING_FILEPATH` | Ruta del archivo de log. Si vacío, solo consola. | `` |

### 3.1.2 Reglas de seguridad sobre el connection string

- **BR-01:** El connection string nunca se loguea, en ningún nivel, ni en mensajes de error, ni en stack traces. Se incorpora un sanitizer en el logger que reemplaza patrones `Password=([^;]+)` por `Password=***`.
- **BR-02:** El connection string nunca aparece en ninguna respuesta HTTP, ni siquiera en el endpoint `/api/health`.
- **BR-03:** En la primera apertura de conexión al arranque, si el connection string es inválido o la BD es inalcanzable, el proceso falla con código de salida 1 y un mensaje en consola. No se intenta reintento automático en MVP.

## 3.2 Bootstrap del proceso

### 3.2.1 Secuencia de arranque

1. Cargar configuración (`appsettings.json` + variables de entorno).
2. Inicializar Serilog.
3. Validar configuración mínima (`Database:ConnectionString` no vacío). Si falla, salir con código 1.
4. Abrir una conexión de prueba a PostgreSQL y verificar que el schema `wf_meta` existe y que `schema_version` tiene la versión esperada (≥ 2). Si no, salir con código 1 indicando que la BD no está bootstrapped o desactualizada.
5. Registrar servicios DI: repositorios (`IRepository<T>`), features (`IDesignerService`, `IRuntimeEngine`), motor de runtime (`RuntimeChannel`, `RuntimeWorker`).
6. Construir el host ASP.NET Core, registrar endpoints y middlewares.
7. Si `Runtime:ReconciliationOnStartup = true`, ejecutar el job de reconciliación (ver §6.7).
8. Levantar el listener HTTP en `Server:Port`.
9. Log de arranque exitoso con `pid`, puerto, versión de schema detectada.

### 3.2.2 Verificación de versión de schema

```sql
SELECT MAX(version) FROM wf_meta.schema_version;
```

- Si `< 2`: el backend rechaza arrancar (`BR-04`). El operador debe aplicar las migraciones pendientes.
- Si `= 2`: arranque normal.
- Si `> 2`: warn pero arranca (el backend puede correr contra un schema más nuevo si las nuevas columnas son aditivas; si no, los queries fallarán y se manifestará en tiempo de ejecución).

## 3.3 Apagado limpio (graceful shutdown)

Al recibir `SIGINT`/`SIGTERM`:

1. Dejar de aceptar nuevas conexiones HTTP.
2. Esperar hasta 30 segundos a que terminen las requests en curso.
3. Drenar el canal interno del motor: completar los eventos en cola antes de cerrar.
4. Cerrar el pool de conexiones de Npgsql.
5. Flush de Serilog.
6. Salir con código 0.

Si el drenaje del canal toma más de 30 segundos, se aborta y se logea `WARN`: los eventos pendientes se recuperan al próximo arranque vía reconciliación.

---

# 4. Endpoints del API

## 4.1 Diseño general

Todos los endpoints viven bajo `/api`. Los contratos JSON usan `snake_case` por consistencia con la BD (no `camelCase`, no `PascalCase`). Las respuestas siempre incluyen `Content-Type: application/json; charset=utf-8` excepto `/api/health` cuando se solicita con `Accept: text/plain`.

### 4.1.1 Tabla de endpoints

| Método | Ruta | Propósito | Sección detalle |
| --- | --- | --- | --- |
| `POST` | `/api/persist` | Crear/actualizar/eliminar metadata en batch atómico. | §4.2 |
| `GET` | `/api/read` | Leer metadata por tipo o por id, con opción de hidratación. | §4.3 |
| `POST` | `/api/processes/{id}/instances` | Iniciar una nueva instancia de proceso. | §4.4 |
| `GET` | `/api/instances/{id}` | Estado actual de una instancia (con nodo activo, contexto, tareas). | §4.5 |
| `GET` | `/api/tasks/me` | Bandeja de tareas asignadas al usuario actual. | §4.6 |
| `POST` | `/api/tasks/{id}/claim` | Tomar una tarea (`pending` → `claimed`). | §4.7 |
| `POST` | `/api/tasks/{id}/complete` | Completar una tarea enviando datos del formulario. Dispara avance del motor. | §4.8 |
| `GET` | `/api/health` | Health check. Devuelve el estado del servicio y de la BD. | §4.9 |

### 4.1.2 Formato de errores uniforme

Todos los errores responden con la siguiente estructura:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Descripción legible del problema.",
    "details": [
      { "field": "object_name", "rule": "VR-40", "message": "must match ^[a-z][a-z0-9_]{0,62}$" }
    ],
    "correlation_id": "req_2026_05_19_abc123"
  }
}
```

Códigos de error estándar:

| HTTP | `code` | Significado |
| --- | --- | --- |
| 400 | `bad_request` | Payload malformado (JSON inválido, campos requeridos faltantes a nivel estructural). |
| 404 | `not_found` | Recurso solicitado no existe. |
| 409 | `conflict` | Estado actual incompatible (ej. tarea ya completada). |
| 422 | `validation_failed` | Reglas de negocio (VR/RT/BR) violadas. Acompañado de `details` por regla. |
| 422 | `unsupported_node_type` | Intento de instanciar un proceso con `script_task` o `exclusive_gateway` (RT-01). |
| 422 | `unsupported_transition_condition` | Intento de instanciar un proceso con `condition` no nula (RT-02). |
| 500 | `internal_error` | Error inesperado. Acompañado de `correlation_id`. |
| 503 | `service_unavailable` | BD no disponible. |

### 4.1.3 `correlation_id`

Cada request entrante genera un `correlation_id` único (header `X-Correlation-Id` si el cliente lo provee; si no, se genera). Este ID:

- Aparece en cada log emitido durante el procesamiento del request.
- Se devuelve en el header `X-Correlation-Id` de la respuesta.
- Se incluye en el body del error en caso de fallo.

## 4.2 `POST /api/persist` — Persistencia batch

### 4.2.1 Propósito

Único endpoint de **escritura de metadata** del MVP. Acepta un array de operaciones heterogéneas (`create`, `update`, `delete` sobre cualquier `object_type`) y las ejecuta como una **única transacción PostgreSQL atómica**.

### 4.2.2 Contrato

**Request:**

```http
POST /api/persist
Content-Type: application/json

{
  "operations": [
    {
      "temp_id": "ent_1",
      "operation": "create",
      "object_type": "entity",
      "data": {
        "object_name": "vacation_request",
        "content": {
          "description": "Solicitud de vacaciones",
          "source": "vacation_request",
          "relations": []
        }
      }
    },
    {
      "temp_id": "attr_1",
      "operation": "create",
      "object_type": "attribute",
      "data": {
        "entity_ref": "ent_1",
        "name": "employee_id",
        "data_type": "uuid",
        "required": true
      }
    },
    {
      "operation": "update",
      "object_type": "form_definition",
      "id": "8c3b1d2e-...-...",
      "data": {
        "content": { /* ... */ },
        "expected_updated_at": "2026-05-19T10:00:00Z"
      }
    },
    {
      "operation": "delete",
      "object_type": "attribute",
      "id": "f1a2b3c4-...-..."
    }
  ]
}
```

**Response 200:**

```json
{
  "results": [
    {
      "temp_id": "ent_1",
      "operation": "create",
      "object_type": "entity",
      "status": "created",
      "id": "9a8b7c6d-...-..."
    },
    {
      "temp_id": "attr_1",
      "operation": "create",
      "object_type": "attribute",
      "status": "created",
      "id": "1f2e3d4c-...-..."
    },
    {
      "operation": "update",
      "object_type": "form_definition",
      "id": "8c3b1d2e-...-...",
      "status": "updated",
      "updated_at": "2026-05-19T10:15:42Z"
    },
    {
      "operation": "delete",
      "object_type": "attribute",
      "id": "f1a2b3c4-...-...",
      "status": "deleted"
    }
  ]
}
```

**Response 422 (validación):**

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Operation at index 1 failed validation.",
    "details": [
      {
        "operation_index": 1,
        "temp_id": "attr_1",
        "field": "name",
        "rule": "VR-40",
        "message": "must match ^[a-z][a-z0-9_]{0,62}$"
      }
    ],
    "correlation_id": "req_..."
  }
}
```

Cuando cualquier operación falla, **todas** se revierten. La respuesta indica cuál falló y por qué; el cliente envía el batch completo de nuevo tras corregir.

### 4.2.3 Reglas de la operación batch

- **BR-10:** El array `operations` tiene mínimo 1 elemento y máximo 200. Más de 200 responde 422 con código `batch_too_large`. (Límite por seguridad y para que las transacciones no se hagan inmanejables; ajustable vía config en el futuro.)
- **BR-11:** Cada operación tiene:
  - `operation`: `create | update | delete`.
  - `object_type`: `entity | attribute | form_definition | process_definition | node | template`.
  - Para `create`: `data` con el payload completo; opcionalmente `temp_id` (alias para referenciar dentro del batch).
  - Para `update`: `id` (uuid del objeto a actualizar) y `data` con los campos a modificar. Opcionalmente `expected_updated_at` para optimistic locking.
  - Para `delete`: `id` (uuid del objeto a eliminar).
- **BR-12:** Los `temp_id` son strings libres únicos dentro del batch. Sirven para que otras operaciones del mismo batch los referencien antes de que existan en BD.
- **BR-13:** Las referencias a `temp_id` se hacen en cualquier campo que normalmente recibiría un UUID: `entity_ref`, `process_id`, `attribute_ref`, etc. El backend resuelve los alias antes de persistir.
- **BR-14:** Si una operación referencia un `temp_id` que no fue declarado antes en el batch, responde 422 con `unresolved_temp_id`.
- **BR-15:** El orden del array es importante: una operación puede referenciar `temp_id`s declarados **antes** en el mismo array, no después. Esto es deliberado para mantener semántica clara y evitar resolución topológica mágica.
- **BR-16:** El optimistic locking (`expected_updated_at`) es opcional pero recomendado para `update`. Si se provee y no coincide con el `updated_at` actual en BD, responde 409 con `concurrent_modification`.

### 4.2.4 Procesamiento interno

```
1. Validar estructura del request (shape, tipos primitivos).
2. Iniciar transacción PostgreSQL.
3. Diccionario: temp_id → uuid (vacío al inicio).
4. Para cada operación en orden:
   a. Resolver referencias temp_id en `data` mirando el diccionario.
   b. Validar la operación contra:
      - Firma JSON del object_type (Definición de Metadata §6).
      - Reglas VR aplicables al object_type y operación.
      - Reglas de runtime aplicables si corresponde.
   c. Despachar al handler del object_type y operation.
   d. Si la operación es `create`, obtener el UUID generado y, si hay `temp_id`, registrarlo en el diccionario.
5. Si todas las operaciones se aplicaron sin error, commit. Devolver 200 con results.
6. Si alguna operación falló, rollback. Devolver 422 con el detalle de la operación que falló (`operation_index` + `temp_id` si aplica).
```

### 4.2.5 Greenfield: side-effects en el schema `public`

Cuando una operación afecta una `entity` o sus `attributes`, el backend ejecuta DDL adicional contra el schema `public` para mantener sincronizada la tabla física. Detalle completo en §5 (Greenfield Adapter).

### 4.2.6 Reglas materializadas explícitas en `persist`

El endpoint impone todas las reglas VR y RT relevantes para el `object_type` y la `operation`. La tabla resumen completa de qué se valida en cada operación se construye automáticamente en `Designer/Validation`; aquí se documenta el patrón:

| Operación | Reglas aplicadas |
| --- | --- |
| `create entity` | VR-01, VR-02, VR-03, VR-05, VR-40, VR-41. |
| `update entity` | VR-01, VR-40, VR-41, VR-23, VR-24. |
| `delete entity` | VR-10, VR-11, VR-12 (las dos últimas via búsqueda GIN sobre `metadata.content`). |
| `create attribute` | VR-01, VR-40, VR-41. |
| `delete attribute` | VR-13, VR-14 (búsqueda GIN). |
| `create form_definition` | VR-01, VR-05, VR-20, VR-21, VR-40. |
| `delete form_definition` | VR-16 (búsqueda GIN sobre `nodes.config`); RT-09 (búsqueda en `task.form_definition_id`). |
| `create process_definition` | VR-01, VR-05, VR-40. |
| `update process_definition` (cambio de `status` a `configured`) | VR-25, VR-26, VR-27, VR-28, VR-29, VR-30, VR-31. |
| `delete process_definition` | RT-07 (búsqueda en `process_instance`). |
| `create node` | VR-25 (start único), VR-40. |
| `update node` | VR-40. |

## 4.3 `GET /api/read` — Lectura de metadata

### 4.3.1 Propósito

Único endpoint de **lectura de metadata**. Permite recuperar:

- Todos los objetos de un `object_type` dado.
- Un objeto específico por su `id`.
- Opcionalmente, con sus relaciones hidratadas (atributos de una entidad, nodos de un proceso, etc.).

### 4.3.2 Contrato

**Listar por tipo:**

```http
GET /api/read?object_type=entity
```

**Detalle por id:**

```http
GET /api/read?object_type=entity&id=9a8b7c6d-...-...
```

**Con hidratación:**

```http
GET /api/read?object_type=entity&id=9a8b7c6d-...-...&hydrate=true
```

**Listar hijos de un padre:**

```http
GET /api/read?object_type=form_definition&parent_id=9a8b7c6d-...-...
```

### 4.3.3 Parámetros

| Parámetro | Tipo | Obligatorio | Descripción |
| --- | --- | --- | --- |
| `object_type` | string | Sí | `entity`, `attribute`, `form_definition`, `process_definition`, `node`, `template`, `root_project`. |
| `id` | uuid | No | Si se provee, devuelve un único objeto. Si no, devuelve todos los del tipo. |
| `parent_id` | uuid | No | Filtra por `parent`. No aplicable a `attribute` ni `node` (que tienen `entity_id`/`process_id` en lugar de `parent`). |
| `hydrate` | boolean | No | Default `false`. Si `true`, incluye relaciones hidratadas (ver §4.3.5). |

### 4.3.4 Respuestas

**Respuesta para listado:**

```json
{
  "items": [
    {
      "id_object": "9a8b7c6d-...-...",
      "object_name": "vacation_request",
      "object_type": "entity",
      "content": { /* ... */ },
      "parent": "root-uuid",
      "created_at": "2026-05-19T10:00:00Z",
      "updated_at": "2026-05-19T10:15:00Z"
    },
    /* ... */
  ],
  "total": 12
}
```

**Respuesta para detalle:**

```json
{
  "item": {
    "id_object": "9a8b7c6d-...-...",
    "object_name": "vacation_request",
    /* ... */
  }
}
```

**Respuesta hidratada (`hydrate=true` sobre entity):**

```json
{
  "item": {
    "id_object": "9a8b7c6d-...-...",
    "object_name": "vacation_request",
    "object_type": "entity",
    "content": { /* ... */ },
    "attributes": [
      {
        "id_attribute": "...",
        "name": "employee_id",
        "data_type": "uuid",
        "required": true,
        "ordinal": 0
      },
      /* ... */
    ],
    "form_definitions": [ /* forms hijos */ ]
  }
}
```

### 4.3.5 Hidratación por `object_type`

| `object_type` | Qué incluye `hydrate=true` |
| --- | --- |
| `entity` | `attributes[]` (ordenados por `ordinal`), `form_definitions[]` (sin sus fields hidratados; solo cáscara). |
| `process_definition` | `nodes[]` (ordenados por nombre), `transitions[]` (inline en `content`, ya están). |
| `form_definition` | Por cada `FormField` en `content.fields`, agrega `attribute` resuelto con datos completos (no solo `attribute_ref`). |
| `root_project` | Cáscara, sin hijos. Para árbol completo, ver `GET /api/read?object_type=...&hydrate=false` repetido por tipo. |
| `attribute`, `node`, `template` | Sin hidratación adicional (`hydrate=true` se ignora con warn header). |

### 4.3.6 Reglas

- **BR-20:** Si `object_type` no se provee, responde 400 con `bad_request`.
- **BR-21:** Si el `object_type` es desconocido (no en el catálogo), responde 400 con `unknown_object_type`.
- **BR-22:** Si `id` se provee pero no existe, responde 404.
- **BR-23:** Los listados no paginan en MVP (volúmenes esperados ≤ 100 objetos por tipo). Paginación se añade en v1.2.
- **BR-24:** La hidratación de `form_definition` requiere joins; se hace en una sola query por form, no N+1.

## 4.4 `POST /api/processes/{id}/instances` — Iniciar instancia

### 4.4.1 Propósito

Crea una nueva ejecución de un `process_definition`. Aplica las reglas RT-01 y RT-02 (validación de tipos soportados en MVP), hace snapshot de la versión del proceso, materializa el contexto inicial, y emite el primer evento al motor.

### 4.4.2 Contrato

**Request:**

```http
POST /api/processes/9a8b7c6d-...-../instances
Content-Type: application/json

{
  "initial_context": {
    "employee_id": "550e8400-e29b-41d4-a716-446655440000"
  },
  "started_by": "user-uuid-optional"
}
```

**Response 201:**

```json
{
  "id_process_instance": "instance-uuid",
  "process_definition_id": "9a8b7c6d-...-...",
  "process_version": 1,
  "status": "running",
  "started_at": "2026-05-19T10:30:00Z",
  "current_node": {
    "id_node": "node-uuid",
    "node_type": "human_task",
    "name": "capture_request"
  }
}
```

### 4.4.3 Validaciones al instanciar

- **BR-30 / RT-01:** Antes de crear el `process_instance`, el backend recorre los `nodes` del proceso. Si encuentra al menos uno con `node_type ∈ {'script_task', 'exclusive_gateway'}`, rechaza con 422 `unsupported_node_type` y lista los nodos ofensores.
- **BR-31 / RT-02:** Antes de crear el `process_instance`, el backend recorre las `transitions` del proceso (inline en `content.transitions[]`). Si encuentra al menos una con `condition` no nula ni vacía, rechaza con 422 `unsupported_transition_condition` y lista las transiciones ofensoras.
- **BR-32:** El proceso debe estar en `status='configured'`. Si está en `draft`, rechaza con 422 `process_not_configured`.
- **BR-33:** El `initial_context` debe contener valores para todas las `context_variables` del proceso que no tengan `initial_value` declarado y estén marcadas como requeridas. Si falta alguna, rechaza con 422 `missing_initial_context`.

### 4.4.4 Procesamiento

```
1. Validaciones BR-30 a BR-33.
2. Iniciar transacción:
   a. Insertar fila en `process_instance` con `status='running'`, `process_version = process_definition.content.version`.
   b. Insertar filas en `context_variable_value` por cada variable declarada en el proceso, con `initial_value` (del diseño) o el valor del `initial_context` del request.
   c. Identificar el nodo `start` del proceso.
   d. Insertar `node_instance` para el start con `status='active'`, `sequence_number=1`.
   e. Commit.
3. Avanzar el motor desde el start (atravesar la transición saliente del start hasta llegar al primer nodo bloqueante):
   a. Encolar evento `NodeEntered(node_instance_id)` en el RuntimeChannel.
   b. El worker consumirá y procesará (puede ser en el mismo request o en el thread del worker; ver §6.5).
4. Responder 201 con el estado actual: el `current_node` puede ser:
   - El primer `human_task` alcanzado (caso típico).
   - Un `end` si el proceso solo tiene `start → end` (instancia completa inmediatamente).
```

### 4.4.5 Concurrencia

El endpoint puede ser llamado N veces en paralelo para el mismo proceso. Cada llamada crea una instancia independiente. No hay coordinación necesaria entre instancias.

## 4.5 `GET /api/instances/{id}` — Estado de instancia

### 4.5.1 Propósito

Devuelve el estado completo de una instancia: cabecera, nodo activo, contexto actual, y lista de tareas activas (si las hay).

### 4.5.2 Contrato

**Request:**

```http
GET /api/instances/instance-uuid
```

**Response 200:**

```json
{
  "id_process_instance": "instance-uuid",
  "process_definition_id": "process-uuid",
  "process_definition_name": "vacation_approval",
  "process_version": 1,
  "status": "running",
  "started_at": "2026-05-19T10:30:00Z",
  "completed_at": null,
  "current_node_instance": {
    "id_node_instance": "ni-uuid",
    "node_id": "node-uuid",
    "node_name": "capture_request",
    "node_type": "human_task",
    "entered_at": "2026-05-19T10:30:00Z",
    "sequence_number": 1
  },
  "context": {
    "employee_id": "550e8400-...",
    "start_date": null,
    "end_date": null,
    "approved": false
  },
  "active_tasks": [
    {
      "id_task": "task-uuid",
      "title": "Capture request",
      "status": "pending",
      "form_definition_id": "form-uuid",
      "assigned_to": null
    }
  ],
  "history": [
    {
      "sequence_number": 1,
      "node_name": "start",
      "node_type": "start",
      "entered_at": "2026-05-19T10:30:00Z",
      "completed_at": "2026-05-19T10:30:00Z"
    }
  ]
}
```

### 4.5.3 Reglas

- **BR-40:** Si la instancia no existe, 404.
- **BR-41:** El `history` se devuelve siempre, ordenado por `sequence_number` ascendente. Incluye nodos `completed`. Para instancias terminadas, el último nodo en `history` es el `end` alcanzado.
- **BR-42:** `context` se construye desde `context_variable_value`, materializando los `value` JSONB como valores nativos (no como strings JSON).

## 4.6 `GET /api/tasks/me` — Bandeja de tareas

### 4.6.1 Propósito

Devuelve las tareas asignadas al usuario actual (vía `X-User-Id` header) o no asignadas (todos pueden ver las sin asignar). Filtra por estado `pending` y `claimed`.

### 4.6.2 Contrato

**Request:**

```http
GET /api/tasks/me
X-User-Id: user-uuid     (opcional en MVP)
```

**Response 200:**

```json
{
  "items": [
    {
      "id_task": "task-uuid",
      "title": "Approve vacation request",
      "status": "pending",
      "form_definition_id": "form-uuid",
      "form_definition_name": "approve_form",
      "process_instance_id": "instance-uuid",
      "process_definition_name": "vacation_approval",
      "created_at": "2026-05-19T10:30:00Z",
      "assigned_to": null,
      "assigned_role": "manager"
    },
    /* ... */
  ],
  "total": 5
}
```

### 4.6.3 Filtro de visibilidad

- **BR-50:** Si `X-User-Id` está presente: tareas con `assigned_to = X-User-Id` OR `assigned_to IS NULL`.
- **BR-51:** Si `X-User-Id` no está presente (MVP sin auth): todas las tareas en `pending` o `claimed`.
- **BR-52:** Ordenadas por `created_at` ascendente (las más antiguas primero).

## 4.7 `POST /api/tasks/{id}/claim` — Tomar tarea

### 4.7.1 Propósito

Marca una tarea `pending` como `claimed` por el usuario actual.

### 4.7.2 Contrato

**Request:**

```http
POST /api/tasks/task-uuid/claim
X-User-Id: user-uuid     (opcional en MVP)
```

**Response 200:**

```json
{
  "id_task": "task-uuid",
  "status": "claimed",
  "claimed_at": "2026-05-19T10:45:00Z",
  "assigned_to": "user-uuid"
}
```

### 4.7.3 Reglas

- **BR-60:** Solo tareas en estado `pending` pueden ser claimeadas. Si está en `claimed`, `completed`, o `cancelled`, responde 409 `task_not_claimable`.
- **BR-61:** El claim asigna `assigned_to` al `X-User-Id` del header. Si no hay header, `assigned_to` queda como estaba (puede ser NULL) y solo se cambia el `status` a `claimed`. (Decisión MVP: en producción esto requiere identidad real.)
- **BR-62:** Optimistic locking: el UPDATE incluye `WHERE status='pending'`. Si rowcount = 0, alguien más claimeó antes; responde 409.

## 4.8 `POST /api/tasks/{id}/complete` — Completar tarea

### 4.8.1 Propósito

Marca la tarea como completada, valida y persiste los datos del formulario (`submitted_data`), actualiza el contexto del proceso, y dispara el avance del motor al siguiente nodo.

### 4.8.2 Contrato

**Request:**

```http
POST /api/tasks/task-uuid/complete
X-User-Id: user-uuid     (opcional en MVP)
Content-Type: application/json

{
  "submitted_data": {
    "start_date": "2026-06-01",
    "end_date": "2026-06-10",
    "reason": "Family vacation"
  },
  "context_updates": {
    "start_date": "2026-06-01",
    "end_date": "2026-06-10"
  }
}
```

**Response 200:**

```json
{
  "id_task": "task-uuid",
  "status": "completed",
  "completed_at": "2026-05-19T11:00:00Z",
  "process_instance_state": {
    "status": "running",
    "current_node_instance": {
      "id_node_instance": "ni-uuid-next",
      "node_name": "review",
      "node_type": "human_task"
    }
  }
}
```

### 4.8.3 Procesamiento

```
1. Cargar la task. Si no existe → 404.
2. Validar estado:
   - status debe ser 'pending' o 'claimed'. Si está 'completed' o 'cancelled' → 409.
3. Validar `submitted_data` contra el form_definition (RT-13):
   - Por cada FormField requerido, debe estar presente.
   - Tipos de cada campo deben coincidir con el data_type de su attribute_ref.
   Si falla → 422 con detalle.
4. Iniciar transacción:
   a. UPDATE task SET status='completed', submitted_data=..., completed_at=now(), completed_by=X-User-Id.
   b. UPDATE node_instance (la asociada) SET status='completed', completed_at=now().
   c. Por cada (variable_name, value) en `context_updates`:
      - UPSERT en context_variable_value con set_by_node_instance_id = la ni completada.
   d. Commit.
5. Encolar evento `NodeCompleted(node_instance_id)` en el RuntimeChannel.
6. El worker:
   - Encuentra la transición saliente única (en MVP siempre hay solo una porque no hay gateways).
   - Si el destino es `end`: marcar process_instance.status='completed', end_node_id=..., completed_at=now().
   - Si el destino es `human_task`: crear node_instance(active) + task(pending) para el nuevo nodo.
7. Responder 200 con el nuevo estado.
```

### 4.8.4 Reglas

- **BR-70:** La completitud es **idempotente por error de cliente repetido**: si el cliente reenvía el mismo POST sin haber visto la respuesta, el segundo intento responde 409 `task_already_completed` con el `completed_at` original. No se intenta deduplicación por body (no hay idempotency key en MVP).
- **BR-71:** El paso 6 (avance del motor) se ejecuta **fuera** de la transacción del paso 4. Si el avance falla, la task queda completada y el proceso queda en estado inconsistente: la siguiente reconciliación al arranque (o un job periódico) lo detecta y avanza. Esto es deliberado: la atomicidad fuerte se limita al cambio de estado de la task; el avance es eventualmente consistente.
- **BR-72:** Si el nodo destino del avance es un `script_task` o `exclusive_gateway` (que en MVP no deberían estar, pero alguien podría haber modificado el proceso después de instanciar), el motor marca la instancia como `failed` con `error_message='unsupported_node_type_at_runtime'` y emite un log de ERROR.

## 4.9 `GET /api/health` — Health check

### 4.9.1 Contrato

**Request:**

```http
GET /api/health
```

**Response 200:**

```json
{
  "status": "healthy",
  "service": "workflow-platform-backend",
  "version": "1.0.0",
  "uptime_seconds": 12345,
  "database": {
    "status": "connected",
    "schema_version": 2
  },
  "runtime": {
    "channel_queued": 3,
    "reconciliation_completed": true
  }
}
```

**Response 503 (BD caída):**

```json
{
  "status": "unhealthy",
  "service": "workflow-platform-backend",
  "database": {
    "status": "disconnected",
    "error": "connection refused"
  }
}
```

### 4.9.2 Reglas

- **BR-80:** Health check no requiere autenticación. Está pensado para load balancers y monitoring.
- **BR-81:** No se incluye el connection string ni ninguna información sensible.
- **BR-82:** Si la BD no responde a un `SELECT 1` en menos de 2 segundos, se reporta como `disconnected` y la respuesta es 503.

---

# 5. Greenfield Adapter

## 5.1 Propósito

Cuando un usuario crea o modifica una `entity` (o sus `attributes`) en modo `greenfield`, el backend debe **crear o alterar la tabla física correspondiente en el schema `public`** para que el runtime pueda leer y escribir datos reales del negocio.

Esta es la pieza que convierte una entidad-como-metadata en una entidad-como-tabla-PostgreSQL.

## 5.2 Posición en el código

Vive en `WorkflowPlatform.Designer/Greenfield/`. Es invocado por el handler de operaciones de `entity` y `attribute` dentro de `POST /api/persist`, **antes** del commit de la transacción principal.

## 5.3 Operaciones soportadas en MVP

| Acción del diseñador | Acción física |
| --- | --- |
| `create entity` (con N atributos en el mismo batch) | `CREATE TABLE public.{source} (...)` con todas las columnas derivadas. Crear índices automáticos. |
| `create attribute` sobre entidad existente | `ALTER TABLE public.{source} ADD COLUMN {name} {tipo}` |
| `update attribute` (cambio de `data_type`) | `ALTER TABLE public.{source} ALTER COLUMN {name} TYPE {tipo} USING ...`. Solo se permite si la conversión es no destructiva (ver §5.5). |
| `update attribute` (cambio de `required`) | `ALTER TABLE public.{source} ALTER COLUMN {name} SET/DROP NOT NULL` |
| `update attribute` (cambio de `is_unique`) | `CREATE/DROP UNIQUE INDEX` |
| `delete attribute` | `ALTER TABLE public.{source} DROP COLUMN {name}` |
| `delete entity` | `DROP TABLE public.{source}` |
| Relación `Relation` con `kind='many_to_one'` que añade un `attribute` con `foreign_key_ref` | `ALTER TABLE ADD CONSTRAINT FK + ALTER TABLE ADD COLUMN` |

## 5.4 Traducción de `data_type` a PostgreSQL

Esta tabla **es la misma** definida en Modelo de Datos Físico v1.1 §8 (referencia canónica):

| `data_type` lógico | Tipo PostgreSQL generado | Notas |
| --- | --- | --- |
| `string` | `text` por defecto. `varchar(N)` si `metadata.constraints.max_length = N`. | |
| `integer` | `integer` por defecto. `bigint` si `metadata.constraints.bigint = true`. | |
| `decimal` | `numeric(P, S)` con `P` y `S` de constraints. | |
| `boolean` | `boolean` | |
| `date` | `date` | |
| `datetime` | `timestamptz` | |
| `uuid` | `uuid` con default `gen_random_uuid()` si `is_primary_key=true`. | |
| `json` | `jsonb` | |

## 5.5 Cambios destructivos vs. no destructivos

- **BR-90 (no destructivo):** Permitido sin advertencia. Ejemplos: añadir columna nullable, ampliar `varchar(N)` a `varchar(N+M)`, cambiar `required=false` a `required=true` solo si todos los valores existentes son no-NULL.
- **BR-91 (destructivo controlado):** Permitido pero requiere flag explícito. El diseñador en frontend pide confirmación. El backend acepta el cambio solo si el batch incluye `"confirm_destructive": true` en la operación. Ejemplos: cambiar `integer` a `string` (conversión), reducir `varchar`, cambiar `decimal(10,2)` a `decimal(8,2)`. Sin flag responde 422 `destructive_change_requires_confirmation`.
- **BR-92 (destructivo no recuperable):** Permitido con `confirm_destructive=true` pero loguea WARN. Ejemplos: drop column, drop table, cambio que pierde datos sin posibilidad de conversión.

## 5.6 Atomicidad

El DDL contra `public` se ejecuta en la **misma transacción** que el INSERT/UPDATE/DELETE contra `wf_meta`. PostgreSQL soporta DDL transaccional, así que si el DDL falla o el INSERT falla, todo se revierte. Esto incluye `CREATE TABLE` y `DROP TABLE`.

## 5.7 Naming y reservas

- **BR-93:** El nombre de la tabla física es `entity.content.source` (el campo `source` del JSON del entity). Si está vacío, se usa `entity.object_name`.
- **BR-94:** Antes de crear/renombrar una tabla, el backend verifica que el nombre no esté en la lista negra de palabras reservadas SQL (VR-41) ni colisione con una tabla ya existente en `public`. Si colisiona, responde 422 `table_name_conflict`.

## 5.8 Lo que NO hace el greenfield adapter en MVP

- **No** maneja datos existentes en cambios destructivos (no genera scripts de migración de datos).
- **No** soporta restauración o rollback de cambios aplicados (la atomicidad por transacción cubre fallos en la misma operación; cambios ya commited son definitivos).
- **No** soporta tablas particionadas, índices funcionales avanzados, o constraints CHECK personalizados a nivel de columna.
- **No** soporta renombrar columnas (un rename se modela como drop + add desde la perspectiva del diseñador).

---

# 6. Motor de runtime

## 6.1 Visión

El motor es el componente que avanza una `process_instance` por su grafo: detecta cuándo un nodo se completa, identifica el siguiente, lo materializa (crea `node_instance` y, si es `human_task`, `task`), y se detiene en nodos bloqueantes.

En MVP el motor soporta exclusivamente la cadena `start → human_task → ... → human_task → end`. No hay paralelismo, gateways ni scripts.

## 6.2 Componentes

```
WorkflowPlatform.Runtime/
├── Engine/
│   ├── RuntimeChannel.cs          → wrapper de System.Threading.Channels (singleton)
│   ├── RuntimeWorker.cs           → BackgroundService que consume del channel
│   ├── RuntimeEvent.cs            → tipos de evento (NodeEntered, NodeCompleted, etc.)
│   └── ProcessAdvancer.cs         → lógica pura de "dado un nodo terminado, avanzar al siguiente"
├── Reconciliation/
│   └── ReconciliationJob.cs       → escanea BD al arranque
└── Tasks/
    └── TaskManager.cs              → crear/claim/complete de tareas (lo invocan los endpoints)
```

## 6.3 RuntimeChannel

Un singleton inyectado vía DI. Envuelve un `Channel<RuntimeEvent>` con capacidad configurable (`Runtime:ChannelCapacity`, default 1000).

```csharp
public class RuntimeChannel
{
    private readonly Channel<RuntimeEvent> _channel;

    public RuntimeChannel(IOptions<RuntimeOptions> options)
    {
        _channel = Channel.CreateBounded<RuntimeEvent>(
            new BoundedChannelOptions(options.Value.ChannelCapacity)
            {
                FullMode = BoundedChannelFullMode.Wait,
                SingleReader = true,
                SingleWriter = false
            });
    }

    public ValueTask EnqueueAsync(RuntimeEvent evt, CancellationToken ct) =>
        _channel.Writer.WriteAsync(evt, ct);

    public IAsyncEnumerable<RuntimeEvent> ReadAllAsync(CancellationToken ct) =>
        _channel.Reader.ReadAllAsync(ct);
}
```

- **BR-100:** Si el canal está lleno (1000 eventos pendientes), nuevos `EnqueueAsync` esperan (no fallan). Esto provee back-pressure natural.
- **BR-101:** `SingleReader=true` porque hay un único worker. `SingleWriter=false` porque varios endpoints pueden encolar concurrentemente (`POST /persist` con creación de proceso, `POST /complete` de tarea, etc.).

## 6.4 RuntimeEvent

Eventos manejados por el motor MVP:

```csharp
public abstract record RuntimeEvent(Guid CorrelationId);

public record NodeEnteredEvent(Guid NodeInstanceId, Guid CorrelationId) : RuntimeEvent(CorrelationId);
public record NodeCompletedEvent(Guid NodeInstanceId, Guid CorrelationId) : RuntimeEvent(CorrelationId);
public record ProcessFailedEvent(Guid ProcessInstanceId, string Reason, Guid CorrelationId) : RuntimeEvent(CorrelationId);
```

## 6.5 RuntimeWorker

`BackgroundService` que se inicia con el host. Consume eventos del canal y los despacha al `ProcessAdvancer`. Es **single-threaded**: un solo loop, un evento a la vez. Esto simplifica enormemente la lógica de concurrencia.

```csharp
public class RuntimeWorker : BackgroundService
{
    private readonly RuntimeChannel _channel;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RuntimeWorker> _logger;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await foreach (var evt in _channel.ReadAllAsync(ct))
        {
            using var scope = _scopeFactory.CreateScope();
            var advancer = scope.ServiceProvider.GetRequiredService<ProcessAdvancer>();
            try
            {
                await advancer.HandleAsync(evt, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process runtime event {EventType} {CorrelationId}",
                    evt.GetType().Name, evt.CorrelationId);
                // No re-throw: el worker no debe morir por un evento malo
            }
        }
    }
}
```

- **BR-110:** Si el handler de un evento lanza, el error se loguea pero **el worker no se cae**. El evento se considera perdido (el estado en BD queda como esté); la reconciliación al arranque o un job periódico lo recuperan.
- **BR-111:** No hay reintento automático en MVP. El supuesto es que los errores transitorios (BD ocupada, etc.) son raros; cuando ocurran, la reconciliación los retoma. Reintento con backoff se añade en v1.2.

## 6.6 ProcessAdvancer

Lógica pura del avance. Para cada evento:

### 6.6.1 `NodeEntered`

```
1. Cargar node_instance + node + process_definition.
2. Según node_type:
   a. start:
      - Marcar node_instance como completed inmediatamente.
      - Encolar NodeCompletedEvent.
   b. human_task:
      - Crear fila en `task` con status='pending', form_definition_id, assigned_to/role (desde config).
      - Detenerse: el motor queda esperando a que un humano complete la tarea.
   c. end:
      - Marcar node_instance como completed.
      - Marcar process_instance como completed, end_node_id=node_id, completed_at=now().
      - Sin más eventos.
   d. (cualquier otro tipo en MVP):
      - Marcar process_instance como failed con error_message='unsupported_node_type_at_runtime'.
      - Loguear ERROR.
```

### 6.6.2 `NodeCompleted`

```
1. Cargar node_instance + node + transitions del proceso.
2. Encontrar la transición saliente (debe haber exactamente una en MVP).
   - Si hay 0 transiciones y el nodo no es end: marcar instance como failed (proceso mal diseñado).
   - Si hay >1 transición: marcar instance como failed con 'multiple_transitions_unsupported'.
3. Resolver el nodo destino.
4. Crear nuevo node_instance con status='active', sequence_number=max+1, node_id=destino.
5. Encolar NodeEnteredEvent para el nuevo node_instance.
```

### 6.6.3 Atomicidad

Cada handler de evento ejecuta sus DB ops en una transacción propia. El estado intermedio entre dos eventos consecutivos puede observarse vía API, pero siempre es consistente: si un `node_instance` está `completed` pero no hay `active` aún, la reconciliación detecta el hueco.

## 6.7 ReconciliationJob

Se ejecuta una vez al arranque, dentro del bootstrap del host. Su propósito es recuperar instancias en estados inconsistentes provocados por crashes anteriores.

### 6.7.1 Qué reconcilia

| Estado detectado | Acción |
| --- | --- |
| `process_instance.status='running'` con un `node_instance.status='active'` esperando un `human_task` y la `task` ya `completed` | Encolar `NodeCompletedEvent` para retomar el avance. |
| `process_instance.status='running'` sin ningún `node_instance.status='active'` (hueco) | Encolar `NodeCompletedEvent` para el último `node_instance.completed` para que el motor avance. |
| `process_instance.status='running'` con `node_instance.status='active'` esperando, donde el nodo es `start` o `end` (no debería pasar pero por seguridad) | Encolar `NodeCompletedEvent` o `NodeEnteredEvent` según corresponda. |

### 6.7.2 Query principal

```sql
-- Instancias con tareas completadas pero proceso sin avanzar
SELECT pi.id_process_instance, ni.id_node_instance
FROM wf_runtime.process_instance pi
JOIN wf_runtime.node_instance ni ON ni.process_instance_id = pi.id_process_instance
JOIN wf_runtime.task t ON t.node_instance_id = ni.id_node_instance
WHERE pi.status = 'running'
  AND ni.status = 'active'
  AND t.status = 'completed';
```

Para cada resultado, encola un `NodeCompletedEvent`.

### 6.7.3 Reglas

- **BR-120:** La reconciliación es **idempotente**: ejecutarla múltiples veces no causa daño. El motor verifica el estado actual antes de avanzar y descarta eventos que ya no aplican.
- **BR-121:** Si la reconciliación encuentra una instancia en estado inconsistente irreparable (ej. node_instance activo de un nodo que ya no existe), la marca como `failed` con `error_message='reconciliation_irreparable'`.

## 6.8 Lo que NO hace el motor en MVP

- No procesa `script_task`: rechazado al instanciar (RT-01).
- No procesa `exclusive_gateway`: rechazado al instanciar (RT-01).
- No evalúa `condition` en transiciones: rechazado al instanciar (RT-02).
- No soporta paralelismo (un solo `node_instance` activo por instancia).
- No reasigna tareas vencidas (no hay timeouts).
- No envía notificaciones (no hay integración con email/Slack).
- No persiste eventos en BD para auditoría detallada (eso se añade en v1.2 si hace falta).

---

# 7. Acceso a datos (Dapper)

## 7.1 Conexión

`WorkflowPlatform.Data/Db/ConnectionFactory.cs` provee un `IDbConnection` (en realidad `NpgsqlConnection`) por scope DI. Pattern:

```csharp
public class ConnectionFactory : IConnectionFactory
{
    private readonly string _connectionString;
    public ConnectionFactory(IOptions<DatabaseOptions> options) =>
        _connectionString = options.Value.ConnectionString;

    public IDbConnection Create()
    {
        var conn = new NpgsqlConnection(_connectionString);
        conn.Open();
        return conn;
    }
}
```

- **BR-130:** Las conexiones se gestionan dentro del scope del request (HTTP scope). Para el RuntimeWorker, cada handler de evento abre y cierra su propio scope.
- **BR-131:** El pool de Npgsql es por default 100 conexiones máximo, suficiente para MVP. Configurable vía connection string si hace falta.

## 7.2 Transacciones

Para operaciones que afecten múltiples tablas (toda escritura, esencialmente), se usa `IDbTransaction` explícito:

```csharp
using var conn = _connectionFactory.Create();
using var tx = conn.BeginTransaction();
try
{
    await conn.ExecuteAsync(sql1, params1, tx);
    await conn.ExecuteAsync(sql2, params2, tx);
    tx.Commit();
}
catch
{
    tx.Rollback();
    throw;
}
```

- **BR-132:** Todo `POST /api/persist` corre en una transacción explícita.
- **BR-133:** Los handlers del motor corren cada uno en su propia transacción (no compartida entre handlers).
- **BR-134:** Las lecturas no usan transacción (default a snapshot isolation del autocommit de PostgreSQL).

## 7.3 Mapeo a tipos .NET

| Columna PostgreSQL | Tipo .NET |
| --- | --- |
| `uuid` | `Guid` |
| `text`, `varchar` | `string` |
| `integer` | `int` |
| `bigint` | `long` |
| `boolean` | `bool` |
| `timestamptz` | `DateTimeOffset` (no `DateTime` — preserva info de zona) |
| `numeric` | `decimal` |
| `jsonb` | `string` o `JsonDocument` según el caso. Para `content` y `config` se usa `string` (parse manual cuando hace falta) para evitar overhead. |

## 7.4 Queries: SQL crudo, parámetros tipados

Todo el SQL crudo del backend reside en el proyecto `WorkflowPlatform.Queries` (ver §2.3 "Propósito de `WorkflowPlatform.Queries`"). Los repositorios en `WorkflowPlatform.Data` consumen las constantes definidas allí; no contienen SQL literal embebido.

**Definición del query en `WorkflowPlatform.Queries`:**

```csharp
// WorkflowPlatform.Queries/Meta/MetadataQueries.cs
namespace WorkflowPlatform.Queries.Meta;

public static class MetadataQueries
{
    public const string GetById = @"
        SELECT id_object, object_name, object_type, content, parent, created_at, updated_at
        FROM wf_meta.metadata
        WHERE id_object = @Id";

    public const string UpdateWithOptimisticLock = @"
        UPDATE wf_meta.metadata
        SET content = @Content::jsonb, object_name = @Name, updated_at = now()
        WHERE id_object = @Id AND updated_at = @ExpectedUpdatedAt";

    // ... resto de queries sobre wf_meta.metadata
}
```

**Consumo desde el repositorio en `WorkflowPlatform.Data`:**

```csharp
// WorkflowPlatform.Data/Repositories/MetadataRepository.cs
using WorkflowPlatform.Queries.Meta;

public async Task<MetadataDto?> GetByIdAsync(Guid id, IDbConnection conn, IDbTransaction? tx = null)
{
    return await conn.QuerySingleOrDefaultAsync<MetadataDto>(
        MetadataQueries.GetById,
        new { Id = id },
        tx);
}
```

- **BR-140:** Nunca se concatenan strings para construir SQL. Siempre parámetros con `@`.
- **BR-141:** Los nombres de columnas en SQL son `snake_case` (igual que la BD); el mapeo a `PascalCase` de DTOs lo hace Dapper con `MatchNamesWithUnderscores=true` configurado globalmente.
- **BR-142:** Los repositorios de `Data` no contienen strings literales con SQL. Toda sentencia se referencia como constante desde `WorkflowPlatform.Queries`.
- **BR-143:** Las constantes en `Queries` se nombran con `PascalCase` descriptivo de la operación (`GetById`, `UpdateWithOptimisticLock`, `ListChildrenByParent`), no con prefijos del tipo `Sql*` ni sufijos `*Query`.
- **BR-144:** El SQL dinámico (DDL del greenfield adapter, queries con cláusulas opcionales) se construye también en `Queries` mediante métodos `static` que retornan `string`, no en los repositorios. Los repositorios reciben el SQL ya armado e invocan a Dapper.

## 7.5 Optimistic locking

Para `update`, se usa la constante correspondiente de `WorkflowPlatform.Queries`:

```csharp
using WorkflowPlatform.Queries.Meta;

var rows = await conn.ExecuteAsync(
    MetadataQueries.UpdateWithOptimisticLock,
    new { Id = id, Content = content, Name = name, ExpectedUpdatedAt = expectedUpdatedAt },
    tx);
if (rows == 0) throw new ConcurrentModificationException(id);
```

La constante `UpdateWithOptimisticLock` está definida en `MetadataQueries.cs` (ver §7.4) y contiene el `WHERE id_object = @Id AND updated_at = @ExpectedUpdatedAt` que materializa el lock optimista.

## 7.6 Repositorios

Cada tabla principal tiene su repositorio interfaceado:

```
WorkflowPlatform.Domain/Repositories/
├── IMetadataRepository.cs
├── IAttributesRepository.cs
├── INodesRepository.cs
├── IProcessInstanceRepository.cs
├── INodeInstanceRepository.cs
├── IContextVariableValueRepository.cs
└── ITaskRepository.cs

WorkflowPlatform.Data/Repositories/
├── MetadataRepository.cs          → consume WorkflowPlatform.Queries.Meta.MetadataQueries
├── AttributesRepository.cs        → consume WorkflowPlatform.Queries.Meta.AttributesQueries
├── ...
```

Las features (`Designer`, `Runtime`) consumen las interfaces, nunca las implementaciones concretas. Las implementaciones concretas en `Data` consumen las constantes de `Queries`, nunca SQL literal embebido.

---

# 8. Validación

## 8.1 Estrategia

El backend valida en tres niveles:

1. **Estructural (DTO entrante):** que el JSON sea bien-formado, que los campos requeridos a nivel transporte estén presentes. Lo hace ASP.NET Core con FluentValidation antes de entrar al handler.
2. **Semántico (firma del `content`):** que el JSONB cumpla la forma canónica de Definición de Metadata §6. La estrategia exacta (JSON Schema, código artesanal, FluentValidation) se decide en implementación. El SRS solo dice: el backend valida el `content` antes de persistir.
3. **Reglas de negocio (VR + RT + BR):** validaciones cruzadas, integridad referencial, restricciones de runtime. Se aplican en los handlers de cada operación.

## 8.2 Capa `Common.Validation`

Vive en `WorkflowPlatform.Common/Validation/`. Expone:

- `IRuleValidator`: ejecuta una lista de reglas sobre un objeto.
- `ValidationFailure`: representa un fallo (`field`, `rule`, `message`).
- `ValidationResult`: agregado de fallos. `IsValid` si vacío.

Las reglas concretas (VR, RT, BR) son clases en `Designer/Rules/` y `Runtime/Rules/`. Cada feature contribuye sus reglas; `Common` solo provee el framework.

## 8.3 Reglas de naming y reservas

Las palabras reservadas SQL (VR-41) viven en una lista hardcodeada en `Common.Validation.ReservedWords`. La lista se mantiene en código (no en BD); cualquier cambio requiere release.

---

# 9. Manejo de errores

## 9.1 Excepciones de dominio

`WorkflowPlatform.Domain/Errors/` define excepciones tipadas:

- `ValidationException(IReadOnlyList<ValidationFailure> failures)`
- `NotFoundException(string resourceType, Guid id)`
- `ConflictException(string code, string message)`
- `ConcurrentModificationException(Guid id)`
- `UnsupportedRuntimeFeatureException(string feature, IReadOnlyList<Guid> offenders)`

## 9.2 Middleware de errores

`WorkflowPlatform.Api/Middleware/ErrorHandlingMiddleware.cs` captura excepciones y las mapea al formato uniforme de §4.1.2:

| Excepción | HTTP | `code` |
| --- | --- | --- |
| `ValidationException` | 422 | `validation_failed` |
| `NotFoundException` | 404 | `not_found` |
| `ConflictException` | 409 | `conflict` o el `code` específico |
| `ConcurrentModificationException` | 409 | `concurrent_modification` |
| `UnsupportedRuntimeFeatureException` | 422 | `unsupported_node_type` o `unsupported_transition_condition` |
| Cualquier otra | 500 | `internal_error` |

- **BR-150:** El stack trace nunca se devuelve al cliente. Se loguea con `correlation_id`. El cliente recibe solo el código y mensaje genérico para errores 500.

## 9.3 Logging de errores

Todos los errores 4xx y 5xx se loguean con nivel apropiado:

- 4xx (`ValidationException`, `NotFoundException`, `ConflictException`): `Information` o `Warning`. Son comportamiento esperado.
- 5xx (`Exception` no manejado): `Error` con stack trace completo y `correlation_id`.

---

# 10. Logging

## 10.1 Stack

**Serilog** con sinks a consola (estructurado JSON en producción, plain text en desarrollo) y opcionalmente a archivo (con rotación diaria).

## 10.2 Enriquecedores

Cada log entry incluye automáticamente:

- `Timestamp` (UTC).
- `Level`.
- `MessageTemplate` y `Properties` (estructura clave-valor).
- `CorrelationId` (extraído del scope HTTP si aplica).
- `MachineName`.

## 10.3 Niveles

- `Information`: arranque/shutdown, operaciones de negocio exitosas (instancia creada, tarea completada).
- `Warning`: errores 4xx esperables, configuraciones subóptimas, deprecation.
- `Error`: errores 5xx, fallos del motor, problemas de conexión a BD.
- `Debug`: detalles de SQL ejecutado, payload de eventos del motor. Solo en desarrollo.
- `Verbose`: trace detallado. Casi nunca activado.

## 10.4 Sanitización

Como se mencionó en BR-01, el connection string nunca aparece en logs. Se aplica un sanitizer Serilog:

```csharp
.Enrich.With(new SensitiveDataEnricher(patterns: new[] { @"Password=([^;]+)" }))
```

---

# 11. Requisitos no funcionales

| Categoría | Requisito |
| --- | --- |
| **Performance** | Latencia p95 < 200ms para endpoints de read y persist con < 50 operaciones. Latencia p95 < 500ms para instanciar proceso. Avance del motor entre nodos < 100ms (puramente DB ops). |
| **Throughput MVP** | Soporta hasta 50 requests concurrentes en un proceso. Hasta 500 instancias activas simultáneamente. Hasta 10.000 tareas pendientes globalmente. |
| **Disponibilidad** | Despliegue single-instance. SLA implícito ~99% (depende del operador). HA en versión posterior. |
| **Recovery** | Reconciliación al arranque cubre crashes y restarts. Tiempo de reconciliación < 30s para 500 instancias activas. |
| **Observabilidad** | Logs estructurados accesibles. Health check disponible. Métricas detalladas (Prometheus, OpenTelemetry) se añaden en v1.2. |
| **Seguridad** | TLS terminado en proxy externo (nginx, traefik). El backend no implementa TLS directamente en MVP. CORS configurable. Sin autenticación en MVP (perímetro de confianza). |
| **Compatibilidad** | PostgreSQL 16+. .NET 9 runtime. Funciona en Linux x64 y Windows x64. |
| **Configuración** | Variables de entorno tienen prioridad sobre `appsettings.json`. Cambios de configuración requieren restart. |

---

# 12. Asumpciones y temas abiertos

- **A-01.** El connection string se entrega al backend ya descifrado y en texto plano vía variable de entorno. La seguridad del valor en tránsito y en reposo (encryption at rest del filesystem, gestión de secrets) es responsabilidad del operador de deployment.
- **A-02.** El backend asume que el schema de BD está bootstrapped al arrancar (es decir, alguien ya corrió el script de Modelo de Datos Físico v1.1 §10.2). No lo aplica automáticamente.
- **A-03.** Los `X-User-Id` en headers son strings UUID sin validación contra ninguna BD. En MVP cualquiera puede inventarse un UUID y "ser" ese usuario. Esto se reemplaza con auth real cuando se integre el módulo administrativo.
- **A-04.** La gestión de migraciones de schema queda fuera del backend en sí. Se asume que existe un script o herramienta externa que aplica las migraciones cuando se libera una nueva versión.
- **A-05.** El frontend hace todas las llamadas desde un único cliente confiable. No hay rate limiting en MVP (más allá del implícito por capacidad del canal del motor).
- **A-06.** No hay distribución de la carga del motor entre múltiples procesos. Si en algún momento se levantan dos backends apuntando a la misma BD, podrían procesar el mismo evento dos veces. Esto se mitiga con el índice `uq_node_instance_one_active_per_process` (que prevendría el doble avance), pero el comportamiento exacto no se garantiza. Solución correcta llegará con broker externo en v1.2.

---

# 13. Out of scope (v1.0)

- Soporte para `exclusive_gateway`, `script_task`, transiciones con `condition`.
- Lenguaje de expresiones (parser, evaluador).
- Adapter brownfield (ingesta de schema existente).
- Autenticación, autorización, multi-tenancy.
- Templates: aplicar templates de la biblioteca al proyecto.
- Audit log detallado de operaciones.
- Reintentos automáticos del motor con backoff.
- Broker externo (RabbitMQ, Redis Streams).
- Múltiples instancias de backend coordinadas.
- Notificaciones (email, Slack, webhooks).
- Métricas detalladas (Prometheus, OpenTelemetry, tracing distribuido).
- Paginación en endpoints de listado.
- Búsqueda full-text en metadata.
- Versionado de API (`/v1`, `/v2`).
- WebSockets / Server-Sent Events para push de cambios al frontend.
- GraphQL / gRPC.
- Importación/exportación de proyectos.
- Reasignación de tareas, timeouts, escalado.

---

# 14. Historial de versiones

| Versión | Fecha | Descripción |
| --- | --- | --- |
| 1.0 | Mayo 2026 | SRS inicial del Backend del MVP de Workflow Platform. Servicio HTTP en .NET 9 + Dapper sobre PostgreSQL 16+ que expone un API minimalista de 8 endpoints: dos genéricos para metadata (`POST /api/persist` con batch atómico y resolución de alias temporales, `GET /api/read` por tipo y/o id con hidratación opcional), cinco específicos del runtime básico (instanciar proceso, estado de instancia, bandeja de tareas, claim, complete) y un health check. Arquitectura n-capas con proyectos separados (`Api`, `Domain`, `Data`, `Designer`, `Runtime`, `Common`, `Packages`) y dependencias unidireccionales; gestión centralizada de NuGets vía `Directory.Packages.props`. Incluye greenfield adapter completo (creación/alteración dinámica de tablas físicas en `public` con FKs), traducción de `data_type` lógicos a tipos PostgreSQL, y reglas de cambios destructivos con flag de confirmación. Motor de runtime in-process con `System.Threading.Channels` (sin broker externo), worker single-threaded como `BackgroundService`, job de reconciliación idempotente al arranque para recuperar de crashes. Soporta exclusivamente la cadena `start → human_task → end`; rechaza al instanciar procesos con `script_task`, `exclusive_gateway` o transiciones con `condition` (errores `422 unsupported_node_type` y `422 unsupported_transition_condition`). Sin autenticación en MVP (deploy local controlado, perímetro de confianza); identidad opcional vía header `X-User-Id`. Logging estructurado con Serilog y sanitización del connection string en todas las salidas. Define ~50 reglas de backend numeradas BR-NN cubriendo seguridad, validación, transacciones, optimistic locking, comportamiento del motor y greenfield. Deja explícitamente fuera de alcance: brownfield, autenticación, lenguaje de expresiones, broker, HA, métricas detalladas, paginación, versionado de API. |
| 1.1 | Mayo 2026 | Se incorpora el proyecto `WorkflowPlatform.Queries` (resolución del pendiente P-002). Nueva librería de clases dentro de la solución cuya responsabilidad exclusiva es alojar, organizar y versionar todos los queries SQL crudos del sistema, organizados por área funcional (`Meta/`, `Runtime/`, `Greenfield/`). Cambios concretos: §2.3 añade el proyecto a la estructura de la solución y documenta su propósito, estructura interna, beneficios y dos reglas nuevas (BR-145 punto único de SQL, BR-146 versionado conjunto con migraciones); §2.3.1 actualiza el grafo de dependencias para reflejar que `Data` referencia `Queries`, y agrega las reglas de aislamiento (`Queries` solo depende del BCL, no es referenciado directamente por features); §7.4 reescribe el patrón estándar de queries para mostrar definición de constantes `static readonly` en `Queries` y consumo desde el repositorio en `Data`, y añade tres reglas nuevas (BR-142 prohibición de SQL literal en `Data`, BR-143 convención de nombres de constantes, BR-144 SQL dinámico también vive en `Queries`); §7.5 y §7.6 actualizan sus ejemplos para reflejar el nuevo patrón. No hay cambios funcionales en endpoints, motor, greenfield adapter ni en el modelo de datos — es una reorganización del código de acceso a datos con efecto exclusivo sobre la organización de proyectos de la solución y sobre el patrón de implementación de repositorios. |

*— Fin del documento —*

Confidencial · Mayo 2026 · Workflow Platform · SRS Backend v1.1
