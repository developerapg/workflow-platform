# SRS — DISEÑADOR DE PROCESOS (FRONTEND)

**Workflow Platform**

*Especificación dedicada del componente visual de diseño de procesos sobre React Flow: interacciones, custom nodes, edges, paleta y comportamiento de conexión.*

Mayo 2026 · v1.0 · Confidencial — Documento interno

---

# 1. Introducción

## 1.1 Propósito

Este documento especifica de forma **dedicada y exhaustiva** el módulo del **Diseñador de Procesos** dentro del frontend de Workflow Platform. Es un documento de profundización que se desprende del SRS Frontend v1.0 §8 (Módulo Procesos), ampliándolo donde la implementación realizada reveló que la especificación original era insuficiente para producir una experiencia de uso aceptable.

El SRS Frontend v1.0 describe el módulo a nivel arquitectónico (rutas, datos, hooks, integración con el canvas). Este documento describe el **diseñador en sí**: cómo se ve el canvas, cómo se crean nodos, cómo se trazan transiciones, qué hace el usuario con el mouse y el teclado, y qué constituye una experiencia de calidad en este componente — que es el más importante y diferenciador del MVP.

## 1.2 Motivación

La primera implementación del diseñador siguió el comportamiento por defecto de React Flow:

1. Para crear un nodo, el usuario debe hacer click en un elemento de la paleta lateral (no hay drag and drop real).
2. Los items de la paleta son cuadros grises planos sin identidad visual del tipo de nodo que representan.
3. Las transiciones se crean arrastrando milimétricamente desde un único handle de borde del nodo origen hasta un único handle de borde del nodo destino.
4. Los nodos tienen handles fijos en un solo lado (p. ej. el nodo `end` solo acepta conexión por la izquierda), lo que restringe severamente la organización visual del proceso.
5. Las edges de React Flow por defecto son curvas Bézier muy pronunciadas, que en grafos complejos generan cruces y confusión visual.

El UX Spec v1.0 §7.4 ya había definido un patrón superior: un botón **"+" contextual** que aparece al hacer hover sobre un nodo y que, al activarse, crea un nuevo nodo a su derecha y traza la transición automáticamente. Este patrón es el estándar de facto en herramientas modernas de automatización de flujos (n8n, Zapier, Make) y es el que ofrece la curva de aprendizaje más corta.

Este SRS:

- **Reafirma y formaliza** la especificación del UX Spec §7.4 (botón "+" contextual) y la convierte en requisitos implementables del frontend (`PD-NN`).
- **Resuelve los cinco defectos** identificados en la implementación actual con requisitos explícitos.
- **Establece el contrato técnico** entre el código del feature `features/processes/designer/` y el resto del frontend.
- **Confirma React Flow** como librería base y enumera explícitamente qué capacidades de React Flow se usan para cada requisito.

## 1.3 Alcance

| Incluido en v1.0 de este SRS | Fuera de alcance |
| --- | --- |
| Comportamiento detallado del canvas: pan, zoom, selección, snap a grid. | Diseño pixel-perfect (eso vive en el Design System derivado del UX Spec). |
| Paleta de nodos: visual con icono coloreado, drag-and-drop al canvas y click como alternativa. | Paleta extensible vía metadata (los tipos del MVP son 5 fijos; abrir el catálogo se difiere). |
| Botón "+" contextual sobre nodos (hover, popover de tipos, creación con transición auto). | "+" multi-salida para `exclusive_gateway` con etiquetado por rama (se especifica como diferido a v1.1 del diseñador). |
| Custom nodes para los 5 tipos: `start`, `end`, `human_task`, `script_task`, `exclusive_gateway`. | Tipos de nodo adicionales (paralelo, eventos intermedios, sub-procesos). |
| Handles en las 4 direcciones (top, right, bottom, left) en cada nodo, con reglas de conexión por tipo. | Múltiples handles por lado (más de 4 puntos de conexión por nodo). |
| Edges ortogonales (smoothstep) con esquinas redondeadas y enrutado automático. | Edges curvas tipo Bézier libres (se descartan; ver §6.1). |
| Validación visual en tiempo real (borde de estado por nodo, banner de proceso, popovers por error). | Validación cliente del proceso completo en sentido motor (sigue en Frontend SRS §13.2). |
| Persistencia vía `POST /api/persist` batch (sin modificar el contrato del backend). | Auto-save (sigue diferido). |
| Atajos de teclado mínimos: Delete, Cmd/Ctrl+S, Esc. | Undo/redo del canvas (sigue diferido). |

## 1.4 Documentos de referencia

| Documento | Versión | Cómo se usa aquí |
| --- | --- | --- |
| Workflow Platform — Documento de Visión | 1.0 | Visión global; cuál es el rol del diseñador en el producto. |
| UX Spec — Workflow Platform | 1.0 | **Fuente normativa de la experiencia de usuario.** Este SRS implementa específicamente §7.2, §7.3, §7.4, §7.5, §7.6, §7.7 y §7.8. |
| SRS Frontend — Workflow Platform | 1.0 | **Documento padre.** Este SRS profundiza §8 (Módulo Procesos) sin reemplazarlo. Estructura del proyecto, stack, configuración, manejo de errores, server state — todo vive ahí y se hereda. Las reglas `FE-100` a `FE-122` siguen vigentes y se citan donde aplican. |
| Definición de Metadata | 1.1 | Firmas JSON de `process_definition`, `node` y `Transition`. Catálogos de `node_type`. Reglas VR-25 a VR-31. |
| SRS Backend | 1.1 | Contrato del endpoint `POST /api/persist` consumido por el diseñador. |
| Pendientes | 1.1 | Decisiones diferidas referenciadas (P-001, P-002). |

## 1.5 Convenciones del documento

- **Identificadores `PD-NN`** designan requisitos funcionales del diseñador (PD = Process Designer). Numeración independiente de los `FE-NN` del SRS Frontend.
- **"Nodo origen"** y **"nodo destino"** son los extremos de una transición; nunca usar "nodo padre/hijo" en este contexto (el grafo es un DAG, no un árbol).
- **"Card"** designa el contenedor visual de un nodo en el canvas (rectángulo, círculo o rombo según tipo).
- **"Handle"** es el punto físico de un nodo donde una edge se conecta o desconecta. Convención de React Flow.
- **"Edge"** es la representación interna de una transición en el estado del canvas. La transición es el concepto de dominio; la edge es la representación gráfica.
- **"Paleta"** es la lista lateral de tipos de nodo arrastrables al canvas. Se conserva además del patrón "+" contextual del UX Spec.

---

# 2. Decisiones arquitecturales

## 2.1 Elección de librería: React Flow se confirma

Antes de redactar este SRS se evaluó si React Flow era la herramienta adecuada para alcanzar la experiencia objetivo del UX Spec §7.4. La conclusión es **sí, React Flow se mantiene** por las siguientes razones:

| Capacidad requerida por este SRS | Mecanismo de React Flow |
| --- | --- |
| Custom nodes con React, estilo con Tailwind | API `nodeTypes` + `NodeProps<TData>`. |
| Drag desde paleta externa al canvas | `onDrop` + `onDragOver` + `screenToFlowPosition()`. Patrón documentado oficialmente. |
| Botón "+" sobre nodo en hover | Renderizado dentro del custom node con CSS `:hover` (no requiere API especial). |
| Handles en las 4 direcciones | `<Handle position={Position.Top \| Right \| Bottom \| Left} />` múltiples por nodo. |
| Conexión por arrastre desde cualquier handle | `onConnect` callback nativo. |
| Edges ortogonales redondeadas | `type: 'smoothstep'` con `pathOptions: { borderRadius }`. |
| Edges custom con label, validación, color por estado | `edgeTypes` con `<BaseEdge>` y `<EdgeLabelRenderer>`. |
| Minimap, controls, background dotted | Componentes `<MiniMap>`, `<Controls>`, `<Background variant="dots">`. |
| Snap a grid de 20px | Props `snapToGrid` + `snapGrid={[20, 20]}`. |
| Auto-layout (post-MVP) | Integración con `dagre` o `elkjs`. |

