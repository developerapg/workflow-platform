# CHANGESET — Decisiones de Implementación vs Documentación

**Workflow Platform · Frontend**

*Registro de decisiones tomadas durante la implementación que divergen de los documentos normativos, con justificación y estado. Complementa `pendientes.md` (que registra trabajo diferido) y la documentación de especificación (que es la fuente de verdad). Este documento no reemplaza ningún documento normativo — registra dónde y por qué la implementación tomó un camino distinto al especificado.*

Mayo 2026 · v1.0 · Documento interno

---

## Convenciones

- Cada entrada tiene un identificador `CS-NNN` referenciable desde commits y PRs.
- **Tipo:**
  - `DELIBERADA` — decisión consciente; la spec se actualiza o acepta la divergencia.
  - `PENDIENTE-CORRECCIÓN` — bug o incumplimiento a corregir; se resuelve en la próxima iteración.
  - `SIMPLIFICACIÓN-MVP` — la spec define el comportamiento completo; se implementó una versión reducida válida para MVP.
- **Estado:** `activo` (la divergencia existe en el código), `cerrado` (resuelta y alineada con spec).

---

## Proceso: Diseñador de Procesos

### CS-001 · Botón "+" contextual — sin popover de tipos · SIMPLIFICACIÓN-MVP · activo

- **Spec (PD-45 a PD-49):** Click sobre el "+" abre un popover con los 5 tipos de nodo. El usuario elige el tipo. El tipo `start` aparece deshabilitado si ya existe uno.
- **Implementación:** Click sobre el "+" crea directamente un nodo `human_task` a la derecha con auto-conexión. No hay popover de selección.
- **Justificación:** El `human_task` es el tipo más frecuente en procesos reales (es el único ejecutable en MVP). El popover añade un paso que en la mayoría de los casos resulta en elegir siempre "Tarea humana". Para procesos lineales —el patrón del MVP— la creación directa es más rápida. Para otros tipos el usuario usa la paleta lateral (que sí está implementada con todos los tipos).
- **Consecuencia aceptada:** El flujo PD-51 ("Inicio destacado en popover de canvas vacío") no aplica; en canvas vacío el botón grande crea directamente el nodo `start`.
- **Reglas afectadas:** PD-45, PD-46, PD-47, PD-48, PD-49, PD-51, PD-52.
- **Para cerrar:** Implementar el popover con `<NodeTypePopover>` reutilizando las cards de `NodePalette`. Prioridad: post-MVP cuando el usuario necesite crear `exclusive_gateway` frecuentemente desde el "+".

---

### CS-002 · Handles de nodos intermedios — asimétricos en lugar de bidireccionales · PENDIENTE-CORRECCIÓN · activo

- **Spec (PD-72):** `human_task`, `script_task` y `exclusive_gateway` deben tener handles bidireccionales: cada posición (top/right/bottom/left) actúa como `source` **y** `target` simultáneamente, implementado con dos handles superpuestos por dirección (`id: 'top-source'` y `id: 'top-target'`).
- **Implementación:** Los nodos intermedios tienen 4 handles asimétricos: Top/Left como `target`, Right/Bottom como `source`. No son bidireccionales.
- **Justificación del estado actual:** La asimetría fue una primera aproximación que cubre el flujo más común (izquierda→derecha). El impacto es que el usuario no puede arrastrar una transición *desde* el lado superior o izquierdo de un nodo intermedio hacia otro nodo.
- **Consecuencia:** Restricción de conectividad en procesos con layout vertical o en diagonal. PD-74 ("eliminar la restricción de solo lado derecho") no se cumple.
- **Corrección:** Duplicar handles por dirección con IDs explícitos (`top-source`/`top-target`, etc.). React Flow soporta handles superpuestos; el enrutado smoothstep los resuelve automáticamente.
- **Reglas afectadas:** PD-72, PD-74.

---

### CS-003 · StartNode — 4 handles source, sin handles Top/Left · PENDIENTE-CORRECCIÓN · activo

- **Spec (PD-70):** `start` tiene 4 handles, todos `source` (no acepta entradas — VR-28).
- **Implementación:** `StartNode` tiene solo 2 handles `source`: `Position.Right` y `Position.Bottom`. Faltan `Position.Top` y `Position.Left`.
- **Consecuencia:** El usuario no puede arrastrar una transición desde el lado superior o izquierdo del nodo de inicio. Impacta procesos con layout no lineal (ej. inicio arriba, flujo hacia abajo).
- **Corrección:** Agregar `<Handle type="source" position={Position.Top} />` y `<Handle type="source" position={Position.Left} />`.
- **Reglas afectadas:** PD-70.

