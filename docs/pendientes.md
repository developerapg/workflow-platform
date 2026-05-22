# PENDIENTES

**Workflow Platform**

*Registro de elementos identificados pero diferidos. Cada entrada explica qué es, por qué se difiere y qué documentación/módulos afecta cuando se retome.*

Mayo 2026 · v1.0 · Confidencial — Documento interno

---

## Convenciones

- Cada pendiente tiene un identificador `P-NNN` referenciable desde otros documentos.
- Estado: `abierto` (aún no se ha trabajado), `en análisis` (en discusión activa), `programado` (con fecha objetivo), `cerrado` (resuelto en alguna versión).
- Los pendientes se atienden cuando el uso real lo demanda o cuando una decisión arquitectural los desbloquea — no por orden de aparición.

---

## Lista de pendientes

1. **P-001 — Implementación de `data_view` en MVP de UI** · estado: `abierto`
   - **Qué es:** artefacto de metadata definido en Definición de Metadata v1.0 §6.5 que representa una vista de listado de solo lectura sobre una entidad, con columnas personalizables (incluyendo columnas que navegan relaciones vía `xPath` dot notation), ordenamiento por defecto y paginación.
   - **Por qué se difiere:** el alcance del MVP de UI ya está cerrado en la Visión y el UX Spec, ambos con foco en Workflows como módulo central. Introducir `data_view` ahora implica diseñar un nuevo módulo de UI (un diseñador de vistas con drag-and-drop de columnas, un selector de campos que navega relaciones, controles de ordenamiento y paginación) y un runtime de visualización (la pantalla que renderiza el listado con los datos reales). Eso amplía el scope del MVP en una proporción no trivial y desplazaría la fecha de entrega del módulo Workflows. La firma JSON queda documentada para evitar retrabajo cuando se retome, pero la implementación se difiere.
   - **Documentación afectada cuando se implemente:**
     - **Visión v1.0** — agregar `data_view` en §3 (qué incluye el MVP) y en §13 (próxima jugada).
     - **UX Spec v1.0** — diseñar layout del módulo de Vistas, del diseñador de vistas y del runtime read-only. Agregar a la navegación principal. Definir patrones de interacción para selección de columnas y configuración de ordenamiento.
     - **Definición de Metadata v1.0** — la firma ya está; podría requerirse ajuste menor si surge necesidad de configurar visibilidad condicional de columnas o agrupamiento.
     - **SRS de Frontend** (futuro) — requerimientos del módulo Vistas.
     - **SRS de Backend** (futuro) — endpoints del API para CRUD de `data_view`, endpoint de ejecución read-only que retorna datos paginados con joins por las relaciones declaradas en `xPath`.
   - **Módulos afectados:** módulo Vistas (nuevo), módulo Entities (agrega acción "Crear vista" sobre cada entidad).
   - **Bloqueadores / dependencias:** ninguno técnico. Depende de decisión de scope.