No se identificó ningún requisito de este SRS que React Flow no pueda satisfacer. Cambiar de librería en este momento sería costoso, retrasaría la entrega y no resolvería el problema raíz, que es de especificación (la implementación actual usó el preset por defecto de React Flow en lugar de aplicar el UX Spec).

- **PD-01:** El feature `features/processes/designer/` usa **React Flow 11.x** como base del canvas. No se evalúan ni se permiten librerías alternativas (Drawflow, Rete.js, bpmn-js, react-diagrams) en v1.0. Cualquier sustitución requiere una nueva versión de este SRS.

## 2.2 Versión de React Flow

- **PD-02:** Se fija la versión **`reactflow@^11.11`** (la última estable de la serie 11). La migración a `@xyflow/react` (serie 12) se evalúa después del MVP y queda registrada en `pendientes.md`.

## 2.3 Estructura de carpetas del feature

Dentro del frontend, el diseñador vive en `src/features/processes/`. Su sub-estructura, derivada de FE-220 del Frontend SRS:

```
src/features/processes/
├── ProcessList.tsx                  // Pantalla de listado (sin cambios respecto a FE)
├── ProcessDetail.tsx                // Pantalla del editor (orquesta el diseñador)
├── designer/                        // ★ Componente foco de este SRS
│   ├── ProcessDesigner.tsx          // Componente top-level del canvas
│   ├── canvas/
│   │   ├── CanvasShell.tsx          // <ReactFlowProvider>, <ReactFlow>, controles
│   │   ├── CanvasToolbar.tsx        // Toolbar flotante (zoom, validar, auto-layout)
│   │   ├── CanvasMinimap.tsx        // Minimap configurado
│   │   ├── CanvasBackground.tsx     // Background dotted con tokens del UX Spec
│   │   └── canvasState.ts           // Hook useCanvasState (nodes, edges, selección)
│   ├── nodes/
│   │   ├── StartNode.tsx
│   │   ├── EndNode.tsx
│   │   ├── HumanTaskNode.tsx
│   │   ├── ScriptTaskNode.tsx
│   │   ├── ExclusiveGatewayNode.tsx
│   │   ├── NodeShell.tsx            // Wrapper común: borde de estado, hover "+", handles
│   │   ├── AddNodeButton.tsx        // El botón "+" contextual y su popover
│   │   └── nodeRegistry.ts          // type → {component, defaultConfig, icon, color, label}
│   ├── edges/
│   │   ├── TransitionEdge.tsx       // Custom edge smoothstep con label y color
│   │   └── edgeUtils.ts             // Helpers de path, midpoint, etc.
│   ├── palette/
│   │   ├── NodePalette.tsx          // Paleta lateral con drag and drop
│   │   └── PaletteCard.tsx          // Card individual de un tipo de nodo
│   ├── properties/
│   │   ├── PropertiesPanel.tsx      // Panel derecho colapsable
│   │   ├── NodeProperties.tsx       // Render según tipo
│   │   └── TransitionProperties.tsx
│   ├── validation/
│   │   ├── processRules.ts          // VR-25..VR-31 en TS, reutilizadas en cliente
│   │   ├── useProcessValidation.ts  // Hook que recalcula estados de nodos
│   │   └── nodeStatus.ts            // 'configured' | 'warning' | 'error' | 'draft'
│   └── persistence/
│       ├── designerToBatch.ts       // Convierte estado local en operations del /persist
│       └── batchToDesigner.ts       // Convierte respuesta del backend en estado local
└── api/                             // Hooks de TanStack Query (heredados de FE)
    ├── useReadProcess.ts
    └── usePersistProcess.ts
```

- **PD-03:** Esta estructura es normativa. No se permiten archivos del diseñador fuera de `features/processes/designer/` excepto por las dos pantallas top-level (`ProcessList`, `ProcessDetail`) y los hooks de API.

## 2.4 Estado del canvas — fuente única de verdad

- **PD-04:** El estado del canvas (`nodes: Node[]`, `edges: Edge[]`, `selectedNodeId`, `selectedEdgeId`, `viewport`) vive en `canvasState.ts` y se gestiona con **`useNodesState` + `useEdgesState`** de React Flow, expuestos mediante un contexto local del diseñador (`DesignerContext`). No se introduce Zustand ni Redux. El alcance es local al editor.
- **PD-05:** Todo cambio en el canvas (mover, conectar, crear, eliminar) produce una nueva versión del estado vía los setters de React Flow. El estado nunca se muta in-place.
- **PD-06:** El estado se **persiste localmente** (sin localStorage) durante la sesión de edición. Solo al pulsar "Guardar" se traduce a un batch y se envía a `POST /api/persist` (ver §10).
- **PD-07:** El `viewport` (`zoom`, `x`, `y`) se persiste en `localStorage` con clave `process-{id}-viewport` (heredado de FE-122). Restaurado al reabrir el editor.

---

# 3. Layout del diseñador