---

### CS-004 · StartNode y EndNode — sin etiqueta de texto visible · PENDIENTE-CORRECCIÓN · activo

- **Spec (PD-132):** `StartNode` muestra la etiqueta "Inicio" en 11px debajo del círculo.
- **Spec (PD-142):** `EndNode` muestra "Fin" o el `result_label` configurado debajo del círculo.
- **Implementación:** Ambos nodos solo tienen `title="Inicio"` y `title="Fin"` (tooltips nativos del browser), sin texto visible en el canvas.
- **Consecuencia:** Los nodos son menos reconocibles visualmente, especialmente para usuarios nuevos. No hay forma de ver el `result_label` del `end` en el canvas.
- **Corrección:** Añadir un `<div>` debajo del círculo con la etiqueta. En `EndNode`, leer `data.resultLabel` y mostrar su valor o "Fin" como fallback.
- **Reglas afectadas:** PD-132, PD-142.

---

### CS-005 · Minimap — color uniforme en lugar de color por estado · PENDIENTE-CORRECCIÓN · activo

- **Spec (PD-111):** El minimap renderiza cada nodo con el color de su estado de validación: verde (`configured`), ámbar (`warning`), rojo (`error`), gris (`draft`).
- **Implementación:** `nodeColor="var(--action-primary)"` — todos los nodos aparecen en azul independientemente de su estado.
- **Consecuencia:** El minimap no sirve como indicador rápido de salud del proceso en procesos grandes.
- **Corrección:** Usar la forma función de `nodeColor`: `nodeColor={(node) => nodeStatusColor(node.data.nodeState)}`.
- **Reglas afectadas:** PD-111.

---

### CS-006 · Canvas vacío — botón "+" sin popover · SIMPLIFICACIÓN-MVP · activo

- **Spec (PD-50, PD-51):** Canvas vacío muestra un botón "+" grande centrado. Click abre un popover con los 5 tipos; "Inicio" aparece destacado con badge "Recomendado".
- **Implementación:** El botón "+" grande crea directamente un nodo `start` sin popover. Corolario de CS-001.
- **Justificación:** El primer nodo de cualquier proceso es siempre `start` (VR-25). Crear el popover para esta acción añade fricción innecesaria. El texto "Comienza añadiendo el nodo de Inicio" orienta al usuario.
- **Consecuencia aceptada:** PD-52 (toast si el usuario elige tipo distinto de `start` desde el botón grande) no aplica porque no hay popover.
- **Reglas afectadas:** PD-50, PD-51, PD-52.

---

### CS-007 · Pan y zoom — rango no explicitado en código · SIMPLIFICACIÓN-MVP · activo

- **Spec (PD-101):** Zoom rango 25%–200%. Pan con click izquierdo sobre canvas vacío o con rueda presionada.
- **Implementación:** No se configura explícitamente `minZoom`, `maxZoom`, `panOnScroll` ni `zoomOnScroll` en `<ReactFlow>`. Se usan los defaults de React Flow 11 (zoom 0.5×–2×, pan estándar).
- **Consecuencia:** El rango de zoom por defecto de RF11 (50%–200%) difiere levemente del spec (25%–200%). El comportamiento de pan/zoom funciona correctamente por los defaults.
- **Corrección:** Agregar `minZoom={0.25} maxZoom={2}` al componente `<ReactFlow>` para alinear el rango exacto.
- **Reglas afectadas:** PD-101.

---

### CS-008 · Estructura de carpetas — no sigue PD-03 · DELIBERADA · activo

- **Spec (PD-03):** Sub-estructura normativa `src/features/processes/designer/` con `canvas/`, `nodes/`, `edges/`, `palette/`, `properties/`, `validation/`, `persistence/`.
- **Implementación:** Los archivos viven en `src/features/processes/canvas/nodes/`, `src/features/processes/canvas/palette/`, `src/features/processes/components/` y `src/features/processes/validation.ts`.
- **Justificación:** La migración fue registrada como P-003 en `pendientes.md` antes de comenzar la implementación activa. La reorganización es trabajo de refactor puro (sin cambios de comportamiento) que se hace cuando el canvas esté estable, para evitar conflictos en ramas activas.
- **Consecuencia aceptada:** La estructura actual es funcional pero no sigue la normativa de PD-03.
- **Documentación afectada:** `pendientes.md` P-003 ya lo registra.
- **Para cerrar:** Mover archivos a la estructura PD-03 y actualizar todos los imports. Sin cambios de lógica.
- **Reglas afectadas:** PD-03.