2. **P-002 — Proyecto dedicado de queries SQL en el backend** · estado: `abierto`
   - **Qué es:** un proyecto de librería de clases adicional dentro de la solución `WorkflowPlatform.sln`, cuya responsabilidad exclusiva es **alojar, organizar y versionar todos los queries SQL crudos** que Dapper ejecuta contra la BD. Actualmente el SRS de Backend v1.0 §7 prevé que los repositorios (`MetadataRepository`, `AttributesRepository`, etc.) contengan el SQL como strings literales en sus métodos. A medida que el número de queries crezca (diseñador + runtime + greenfield adapter + reconciliación) ese SQL quedará disperso dentro del código de acceso a datos y será difícil de auditar, comparar con el DDL real, o reutilizar entre repositorios.
   - **Por qué se difiere:** en MVP el volumen de queries está acotado y el equipo es pequeño; la sobrecarga de mantener un proyecto adicional no está justificada aún. El patrón correcto se establece cuando haya suficientes queries para que la dispersión empiece a costar. Se proyecta que eso ocurra al finalizar el MVP cuando estén implementados los módulos de diseñador y runtime básicos.
   - **Cómo se implementaría:** nuevo proyecto `WorkflowPlatform.Queries` (librería de clases) con la siguiente estructura interna:
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
     Cada clase expone constantes o propiedades `static readonly string` con el SQL. Los repositorios en `WorkflowPlatform.Data` importan `WorkflowPlatform.Queries` y las consumen sin repetir texto SQL.
   - **Beneficios esperados:**
     - Un solo lugar donde buscar cualquier query del sistema (auditoría, debugging, revisiones de schema).
     - Facilita la detección de queries que requieren actualización cuando el DDL cambia (búsqueda global en un solo proyecto).
     - Permite versionar los queries junto con las migraciones del schema: al aplicar `migration_003`, se actualiza el archivo `MetadataQueries.cs` correspondiente en el mismo commit.
     - Evita duplicación: si dos repositorios necesitan el mismo subquery, lo comparten vía constante.
   - **Documentación afectada cuando se implemente:**
     - **SRS de Backend v1.0** — §2.3 (estructura de la solución: añadir `WorkflowPlatform.Queries`), §2.3.1 (dependencias: `Data` referencia `Queries`), §7.4 (sección de queries: actualizar el patrón de ejemplo para mostrar uso de constantes desde `Queries`).
   - **Módulos afectados:** `WorkflowPlatform.Data` (consume el nuevo proyecto), `WorkflowPlatform.Designer` y `WorkflowPlatform.Runtime` (indirectamente, a través de `Data`).
   - **Bloqueadores / dependencias:** ninguno técnico. Puede implementarse en cualquier momento de la fase de desarrollo del MVP sin impactar otros módulos; solo requiere refactoring de los repositorios ya escritos.

3. **P-003 — Reconciliación del frontend ya escrito con UX Spec v1.0 y Process Designer SRS v1.0** · estado: `abierto`
   - **Qué es:** auditoría y reescritura del código existente bajo `src/features/{entities,forms,processes}/` y `src/ui/` para alinearlo con la documentación normativa. La primera implementación se hizo antes de que existieran el SRS del Diseñador de Procesos y antes de consolidar el UX Spec, y arrastra brechas concretas: (a) el canvas no usa el patrón "+" contextual del UX Spec §7.4 ni handles en las cuatro direcciones por nodo (PD requirements), (b) las edges no son `smoothstep` ortogonales redondeadas, (c) los estados visuales de los cuatro tipos (`configurado` / `advertencia` / `error` / `sin configurar`, UX Spec §3.5) no se aplican consistentemente a nodos, filas y cards de listados, (d) la distinción **modo lista vs modo concentración** (UX Spec §2.1) no se materializa: la sidebar está visible incluso en editores, (e) la paleta cromática de tokens (UX Spec §3.1) no se respeta plenamente; hay valores hex hardcodeados en componentes, (f) la sub-estructura normativa `features/processes/designer/` (PD-03) todavía vive bajo `features/processes/canvas/` con otra organización, (g) los tipos de nodo `script_task` y `exclusive_gateway` se diseñan sin badge ⚠ persistente como exigen FE-104 y FE-111, (h) la auditoría de cumplimiento de cada `FE-NN` y `PD-NN` aún no se ha realizado de forma sistemática.
   - **Por qué se difiere su atención formal aquí:** el reconocimiento de la brecha es la causa de la apertura de este pendiente. La reconciliación es trabajo activo y se aborda como tarea continua de las próximas iteraciones, no como un único PR. Se registra como pendiente para que cada iteración cite explícitamente qué reglas cerró.
   - **Cómo se ataca:**
     - Hacer un *gap report* por módulo (Entities, Forms, Processes Designer, Tasks, Instances) listando para cada `FE-NN` / `PD-NN` / regla del UX Spec si está cumplida, parcial o ausente.
     - Atacar el Diseñador de Procesos primero por ser el módulo diferenciador (Vision §6.3) y por ser donde la brecha es más severa.
     - Migrar la estructura de carpetas a la normativa de PD-03 antes de tocar comportamiento.
     - Reemplazar valores hex sueltos por consumo de `var(--token-*)` definidos en `src/styles/tokens.css` (UX Spec §3.1).
     - Introducir un componente `<StatusFrame>` en `src/ui/` que materialice los cuatro estados (UX Spec §3.5) y refactor de nodos, filas de tabla y cards de listados para usarlo.
     - Implementar el toggle de modo lista / modo concentración en `AppShell` con sidebar colapsable por route metadata.
   - **Documentación afectada cuando se cierre:** ninguna; este pendiente cierra contra documentación ya existente. Su cierre se evidencia con commits cuyos mensajes citan los `FE-NN` / `PD-NN` resueltos.
   - **Módulos afectados:** todos los módulos del frontend más `src/ui/` y `src/styles/`.
   - **Bloqueadores / dependencias:** ninguno. Es trabajo manual, incremental.