Este capítulo materializa el UX Spec §7.2 con requisitos implementables. El layout del editor en modo concentración tiene cuatro zonas:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ☰  ← Cliente / Proyecto / Procesos / [Nombre]  ⚠Sin guardar  Validar │
├──────────────────────────────────────────────────────────────────────┤
│ ● Configurado  ● Advertencia  ● Error  ● Sin configurar              │
├──────────┬───────────────────────────────────────────┬───────────────┤
│          │                                           │               │
│  PALETA  │   ┌──────────┐                            │ PROPIEDADES   │
│          │   │ Toolbar  │                            │               │
│  • Ini   │   └──────────┘                            │  [contenido   │
│  • UTask │                                           │   según nodo  │
│  • STask │           CANVAS                          │   o trans.    │
│  • Gtwy  │      (dotted background)                  │   seleccion.] │
│  • Fin   │                                           │               │
│          │                                           │               │
│          │   ┌──────────┐                            │               │
│          │   │ Minimap  │                            │               │
│          │   └──────────┘                            │               │
└──────────┴───────────────────────────────────────────┴───────────────┘
```

Diferencia respecto al UX Spec: el UX Spec §7.4 dice "no hay paleta fija visible". Este SRS **reintroduce una paleta lateral** además del "+" contextual, por dos razones:

1. Atender el patrón de drag-and-drop que muchos usuarios esperan de herramientas tipo BPMN.
2. Cumplir el requisito del usuario (punto 4 del feedback original) de que el comportamiento drag-and-drop esté disponible.

El "+" contextual del UX Spec §7.4 sigue siendo el **camino principal** y recomendado. La paleta lateral es complementaria y se puede colapsar.

## 3.1 Anchos y alturas

| Zona | Ancho/Alto | Notas |
| --- | --- | --- |
| Header con breadcrumb | 56px alto | Heredado del Frontend SRS / UX Spec. |
| Leyenda de estados | 36px alto | UX Spec §7.3.4. |
| Paleta | 220px ancho | Colapsable a slim rail 32px. |
| Canvas | flex: 1 | Ocupa todo el espacio restante. |
| Propiedades | 320px ancho | UX Spec §7.2 dice 280px; se eleva a 320px para acomodar formularios de configuración de `human_task`. Colapsable a slim rail 32px. |

- **PD-10:** La paleta y el panel de propiedades son **colapsables independientemente**. El estado expandido/colapsado se persiste por usuario en `localStorage` (claves `designer-palette-collapsed` y `designer-properties-collapsed`).
- **PD-11:** Si ambas se colapsan, el canvas se expande al ancho completo. Esta es la configuración recomendada para revisión visual de procesos grandes.

## 3.2 Header y acciones

- **PD-12:** El header del editor incluye, de izquierda a derecha: icono hamburguesa (abre sidebar de módulos), breadcrumb, nombre del proceso editable inline (click → input), chip "Sin guardar" cuando hay cambios pendientes, y botones de acción.
- **PD-13:** Los botones de acción son: **Validar** (secondary), **Iniciar** (secondary, solo si `status='configured'`) y **Guardar** (primary). El nombre del status se muestra como chip a la izquierda del primer botón ("Borrador" o "Configurado").
- **PD-14:** El botón "Guardar" está deshabilitado si no hay cambios pendientes. Hover sobre él muestra tooltip "Sin cambios para guardar".
- **PD-15:** El intento de cerrar la pestaña o navegar a otra ruta con cambios sin guardar dispara un `beforeunload` que pide confirmación al usuario.

---

# 4. Paleta de nodos

Este capítulo resuelve los puntos 4 y 5 del feedback original (paleta sin diseño visual, no soporta drag-and-drop real).

## 4.1 Layout de la paleta

- **PD-20:** La paleta es un panel lateral izquierdo con título "AGREGAR NODO" en label uppercase 10px (token `label` del UX Spec §3.2). Debajo, una lista vertical de cards, una por cada tipo de nodo del catálogo.
- **PD-21:** Hay exactamente 5 cards en la paleta v1.0, en este orden: `start` (Inicio), `human_task` (Tarea de usuario), `script_task` (Tarea de sistema), `exclusive_gateway` (Decisión), `end` (Fin).
- **PD-22:** La card del nodo `start` está deshabilitada visualmente (opacidad 50%, cursor `not-allowed`) cuando el proceso ya tiene un nodo `start`. Tooltip explica: "Ya existe un nodo Inicio. Solo se permite uno por proceso." (VR-25).
- **PD-23:** Las cards de `script_task` y `exclusive_gateway` muestran un mini-badge ⚠ "MVP" en la esquina superior derecha. Tooltip: "Este tipo no se ejecuta en el motor MVP, pero puedes diseñarlo." (consistente con FE-104).

## 4.2 Diseño visual de cada PaletteCard

Resuelve el punto 5 del feedback original (cuadros grises sin diseño).

- **PD-24:** Cada PaletteCard contiene tres elementos verticalmente:
  1. **Mini-icono del tipo de nodo** — la **misma figura que se dibujará en el canvas**, en tamaño reducido (40-48px de alto, manteniendo proporción). Para `start` y `end` es un círculo del color de tipo. Para `human_task` y `script_task` es un mini-rectángulo redondeado con su icono interno (`user` o `code-2`). Para `exclusive_gateway` es un mini-rombo.
  2. **Etiqueta UI en español**, peso 500, tamaño 12px ("Inicio", "Tarea de usuario", "Tarea de sistema", "Decisión", "Fin").
  3. **Identificador técnico en monospace**, tamaño 10px, color `text-tertiary` (`start`, `human_task`, ...). Visible solo si la paleta está expandida al ancho completo; si está en modo compacto (160px o menos), se oculta.
- **PD-25:** El fondo de la card es `bg-surface`. El icono va dentro de un bloque redondeado con fondo `rgba(<type-color>, 0.18)` y el icono en `<type-color>` saturado (UX Spec §3.3). Los colores de tipo son los del UX Spec §3.1.5:
  - `start` → fondo verde tenue (no `state-success`; usar un verde de tipo diferente para no contradecir Principio 2). En v1.0 se usa `#34D399` 18% como fondo y el círculo en `#34D399`.
  - `end` → fondo gris (`state-neutral` 18%, círculo gris).
  - `human_task` → `type-user-task` (azul `#60A5FA`).
  - `script_task` → `type-system-task` (púrpura `#A78BFA`).
  - `exclusive_gateway` → `type-decision` (ámbar `#FBBF24`).
- **PD-26:** Hover state de la card: borde de 1px del color de tipo aparece, cursor cambia a `grab`. Active (mientras se arrastra): cursor `grabbing`, opacity 0.7.
- **PD-27:** La PaletteCard expone `aria-label="Arrastrar al canvas para crear un nodo de tipo X"` para accesibilidad.

## 4.3 Drag and drop al canvas

Resuelve el punto 4 del feedback original.

- **PD-30:** Cada PaletteCard es draggable nativo HTML (`draggable="true"`). En `onDragStart` setea `dataTransfer` con `type` igual a `application/reactflow` y `data` igual al `nodeType` (`start`, `human_task`, etc.).
- **PD-31:** El componente `CanvasShell` registra `onDragOver` (con `preventDefault()`) y `onDrop` sobre el div contenedor de `<ReactFlow>`. En `onDrop`, lee `dataTransfer`, llama a `reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })` para obtener las coordenadas en el sistema del canvas, y agrega el nodo nuevo al estado.
- **PD-32:** El nodo nuevo creado por drop tiene:
  - Un `id` generado por la función `nanoid()` (no UUID; se prefija con `tmp_` para diferenciarlo de IDs persistidos).
  - El `node_type` indicado por la card arrastrada.
  - Un `name` autogenerado siguiendo el patrón `{node_type}_{n}` donde `n` es el siguiente número disponible en el proceso (p. ej. `human_task_1`, `human_task_2`). El usuario lo puede renombrar luego en el panel de propiedades.
  - `position_x`, `position_y` igual al resultado de `screenToFlowPosition()`, ajustado al grid de 20px (snap implícito).
  - `config` igual al `defaultConfig` del `nodeRegistry` para ese tipo (objeto vacío `{}` para todos los tipos en v1.0; las configuraciones específicas se llenan en el panel de propiedades).
- **PD-33:** El nuevo nodo creado por drop queda **seleccionado** automáticamente (`selectedNodeId` se actualiza), abriendo el panel de propiedades a la derecha.
- **PD-34:** Si el usuario suelta sobre un nodo ya existente, el drop se cancela (el nodo nuevo no se crea). Feedback visual: durante el `dragOver` sobre un nodo, el nodo destino muestra un borde rojo dashed indicando "no se puede soltar aquí".

## 4.4 Click como alternativa

El feedback original menciona que la implementación actual usa click. Aunque este no es el patrón intuitivo, se mantiene como **fallback de accesibilidad** y para teclado:

- **PD-35:** Click sobre una PaletteCard (sin drag) crea el nodo en el centro del viewport actual. Si ya hay un nodo en esa posición, se desplaza 40px abajo-derecha hasta encontrar espacio libre.
- **PD-36:** Doble click sobre una PaletteCard tiene el mismo efecto que un click simple (no se distinguen).
- **PD-37:** Tab + Enter sobre una PaletteCard equivale a click (accesibilidad por teclado).

---

# 5. Botón "+" contextual

Este capítulo materializa el UX Spec §7.4 (la pieza más importante para resolver los puntos 1 y 2 del feedback original).

## 5.1 Comportamiento general

- **PD-40:** Al hacer hover sobre cualquier nodo del canvas (excepto `end`), aparece un botón circular azul "+" pegado al lado derecho del nodo, parcialmente solapado (centro del botón a la derecha del borde del nodo, no del centro del nodo).
- **PD-41:** El botón "+" tiene 24px de diámetro, fondo `action-primary` (`#2563EB`), texto blanco, icono `plus` de Lucide a 16px. Hover sobre el botón: fondo `action-primary-hover` (`#1D4ED8`), elevación con shadow sutil.
- **PD-42:** El botón "+" no aparece sobre nodos `end` (un `end` no tiene salida — VR-28).
- **PD-43:** El botón "+" se renderiza dentro del propio custom node con CSS `:hover` puro (no requiere lógica de React adicional). Esto garantiza que el botón aparece tan pronto como el cursor entra al área del nodo y desaparece tan pronto como sale, sin lag.
- **PD-44:** Cuando el botón "+" está renderizado, el evento `onMouseEnter` del botón **mantiene** la visibilidad incluso si el cursor sale del área del nodo (transición suave del cursor al botón sin que desaparezca). Implementación: el área hover del botón se extiende 8px alrededor para crear una zona de tolerancia.