---

### CS-009 · Colores de tipo en paleta — tokens aproximados · DELIBERADA · activo

- **Spec (PD-25):** `start` → `#34D399` (verde de tipo distinto de `state-success`). `exclusive_gateway` → `#FBBF24` (ámbar).
- **Implementación:** `start` → `#10b981` (verde más oscuro, coincide con `--state-success`). `exclusive_gateway` → `#f59e0b` (ámbar más oscuro, coincide con `--state-warning`).
- **Justificación:** Se usaron los tokens CSS ya definidos en `tokens.css` para mantener consistencia con el sistema de design tokens. Los valores del spec son tonos ligeramente más claros que no tienen token en `tokens.css` v1.0. Usar valores hex sueltos contradiría UX Spec §3.1 ("no hardcodear hex en componentes").
- **Consecuencia aceptada:** Diferencia cromática menor (±10% de luminosidad). Los UX Spec §3.1.5 menciona "colores de tipo semántico-libre" pero no los define como tokens propios aún.
- **Para cerrar:** Cuando se extienda `tokens.css` con `--type-start`, `--type-decision`, etc. (UX Spec §3.1.5 pendiente de tokenizar), actualizar `NodePalette.tsx` y los nodos para consumir esos tokens.
- **Reglas afectadas:** PD-25, UX Spec §3.1.5.

---

### CS-010 · Panel de propiedades — sin campos "Etiqueta visible" separada de "Nombre técnico" · SIMPLIFICACIÓN-MVP · activo

- **Spec (PD-181):** Cada nodo tiene dos campos comunes en el panel: "Nombre técnico" (validado VR-40) y "Etiqueta visible" (texto libre, usado en el canvas como display name).
- **Implementación:** El panel tiene solo "Nombre técnico". El canvas muestra `name.replace(/_/g, ' ')` como etiqueta de display (aproximación automática).
- **Justificación:** Para el MVP los nombres técnicos en snake_case ya se convierten automáticamente a etiqueta legible. Añadir un segundo campo aumenta la fricción de configuración sin aportar valor diferenciador en procesos simples.
- **Consecuencia aceptada:** El usuario no puede personalizar la etiqueta de display independientemente del nombre técnico. Procesos con nombres técnicos crípticos requieren que el usuario elija nombres descriptivos.
- **Para cerrar:** Agregar campo `label` en el formulario de cada nodo en `ProcessPropertiesPanel.tsx`, alimentarlo en `data.label` al crear/actualizar nodos, y consumirlo en los custom nodes como primera opción de display.
- **Reglas afectadas:** PD-181.

---

## Sistema de estados visuales (cross-module)

### CS-011 · StatusFrame vs artifactState en Card — dos enfoques coexisten · DELIBERADA · activo

- **Spec (UX Spec §3.5):** Define un sistema unificado de 4 estados visuales para cualquier elemento configurable.
- **Implementación:** Se creó `StatusFrame.tsx` como wrapper genérico, y `Card.tsx` se extendió con prop `artifactState` que implementa el mismo sistema directamente. Los nodos del proceso usan clases CSS condicionales propias en lugar de `StatusFrame`.
- **Justificación:** Los nodos de React Flow no pueden anidarse limpiamente dentro de `StatusFrame` por cómo RF11 maneja el DOM. La implementación por clases condicionales produce el mismo resultado visual.
- **Consecuencia aceptada:** Tres implementaciones paralelas del mismo sistema visual. No hay inconsistencia en el resultado pero sí en el código.
- **Para cerrar:** Cuando se migre a la estructura PD-03, consolidar en `NodeShell` como única implementación para nodos. `StatusFrame` queda para elementos no-canvas (cards de lista, field cards de formulario).
- **Reglas afectadas:** UX Spec §3.5, PD-120.

---

## Historial de versiones

| Versión | Fecha | Descripción |
|---------|-------|-------------|
| 1.0 | Mayo 2026 | Versión inicial. Registra CS-001 a CS-011: decisiones del primer ciclo de implementación del Process Designer y el sistema de estados visuales cross-module. |

*— Fin del documento —*
