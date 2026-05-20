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

---

## Historial de versiones

| Versión | Fecha | Descripción |
| --- | --- | --- |
| 1.0 | Mayo 2026 | Versión inicial. Se registra P-001 (implementación de `data_view`). |
| 1.1 | Mayo 2026 | Se registra P-002 (proyecto dedicado de queries SQL en el backend). |

*— Fin del documento —*