## 5.2 Click sobre el "+"

- **PD-45:** Click sobre el botón "+" abre un **popover** con la lista de tipos de nodo disponibles para encadenar.
- **PD-46:** El popover muestra los mismos 5 tipos de la paleta, en el mismo orden, con el mismo diseño visual de PaletteCard (icono coloreado + etiqueta). El tipo `start` está deshabilitado si ya existe uno en el proceso (consistente con PD-22).
- **PD-47:** El popover se posiciona a la derecha del botón "+", offset 8px. Si no hay espacio (cerca del borde derecho del viewport), se reposiciona automáticamente (Popper.js o equivalente). Z-index garantiza que aparece sobre el resto del canvas pero debajo de los modales del editor.
- **PD-48:** Click sobre uno de los tipos en el popover:
  1. Cierra el popover.
  2. Crea un nuevo nodo del tipo seleccionado.
  3. Posiciona el nuevo nodo **a la derecha del nodo origen, alineado en el mismo Y**, a 200px de distancia (medido entre centros). Si esa posición ya está ocupada por otro nodo, se desplaza 40px hacia abajo iterativamente hasta encontrar espacio libre.
  4. Snap-aligna la posición al grid de 20px.
  5. Crea una **transición** del nodo origen al nuevo nodo, con label vacío y sin condición.
  6. Selecciona el nuevo nodo, abriendo el panel de propiedades.
- **PD-49:** Esc o click fuera del popover cierran el popover sin crear nada.

## 5.3 "+" en canvas vacío

- **PD-50:** Cuando el canvas no tiene ningún nodo, aparece un botón "+" grande (64px de diámetro) centrado vertical y horizontalmente en el viewport, con el texto debajo "Comienza añadiendo el nodo de Inicio" en `text-tertiary` 13px.
- **PD-51:** Click sobre el botón grande despliega el popover con los 5 tipos. La opción "Inicio" aparece **destacada** (borde `action-primary` 1px, badge "Recomendado" en azul).
- **PD-52:** Si el usuario elige cualquier tipo distinto de "Inicio" desde el botón grande, se crea ese tipo y aparece un toast informativo: "Recuerda que cada proceso necesita exactamente un nodo Inicio." (VR-25).

## 5.4 "+" en `exclusive_gateway` con múltiples salidas (diferido a v1.1)

El UX Spec §7.4.2 menciona un comportamiento de múltiples "+" alrededor del gateway, uno por cada salida no conectada. Este comportamiento es valioso pero su diseño detallado (cuántas salidas, dónde se posicionan, cómo se etiquetan las ramas) se difiere:

- **PD-53:** En v1.0 de este SRS, el botón "+" sobre un `exclusive_gateway` se comporta igual que sobre cualquier otro nodo: crea un único nodo a la derecha con una transición. El usuario puede agregar transiciones adicionales manualmente con el handle drag (§7).
- **PD-54:** Se registra como pendiente **P-003** en `pendientes.md`: implementación del "+" multi-salida para gateways. Bloqueador: requiere extensión del catálogo de `node_type` para registrar metadatos de salidas nominadas, o convención de etiquetado de ramas. Documentación afectada: este SRS, UX Spec §7.4.2.

---

# 6. Canvas y transiciones

Este capítulo resuelve el punto 3 del feedback original (transiciones muy curvas, handles en un solo lado, conexión rígida).

## 6.1 Tipo de edge: smoothstep

- **PD-60:** Todas las transiciones se renderizan como edges de tipo **`smoothstep`** de React Flow, con `pathOptions.borderRadius = 8`. Esto produce edges ortogonales (segmentos horizontal/vertical) con esquinas redondeadas, similares a las de n8n, Make, Airflow.
- **PD-61:** Las edges curvas tipo Bézier libres (default de React Flow) **quedan prohibidas** en v1.0. El argumento es que las curvas Bézier funcionan en grafos pequeños pero generan cruces y confusión visual en procesos reales con 10+ nodos.
- **PD-62:** El color de la edge en estado normal es `border-default` (`#2A2E3F` en dark, `#D1D5DB` en light) con `stroke-width: 1.5`. La cabeza de flecha es del mismo color, tamaño estándar de React Flow.
- **PD-63:** Hover sobre una edge eleva su `stroke-width` a 2.5 y oscurece su color a `text-tertiary`. Click la selecciona (panel de propiedades de transición).
- **PD-64:** Selección de una edge: color `action-primary` (`#2563EB`), stroke 2.5, sin glow.
- **PD-65:** Edges en estado de error (transición que apunta a un nodo eliminado, condición sintácticamente inválida, etc.) se muestran en `state-error` con dash pattern `4 4`.

## 6.2 Edge labels

- **PD-66:** Las transiciones que tienen `label` no vacío muestran el label centrado sobre la edge, en una pequeña pill con fondo `bg-surface`, borde `border-subtle`, padding `2px 6px`, font 11px peso 500.
- **PD-67:** Las transiciones que parten de un `exclusive_gateway` y tienen una `condition` no vacía muestran su label con un mini-badge a la izquierda (verde si la transición es la "true" branch, gris para "false" o default). Como las branches no están nominadas en v1.0 (PD-53), esto se simplifica: cualquier condición no vacía muestra un icono `git-branch` de Lucide a la izquierda del label.

## 6.3 Handles en las 4 direcciones

Resuelve la queja específica del usuario sobre que el nodo `end` solo tiene un punto de conexión.

- **PD-70:** Cada custom node tiene handles en las 4 direcciones (`Position.Top`, `Position.Right`, `Position.Bottom`, `Position.Left`).
- **PD-71:** Los handles son **invisibles por defecto** y aparecen como un círculo pequeño (8px de diámetro, color `action-primary`) solo cuando el nodo está en hover o seleccionado. Esto preserva el aspecto limpio del canvas.
- **PD-72:** El tipo de cada handle (`source` vs `target`) depende del tipo de nodo:
  - **`start`**: 4 handles, todos `source`. No acepta entradas (VR-28).
  - **`end`**: 4 handles, todos `target`. No produce salidas (VR-28).
  - **`human_task`, `script_task`, `exclusive_gateway`**: 4 handles, **cada uno funciona como ambos `source` y `target`** simultáneamente. React Flow no soporta nativamente "handle bidireccional"; se implementa colocando dos handles superpuestos por dirección (`type: 'source'` con `id: 'top-source'`, `type: 'target'` con `id: 'top-target'`), con el mismo offset.
- **PD-73:** La conexión se resuelve así: cuando el usuario arrastra desde un handle de un nodo y suelta sobre otro nodo, React Flow elige automáticamente el handle más cercano del target. La transición resultante apunta a ese handle.
- **PD-74:** Las posiciones de los handles permiten que las edges entren y salgan de los nodos por cualquiera de los cuatro lados, eliminando la restricción de "solo lado izquierdo" o "solo lado derecho" que tiene la implementación actual.

## 6.4 Conexión arrastrando