4. **P-004 — Auth y selector de proyecto del Admin Catalog en el frontend** · estado: `abierto`
   - **Qué es:** las pantallas de login, registro pendiente de activación, selector de proyecto y gestión de miembros que el SRS del Catálogo Administrativo v1.0 (§§ 6, FR-NN) y el UX Spec §§ 4.2–5 definen. Hoy el frontend MVP corre sin auth (FE-03: `X-User-Id` opcional desde env). El Admin Catalog vive como proyecto backend separado, pero el frontend necesita las pantallas y el wire-up para login / refresh / project selection cuando el backend administrativo esté listo.
   - **Por qué se difiere:** el alcance v1.0 del SRS Frontend lo declara explícitamente fuera (§1.3, §20). El frontend del MVP de UI prioriza el diseñador. Las pantallas de auth y selector de proyecto se implementan cuando el backend administrativo esté disponible para integrarse.
   - **Cómo se implementará:**
     - Pantalla `/login` con email/password + opciones SSO Google/Microsoft (Admin Catalog FR-02, FR-04). Usa UX Spec §5.1.
     - Pantalla `/select-project` con cards de proyectos del usuario (Admin Catalog FR-17). UX Spec §5.2.
     - Project selector en sidebar (UX Spec §4.3) que navega a `/select-project`, no abre un dropdown.
     - Interceptor de auth en `apiClient` que adjunta el JWT, atrapa 401, dispara refresh con rotación (FR-06), y redirige a `/login` cuando todo expira.
     - Pantallas administrativas de gestión de miembros (Admin Catalog §§ FR-20..FR-23) si el rol del usuario es `admin` de proyecto o `project_admin` global.
   - **Documentación afectada cuando se implemente:** SRS Frontend v1.1 — sacar de §20 "fuera de alcance" y añadir capítulos del módulo auth / project selection / admin de proyecto.
   - **Módulos afectados:** nuevo `src/features/auth/`, nuevo `src/features/projects/`, ajustes en `src/api/client.ts`, `src/app/router.tsx` y `AppShell`.
   - **Bloqueadores / dependencias:** disponibilidad del backend del Admin Catalog (proyecto separado) con sus endpoints REST `/admin/*`.

---

## Historial de versiones

| Versión | Fecha | Descripción |
| --- | --- | --- |
| 1.0 | Mayo 2026 | Versión inicial. Se registra P-001 (implementación de `data_view`). |
| 1.1 | Mayo 2026 | Se registra P-002 (proyecto dedicado de queries SQL en el backend). |
| 1.2 | Mayo 2026 | Se registra P-003 (reconciliación del frontend con UX Spec v1.0 y Process Designer SRS v1.0) y P-004 (auth y selector de proyecto del Admin Catalog en el frontend). |

*— Fin del documento —*