- **PD-80:** Para conectar dos nodos manualmente, el usuario hace hover sobre el nodo origen (los handles aparecen), drag desde uno de los handles y suelta sobre el nodo destino.
- **PD-81:** Durante el drag, una línea temporal del color `action-primary` con stroke dashed sigue al cursor.
- **PD-82:** Si el cursor está sobre un nodo destino válido, el nodo destino se ilumina con borde `action-primary` y la línea temporal se vuelve sólida. Soltar crea la transición.
- **PD-83:** Si el cursor está sobre un nodo destino inválido (un `start` no acepta entrada — VR-28; un nodo que crearía un ciclo — diferido a validación), la línea temporal se vuelve roja con stroke `state-error`. Soltar cancela la operación y muestra un toast con el motivo.
- **PD-84:** Si el cursor se suelta sobre el canvas vacío (no sobre un nodo), la operación se cancela silenciosamente.
- **PD-85:** Las reglas de conexión se validan en el callback `onConnect` y se materializan en `isValidConnection` de React Flow. Resumen:
  - No se permite `start` como target.
  - No se permite `end` como source.
  - No se permite source == target (self-loop).
  - No se permite duplicar una transición ya existente entre los mismos dos nodos (mismo `from_node_id` y `to_node_id`).

## 6.5 Selección, mover, eliminar

- **PD-90:** Click sobre un nodo lo selecciona (UX Spec §7.3.2). Borde dashed `action-primary` 1.5px offset 4px. El panel de propiedades carga las props del nodo.
- **PD-91:** Click sobre una edge la selecciona. Estilo: §6.1 PD-64. El panel de propiedades carga las props de la transición.
- **PD-92:** Click sobre el canvas vacío deselecciona todo. El panel de propiedades vuelve a mostrar las props del proceso completo (nombre, descripción, variables de contexto, status).
- **PD-93:** Drag sobre un nodo lo mueve. Snap a grid de 20px. Las edges se reenrutan automáticamente (smoothstep recalcula su path).
- **PD-94:** Tecla `Delete` o `Backspace` con un nodo seleccionado elimina el nodo y todas sus transiciones entrantes/salientes. Confirmación previa: modal con texto "¿Eliminar este nodo? Se borrarán también sus N transiciones." con botones "Cancelar" y "Eliminar" (red primary).
- **PD-95:** Tecla `Delete` con una edge seleccionada elimina la transición sin confirmación (operación de bajo riesgo).
- **PD-96:** Multi-select: shift+click añade a la selección. Rubber band (drag sobre canvas vacío) selecciona todos los nodos dentro del rectángulo. `Delete` con multi-selección pide una sola confirmación que agrega los counts.

## 6.6 Pan y zoom

- **PD-100:** Pan: drag con click izquierdo sobre el canvas vacío. Pan: drag con la rueda del mouse presionada también funciona (estándar).
- **PD-101:** Zoom: scroll del mouse con cmd/ctrl, o pinch en trackpad. Rango 25%-200%. Sin cmd/ctrl, scroll hace pan vertical (consistente con sensación de "mapa").
- **PD-102:** El zoom centrado se aplica respecto a la posición del cursor (estándar de React Flow con `zoomOnScroll` configurado correctamente).
- **PD-103:** El `viewport` se persiste en `localStorage` (heredado FE-122).

## 6.7 Background y minimap

- **PD-110:** El background del canvas usa el componente `<Background variant="dots" />` de React Flow, con `gap={22}` y `color="#1F2230"` en dark mode (`color="#E5E7EB"` en light). Esto produce el patrón de puntos sutiles mencionado en UX Spec §7.2.
- **PD-111:** El minimap usa `<MiniMap />` posicionado abajo-izquierda, 150×90px. Cada nodo se renderiza con el color de su estado (verde/ámbar/rojo/gris). El viewport actual aparece como rectángulo `action-primary` dashed. Click en el minimap pan al punto correspondiente.

---

# 7. Custom nodes — diseño detallado

Cada tipo de nodo tiene un componente React custom. Todos comparten el `NodeShell` con la lógica común (borde de estado, handles, botón "+", hover).

## 7.1 `NodeShell` — wrapper común

- **PD-120:** `NodeShell` recibe como props `nodeType`, `status`, `selected`, `data` y `children`. Renderiza:
  - Un `<div>` exterior con el borde de estado (`state-success` / `state-warning` / `state-error` / `state-neutral`) según `status`. Borde 1.4px sólido, excepto `draft` que es dashed. Glow sutil (drop-shadow) excepto en `draft`.
  - Si está seleccionado, agrega un segundo borde dashed `action-primary` offset 4px.
  - Renderiza los 4 handles invisibles (visibles en hover) según las reglas del tipo (PD-72).
  - Renderiza el botón "+" del lado derecho en hover (excepto si `nodeType === 'end'`).
  - El `children` es el contenido específico del tipo.
- **PD-121:** El `NodeShell` aplica un transition CSS de 150ms en `border-color`, `box-shadow` y `transform` para animaciones suaves de selección y hover.

## 7.2 `StartNode`

- **PD-130:** Forma: círculo de 44px de diámetro (UX Spec §7.5.1).
- **PD-131:** Sin contenido textual interior. Fondo blanco/oscuro según tema, borde según estado, círculo interno verde claro `#34D399` 24px en el centro como indicador de tipo.
- **PD-132:** Etiqueta visible debajo del círculo: "Inicio" en 11px tracking ancho.
- **PD-133:** Sin etiqueta técnica visible en el card; vive solo en el panel de propiedades.

## 7.3 `EndNode`

- **PD-140:** Forma: círculo de 44px con doble borde (convención BPMN — UX Spec §7.5.2).
- **PD-141:** Sin contenido textual interior. Indicador interno: círculo rojo `#EF4444` 16px.
- **PD-142:** Etiqueta visible debajo: "Fin" o el `result_label` configurado (p. ej. "Aprobado", "Rechazado") si tiene uno.

## 7.4 `HumanTaskNode`

- **PD-150:** Forma: rectángulo redondeado, ancho 180px, alto 70px (UX Spec §7.5.3). Border-radius 10px.
- **PD-151:** Estructura interior:
  - Esquina superior izquierda: icono `user` (Lucide) 16px dentro de un bloque coloreado azul (`#60A5FA` 18% bg, icono saturado).
  - Junto al icono, label tiny uppercase "TAREA DE USUARIO" tracking ancho.
  - Línea siguiente: nombre del nodo (`name` o `label` si tiene), peso 600, 13px.
  - Línea siguiente: nombre del formulario asignado en monospace 10px `text-tertiary`, o el texto "Sin formulario asignado" en `state-warning` si está vacío.
- **PD-152:** Si no tiene formulario asignado, el estado del nodo es `error` (no `draft`) — un human_task sin form es un error de configuración, no un borrador (VR-?? — definir explícitamente abajo en §9).

## 7.5 `ScriptTaskNode`

- **PD-160:** Forma: rectángulo redondeado, mismas dimensiones que `human_task`.
- **PD-161:** Estructura idéntica a `HumanTaskNode` con dos diferencias:
  - Icono `code-2` (Lucide) sobre fondo púrpura `#A78BFA` 18%.
  - Label tiny "TAREA DE SISTEMA".
  - Mini-badge ⚠ "MVP" en la esquina superior derecha.
- **PD-162:** El estado del nodo es `warning` permanentemente en MVP (no se ejecuta), incluso si todos los campos están configurados. Tooltip: "Configurado correctamente, pero no se ejecuta en el motor MVP" (FE-104).

## 7.6 `ExclusiveGatewayNode`

- **PD-170:** Forma: rombo (diamond) de 80×80px. Implementación: `<div>` con `transform: rotate(45deg)` y contenido interior contra-rotado, o SVG inline. Se prefiere la opción SVG para mejor control.
- **PD-171:** Indicador interior: icono `x` o `git-fork` (Lucide) en ámbar `#FBBF24` 18% bg, icono saturado.
- **PD-172:** Etiqueta visible debajo del rombo: "Decisión" o `label` configurado.
- **PD-173:** Mini-badge ⚠ "MVP" abajo a la derecha (no se ejecuta en MVP — FE-104).
- **PD-174:** Los handles en `Position.Right` y `Position.Bottom` están más "salientes" visualmente cuando el gateway tiene transiciones de salida, para sugerir las ramas. (Esto es cosmético; los handles funcionales están en las 4 direcciones según PD-72).

---

# 8. Panel de propiedades

El panel derecho muestra propiedades editables del item seleccionado. Se hereda en gran parte del UX Spec §7.6.

## 8.1 Cuando hay un nodo seleccionado

- **PD-180:** Header del panel: label uppercase "PROPIEDADES" + botón "✕" para cerrar/colapsar. Debajo, el bloque identificador del nodo (icono coloreado + nombre + identificador técnico en monospace).
- **PD-181:** Campos comunes a todos los nodos:
  - **Nombre técnico** (input monospace, validado contra VR-40 con feedback inmediato en blur).
  - **Etiqueta visible** (input texto libre).
- **PD-182:** Campos específicos por tipo:
  - **`start`**: ninguno adicional.
  - **`end`**: `result_label` (input texto, p. ej. "Aprobado", "Rechazado").
  - **`human_task`**: `form_ref` (select de `form_definition`s del proyecto, requerido). Hint debajo: "Selecciona el formulario que se mostrará al usuario."
  - **`script_task`**: `language` (select, único valor `javascript`). `source` (textarea con Monaco Editor opcional; en v1.0 textarea simple multi-línea). Banner amarillo arriba: "Este nodo no se ejecuta en el motor MVP."
  - **`exclusive_gateway`**: `default_transition_id` (select de las transiciones salientes del gateway). Si todavía no hay salidas, mensaje "Agrega al menos una salida desde este nodo para configurar la decisión por defecto."

## 8.2 Cuando hay una transición seleccionada

- **PD-190:** Header del panel: "PROPIEDADES" + "TRANSICIÓN".
- **PD-191:** Campos:
  - **Label** (input texto).
  - **Condición** (textarea de 3 líneas para expresión booleana sobre el contexto). En v1.0 sin syntax highlighting; se difiere a v1.1 del diseñador. Hint: "Expresión booleana sobre el contexto del proceso. Ejemplo: `context.approved == true`."
- **PD-192:** Banner amarillo si la condición es no-vacía: "Las condiciones no se evalúan en el motor MVP." (FE-104).
- **PD-193:** Información read-only abajo: "Origen: {nodo_origen.name}" y "Destino: {nodo_destino.name}" con click → seleccionar ese nodo.

## 8.3 Cuando no hay selección (proceso completo)

- **PD-200:** El panel muestra:
  - Nombre del proceso (editable inline).
  - Descripción (textarea).
  - Versión (read-only).
  - Status (chip "draft" o "configured" + botón para alternar — solo permite ir a "configured" si pasa validación).
  - Lista de variables de contexto con botón "+ Agregar variable" (vive en `metadata.content.context_variables`, ver Definición de Metadata §6.5).
- **PD-201:** Para cada variable de contexto, la UI muestra una mini-card con: `name` (monospace), `data_type` (badge), `label`, `initial_value` (si hay). Click → modal de edición. Botón papelera → eliminar (con confirmación si la variable es referenciada en alguna transición).

---

# 9. Validación visual en tiempo real

Este capítulo materializa el UX Spec §7.7. Sin esto, los nodos del canvas no comunican el estado del usuario y el feedback se vuelve ciego.

## 9.1 Estados de un nodo

Cada nodo tiene un `status` calculado: `configured` | `warning` | `error` | `draft`.

- **PD-210:** El cálculo del status corre **en cliente, en tiempo real** cada vez que cambia el nodo, su `config`, o las transiciones conectadas. La función `computeNodeStatus(node, transitions, processContext)` vive en `validation/nodeStatus.ts`.
- **PD-211:** Reglas de status por tipo:

| Tipo | `error` cuando | `warning` cuando | `configured` cuando | `draft` cuando |
| --- | --- | --- | --- | --- |
| `start` | Hay más de un `start` en el proceso (UI permite pero marca todos en error — VR-25). | — | El proceso tiene exactamente un `start` y este tiene al menos una transición saliente. | Recién creado, sin transiciones salientes. |
| `end` | El nodo no tiene transiciones entrantes (en `configured` no se permite — VR-29). | — | Tiene al menos una transición entrante. | Recién creado, sin entrantes. |
| `human_task` | `form_ref` vacío. | — | `form_ref` apunta a un form existente, hay entrante y saliente. | Recién creado, sin form. |
| `script_task` | Sintaxis del `source` inválida (post-MVP). | **Siempre** (no se ejecuta en MVP). | Nunca en v1.0. | Recién creado. |
| `exclusive_gateway` | `default_transition_id` apunta a una transición inexistente, o no tiene `default` y tiene 2+ salidas. | **Siempre** (no se ejecuta en MVP). | Nunca en v1.0. | Recién creado. |

- **PD-212:** El proceso en su totalidad tiene un status global derivado:
  - Si cualquier nodo está en `error`, el proceso está en `error` y **no puede pasarse a `configured`**.
  - Si cualquier nodo está en `warning` y ninguno en `error`, el proceso está en `warning` (puede pasarse a `configured` pero se muestra el banner FE-104).
  - Si todos los nodos están `configured`, el proceso está `configured`.
- **PD-213:** Las reglas VR-25 a VR-30 de Definición de Metadata §8.3 se evalúan en cliente como parte de `computeProcessStatus`. Cuando el usuario intenta pasar el proceso a `configured`, las reglas que fallen se muestran en un panel inferior temporal con cada error clickeable que pan-and-zoom al nodo afectado.

## 9.2 Indicadores visuales

- **PD-220:** Borde del nodo según status: `state-success` 1.4px sólido (configured), `state-warning` 1.4px sólido (warning), `state-error` 1.4px sólido (error), `state-neutral` 1.4px **dashed** (draft).
- **PD-221:** Glow: drop-shadow del color de estado, blur 4px, opacidad 0.5. Solo en configured/warning/error, no en draft.
- **PD-222:** Status dot diminuto (6px) en la esquina superior derecha del card, color del estado.
- **PD-223:** Tooltip sobre el card al hover: lista las razones del status actual (p. ej. "Falta asignar un formulario").

## 9.3 Banner persistente del proceso

- **PD-230:** En la parte superior del canvas (debajo de la leyenda de estados), aparece un banner cuando:
  - Hay nodos en error → banner rojo: "El proceso tiene N nodos con errores."
  - Hay nodos en warning pero sin errores → banner amarillo: "El proceso contiene nodos no ejecutables en el motor MVP (script_task, exclusive_gateway)."
- **PD-231:** El banner es dismissable solo para `warning`; el banner de `error` es persistente hasta que se resuelvan los errores.

---

# 10. Persistencia

Este capítulo extiende FE-100 a FE-105 del Frontend SRS §8.2.2 con detalle suficiente para implementar la traducción estado-local → batch.

## 10.1 Modelo de cambios

Mientras el usuario edita en el canvas, el feature mantiene un **diff respecto al estado original cargado del backend**:

- **PD-240:** Al cargar un proceso, el feature guarda dos copias: `originalState` (immutable, lo que vino del backend) y `currentState` (mutable, lo que el usuario edita). Ambas son `{ nodes: Node[], edges: Edge[], processMetadata: ProcessMetadata }`.
- **PD-241:** Una utilidad `computeDiff(original, current)` produce las listas:
  - `nodesAdded`: nodos en current que no estaban en original (su `id` empieza con `tmp_`).
  - `nodesModified`: nodos cuyo `name`, `position_x`, `position_y` o `config` cambió.
  - `nodesRemoved`: nodos en original que no están en current.
  - `processMetadataChanged`: si `description`, `status`, `context_variables`, `transitions` o `metadata_canvas` cambiaron.
- **PD-242:** Las transiciones (`edges`) viven **inline en `metadata.content.transitions`** (Definición de Metadata §6.5), no en una tabla aparte. Por tanto los cambios de transiciones generan un único `update` sobre el `process_definition`, no operaciones individuales por transición.

## 10.2 Construcción del batch

- **PD-250:** Al pulsar "Guardar", `designerToBatch.ts` ejecuta:

```typescript
function buildBatch(diff: Diff, processId: string): Operation[] {
  const ops: Operation[] = [];

  // 1. Crear nodos nuevos. Sus tmp_ids se referencian luego.
  for (const node of diff.nodesAdded) {
    ops.push({
      temp_id: node.id, // 'tmp_xxxxx'
      operation: 'create',
      object_type: 'node',
      data: {
        process_id: processId,
        node_type: node.data.nodeType,
        name: node.data.name,
        position_x: node.position.x,
        position_y: node.position.y,
        config: node.data.config,
      },
    });
  }

  // 2. Modificar nodos cambiados.
  for (const node of diff.nodesModified) {
    ops.push({
      operation: 'update',
      object_type: 'node',
      id: node.id,
      data: {
        name: node.data.name,
        position_x: node.position.x,
        position_y: node.position.y,
        config: node.data.config,
      },
    });
  }

  // 3. Eliminar nodos.
  for (const node of diff.nodesRemoved) {
    ops.push({
      operation: 'delete',
      object_type: 'node',
      id: node.id,
    });
  }

  // 4. Update del process_definition con transitions (referenciando tmp_ids).
  if (diff.processMetadataChanged) {
    ops.push({
      operation: 'update',
      object_type: 'process_definition',
      id: processId,
      data: {
        content: {
          description: diff.current.description,
          version: diff.current.version,
          status: diff.current.status,
          context_variables: diff.current.context_variables,
          transitions: diff.current.transitions.map(t => ({
            id: t.id,
            from_node_id: t.from_node_id, // puede ser un tmp_id resuelto en batch
            to_node_id: t.to_node_id,
            condition: t.condition,
            label: t.label,
          })),
          metadata_canvas: diff.current.metadata_canvas,
        },
        expected_updated_at: diff.original.updated_at,
      },
    });
  }

  return ops;
}
```

- **PD-251:** Las transiciones que referencian nodos nuevos usan el `tmp_id` del nodo. El backend resuelve los `temp_id`s a UUIDs reales antes de persistir (BR-13 del Backend SRS).
- **PD-252:** El batch se envía con `usePersistProcess()` (hook custom que envuelve `usePersist()` del Frontend SRS §4.2.3).
- **PD-253:** Si el batch falla con 422, los errores se mapean por `operation_index` a los nodos/transiciones correspondientes y se muestran inline en el canvas. Los UUIDs ya generados no se persisten en `currentState` (esa es la responsabilidad del backend en la siguiente respuesta exitosa).
- **PD-254:** Si el batch responde 200, `currentState` se actualiza con los UUIDs reales devueltos (los `tmp_id` se reemplazan), `originalState` se reemplaza por `currentState`, y el chip "Sin guardar" desaparece.

## 10.3 Optimistic locking

- **PD-260:** El `expected_updated_at` en la operación de update del `process_definition` (PD-250 paso 4) protege contra escrituras concurrentes. Si el backend devuelve 409 `concurrent_modification`, el frontend muestra un modal: "Otra persona modificó este proceso. ¿Quieres ver los cambios y reintentar?" con botones "Descartar mis cambios" (recarga) y "Forzar guardado" (deshabilitado en MVP).

---

# 11. Atajos de teclado

Heredados parcialmente del UX Spec §14.2 y del Frontend SRS:

| Atajo | Acción |
| --- | --- |
| `Cmd/Ctrl + S` | Guardar (equivale al botón Guardar). |
| `Delete` / `Backspace` | Eliminar nodo o edge seleccionado (con confirmación si es nodo). |
| `Esc` | Cierra popovers, deselecciona nodos, cierra modales. |
| `Cmd/Ctrl + 0` | Reset zoom y centrar. |
| `Cmd/Ctrl + Z` | Undo (diferido a post-MVP — UX Spec §15). |
| `Cmd/Ctrl + Shift + Z` | Redo (diferido). |
| `Tab` | Foco entre nodos (orden por posición visual top-to-bottom, left-to-right). |
| `Enter` con nodo seleccionado | Abre panel de propiedades en modo edición. |

- **PD-270:** Los atajos están registrados a nivel del componente `ProcessDesigner` con `useEffect` + `addEventListener('keydown')`. Se respetan los inputs activos (no se disparan si el foco está en un `<input>` o `<textarea>`).

---

# 12. Performance

- **PD-280:** El diseñador debe renderizar a 60fps en pan/zoom con procesos de hasta **100 nodos** (FE-244 del Frontend SRS habla de 50; se eleva por la importancia del diseñador). 
- **PD-281:** El componente `NodeShell` y los custom nodes deben ser memoizados con `React.memo` para evitar re-renders innecesarios. La función de comparación usa `id`, `position`, `data.config` y `selected`.
- **PD-282:** Las edges custom usan `React.memo` similar.
- **PD-283:** El hover y el botón "+" se manejan con CSS puro (`:hover`) hasta donde sea posible, no con estado React, para minimizar re-renders.
- **PD-284:** El cálculo de status de nodos (`useProcessValidation`) usa `useMemo` con dependencias en `nodes` y `edges`. No recalcula en cada render.

---

# 13. Accesibilidad

- **PD-290:** Cada nodo del canvas es focuseable con Tab (atributo `tabIndex={0}`) y tiene `aria-label` descriptivo: `"Nodo de tipo {tipo}, nombre {name}, estado {status}"`.
- **PD-291:** El botón "+" contextual tiene `aria-label="Agregar nodo conectado al actual"`.
- **PD-292:** El popover del "+" es navegable con flechas (arriba/abajo entre opciones, Enter para seleccionar).
- **PD-293:** Las edges del canvas no son focuseables directamente con Tab (sería ruidoso); en su lugar, hay un panel alternativo "Lista de transiciones" accesible desde la toolbar (icono `list`) que muestra todas las transiciones como una lista navegable con teclado. (Diferido a v1.1 si el costo es alto en MVP.)
- **PD-294:** Cumple WCAG 2.1 AA en contrastes mínimos (heredado del Frontend SRS §18).

---

# 14. Out of scope (v1.0 del diseñador)

Decisiones explícitamente diferidas para mantener el alcance del MVP:

- **Undo/redo del canvas.** Mismo argumento del UX Spec §15. Si el usuario se equivoca, deshace manualmente.
- **"+" multi-salida en exclusive_gateway** con etiquetado de ramas. Diferido (P-003).
- **Auto-layout** con dagre/elkjs. El botón "Auto-layout" del UX Spec §7.3.1 se renderiza pero deshabilitado, con tooltip "Próximamente". Sin esto el usuario organiza manualmente.
- **Validación cliente del proceso completo** (VR-25..VR-30) **en sentido motor** (paths alcanzables, ciclos, etc.). El cliente solo valida lo declarado en §9.1. El backend hace la validación completa al recibir el batch.
- **Versionado y diff visual** de procesos.
- **Exportación a imagen/PDF** del canvas.
- **Editor visual de expresiones** para `condition` de transiciones. En MVP es textarea libre.
- **Snap-to-element** (alineación inteligente con nodos vecinos al arrastrar). Solo snap-to-grid de 20px.
- **Plantillas de fragmentos** (drag de "patrones" pre-armados, p. ej. "Aprobación binaria"). Diferido.
- **Migración a React Flow 12** (`@xyflow/react`). Diferido. Se registra como nuevo pendiente.

---

# 15. Modificaciones a documentos existentes

La emisión de este SRS implica los siguientes ajustes en documentos existentes. **No se requiere reescribir** los documentos; los cambios son inserciones quirúrgicas:

## 15.1 SRS Frontend v1.0 → v1.1

- **§8.2.2 (`ProcessDetail`)** — Agregar al final del bloque: "El detalle del comportamiento visual del canvas, de la paleta, del botón '+' contextual y de los custom nodes vive en el SRS del Diseñador de Procesos v1.0 (PD-NN). Este SRS sigue siendo normativo para el contrato de datos (rutas, hooks, persistencia), pero su §8.2.2 a §8.2.3 quedan **subsumidos** por el SRS del Diseñador para el aspecto visual e interactivo."
- **§8.2.3 (Custom nodes)** — Reemplazar el bloque corto por una referencia: "Ver SRS del Diseñador de Procesos v1.0 §7 para el diseño detallado de cada custom node."
- **§20 (Out of scope)** — Sin cambios.
- **§21 (Historial)** — Agregar entrada v1.1 que explique la extracción del diseñador a documento dedicado.

## 15.2 UX Spec v1.0 → sin cambios

El UX Spec v1.0 §7.4 ya definía correctamente el comportamiento del botón "+" contextual. Este SRS lo implementa fielmente. No hay contradicciones ni adiciones que requieran modificar el UX Spec.

## 15.3 Pendientes v1.1 → v1.2

Agregar tres entradas nuevas:

- **P-003** — "+" multi-salida para `exclusive_gateway` con etiquetado de ramas. Bloqueador: extensión del catálogo de `node_type` o convención de etiquetado. Documentación afectada: este SRS §5.4, UX Spec §7.4.2.
- **P-004** — Migración a React Flow 12 (`@xyflow/react`). Razón del diferimiento: la serie 12 introduce cambios de API y aún no hay urgencia. Beneficio esperado: mejor performance, API más limpia. Documentación afectada: este SRS §2.1, §2.2.
- **P-005** — Auto-layout con dagre/elkjs. Bloqueador: ninguno técnico. Diferido por scope. Documentación afectada: este SRS §14, UX Spec §7.3.1.

## 15.4 Definición de Metadata, Modelo de Datos Físico, SRS Backend, Vision — sin cambios

Este SRS no toca el metamodelo, ni el esquema de BD, ni el contrato del backend, ni la visión del producto. Toda la mejora del diseñador es **frontend puro**.

---

# 16. Criterios de aceptación

Para considerar este SRS implementado:

1. **Crear un proceso desde cero** — el usuario abre `/processes/new`, ve el canvas vacío con el botón "+" grande centrado, hace click, elige "Inicio", y el nodo Inicio aparece. Hace hover sobre el Inicio, ve el botón "+" a la derecha, hace click, elige "Tarea de usuario", y se crea el nodo nuevo a la derecha con una transición que los conecta. Repite hasta llegar al "Fin". Tiempo objetivo: **< 60 segundos** para un proceso lineal de 5 nodos.
2. **Arrastrar desde la paleta** — el usuario arrastra una card de "Tarea de usuario" desde la paleta al canvas, ve el feedback de drag (cursor `grabbing`, item ghost), suelta sobre un área vacía del canvas y el nodo aparece exactamente en la posición soltada (con snap a grid).
3. **Reconectar transiciones** — el usuario hace hover sobre un nodo, ve los handles aparecer en las 4 direcciones, arrastra desde el handle superior hasta otro nodo, y la transición se traza correctamente entrando por el lado que corresponda del nodo destino. La edge usa smoothstep (esquinas ortogonales redondeadas).
4. **Validación visual en tiempo real** — el usuario crea un `human_task` sin asignar form, y el card se muestra inmediatamente con borde rojo y status dot rojo. Asigna un form en el panel derecho y el card cambia a verde sin necesidad de guardar.
5. **Guardar y recargar** — el usuario diseña un proceso, pulsa Guardar, el batch se envía a `POST /api/persist`, todos los `tmp_id` se resuelven en el backend, y al recargar la página el proceso se muestra idéntico a como se diseñó (incluyendo posiciones y viewport).
6. **Paleta visualmente distintiva** — las 5 cards de la paleta tienen cada una su mini-icono coloreado del tipo correspondiente, no son cuadros grises planos.
7. **Eliminar un nodo** — el usuario selecciona un nodo intermedio, pulsa Delete, ve la confirmación con el conteo correcto de transiciones a borrar, confirma, y tanto el nodo como sus 2 transiciones (entrante y saliente) desaparecen del canvas.
8. **Performance** — con un proceso de 100 nodos cargado, el pan y zoom mantienen 60fps en Chrome estable.

---

# 17. Asunciones y temas abiertos

- **PD-A-01.** Se asume que React Flow 11.11+ continúa siendo mantenida durante el ciclo de vida de v1.0 del MVP. Si la librería se vuelve inestable o se discontinúa, se evalúa migración a la serie 12 (P-004).
- **PD-A-02.** Se asume que el backend acepta sin cambios el batch construido en §10.2. Esto se valida con un test de integración cuando el SRS se implementa.
- **PD-A-03.** Se asume que el catálogo de 5 tipos de nodo del MVP es suficiente para que el primer cliente diseñe sus procesos reales. Si surgen casos donde se requiere paralelismo, eventos intermedios o sub-procesos, son nuevos pendientes a registrar.
- **PD-A-04.** Se asume que el patrón "+" contextual del UX Spec §7.4 es el adecuado culturalmente para el usuario del MVP. Si pruebas con el primer cliente muestran resistencia a este patrón, se reevalúa restituir más prominencia a la paleta lateral.
- **PD-A-05.** Las imágenes de referencia provistas por el creador (n8n-style) son ilustrativas; el diseño visual final puede divergir en detalles cromáticos y de espaciado siempre que respete los principios del UX Spec y los tokens de §3.1 del mismo.

---

# 18. Historial de versiones

| Versión | Fecha | Descripción |
| --- | --- | --- |
| 1.0 | Mayo 2026 | SRS inicial dedicado al Diseñador de Procesos. Profundiza §8 del SRS Frontend v1.0 sin reemplazarlo. Confirma React Flow 11.x como librería base tras evaluación de alternativas. Formaliza los 5 puntos de mejora identificados: paleta lateral con cards visualmente distintivas y drag-and-drop nativo (PD-20 a PD-37), botón "+" contextual al hover sobre nodos con popover de tipos y creación auto-conectada (PD-40 a PD-54), handles invisibles en las 4 direcciones de cada nodo con soporte bidireccional para nodos intermedios (PD-70 a PD-85), edges ortogonales smoothstep con esquinas redondeadas en lugar de Bézier libres (PD-60 a PD-67), y custom nodes con identidad visual completa por tipo (PD-120 a PD-174). Especifica el panel de propiedades adaptativo por tipo de selección (PD-180 a PD-201), la validación visual en tiempo real con cuatro estados por nodo (PD-210 a PD-231), la persistencia diferencial mediante el endpoint batch `POST /api/persist` con resolución de `temp_id`s (PD-240 a PD-260), atajos de teclado, performance objetivo de 60fps con 100 nodos, accesibilidad y criterios de aceptación verificables. Difiere a pendientes nuevos P-003 (+ multi-salida en gateways), P-004 (migración a React Flow 12) y P-005 (auto-layout). Documenta una modificación quirúrgica al SRS Frontend §8.2.2 y §8.2.3 para referenciar este SRS sin reescribir el documento. |

*— Fin del documento —*

Confidencial · Mayo 2026 · Workflow Platform · Process Designer SRS v1.0
