**ESPECIFICACIÓN DE EXPERIENCIA DE USUARIO (UX SPEC)**

Workflow Platform

*Diseño de interacción y patrones visuales del MVP de UI*

Mayo 2026  ·  v1.0  ·  Confidencial — Documento interno

---

# 1. Introducción

## 1.1 Propósito y audiencia

Este documento especifica la experiencia de usuario y los patrones de interacción del MVP de UI de Workflow Platform. Cubre la navegación, los layouts de cada módulo, el lenguaje visual, los flujos críticos y los estados transversales que la interfaz debe presentar.

Está dirigido a:

- **Equipo de Frontend**, que lo usa como contrato para implementar la UI.
- **Equipo de Backend**, que lo usa para entender qué datos y operaciones debe exponer la API.
- **Creador del producto**, que lo usa como referencia de las decisiones tomadas y como herramienta para evaluar nuevas features contra los principios establecidos.

| **Lo que ESTE documento NO cubre** No define el diseño visual pixel-perfect (tipografías exactas en pt, espaciados al pixel, animaciones detalladas) — eso va al Design System del proyecto. No define validaciones de negocio, reglas de cálculo, ni estructura de datos — eso va al SRS de Backend. No define el metamodelo de artefactos (Entity, Attribute, ProcessDefinition…) — eso va al documento de Definición de Metadata. Cuando este documento se refiere a un artefacto, lo hace conceptualmente; la definición canónica vive en otro documento. |
| --- |

## 1.2 Documentos de referencia

| **Documento** | **Versión** | **Propiedad sobre** |
| --- | --- | --- |
| Workflow Platform — Documento de Visión | 1.0 | Visión de negocio, alcance estratégico del MVP, modelo de adopción, multi-tenancy, criterios de éxito. |
| UX Spec — Workflow Platform (este documento) | 1.0 | Patrones de interacción, navegación, layouts de pantallas, lenguaje visual, estados de UI, nomenclatura. |

## 1.3 Convenciones del documento

- **"Usuario"** se refiere al miembro del equipo técnico (creador o dev) que opera la plataforma en el MVP de UI. La UI de usuario final ejecutor de tareas está fuera del alcance.
- **"Módulo"** designa cada una de las áreas funcionales del producto: Workflows, Entities, Forms, Templates, Configuración.
- **"Editor"** designa la pantalla donde se construye o edita un artefacto (proceso, entidad, formulario).
- **"Listado"** designa la pantalla donde se ven todos los artefactos de un tipo en el proyecto activo.
- Cuando el documento usa **negrita** sobre una palabra, está nombrando un elemento de UI específico que debe existir en la implementación con ese nombre o equivalente exacto.
- Las medidas (px, em) son indicativas, no normativas; pueden ajustarse en implementación si la coherencia visual se preserva.

---

# 2. Principios de Diseño UX

Cinco principios rigen todas las decisiones de UX. Ante cualquier dilema de diseño no resuelto explícitamente en este documento, debe consultarse esta sección.

## 2.1 Principio 1 — Modo lista vs. Modo concentración

Cada pantalla del producto opera en uno de dos modos visuales:

- **Modo lista** — el usuario navega entre items: ve la sidebar de módulos, el contexto de proyecto, los filtros, todos los elementos disponibles. Las acciones son "buscar", "elegir", "crear nuevo". Aplica a: Home del proyecto, listados de Workflows/Entities/Forms/Templates.

- **Modo concentración** — el usuario edita un item específico: la sidebar de módulos se oculta, el chrome se reduce al mínimo, el contenido a editar ocupa el máximo espacio. Aplica a: editores de Workflow, Entity, Form, y cualquier vista de detalle de un artefacto.

El cambio entre modos es automático según la pantalla activa. La sidebar de módulos sigue siendo accesible en modo concentración vía un icono "hamburguesa" en la esquina superior izquierda del header.

## 2.2 Principio 2 — Color comunica estado, no tipo

El esquema cromático del producto reserva los colores con carga semántica (verde, ámbar, rojo, gris) **exclusivamente para comunicar estado** de un elemento:

- **Verde** — configurado, válido, exitoso.
- **Ámbar** — advertencia, atención requerida, configuración incompleta no crítica.
- **Rojo** — error, configuración inválida, operación fallida.
- **Gris** — neutral, sin configurar, deshabilitado.

La **diferenciación entre tipos de elementos** (tarea de usuario vs. decisión, atributo string vs. integer, etc.) se hace mediante **iconos, etiquetas textuales y badges**, nunca solo por color. Esto preserva el código cromático para su única función (estado) y mantiene la interfaz accesible para usuarios con daltonismo.

El azul se usa para acciones primarias del usuario (botones, selección activa, enlaces) sin contradicción semántica.

## 2.3 Principio 3 — Diferenciación por icono + etiqueta

Cada tipo de elemento del sistema tiene una identidad visual compuesta por:

- **Un icono específico** (line-icon estilo consistente, p. ej. Tabler/Lucide).
- **Una etiqueta textual de tipo** en mayúsculas pequeñas con tracking (p. ej. "TAREA DE USUARIO", "DECISIÓN").
- **Opcionalmente, un color de fondo del icono** tinte semitransparente de un color de marca (no de estado), p. ej. azul para tareas de usuario, púrpura para tareas de sistema, ámbar para decisiones. **Estos colores no comunican estado**; comunican tipo. La distinción es clave para entender el principio 2.

## 2.4 Principio 4 — Densidad de información balanceada

El producto está pensado para usuarios técnicos que toleran y prefieren densidad por encima de wizards excesivamente guiados. La densidad debe ser **alta pero respirada**:

- Spacing generoso entre bloques (16-24px), apretado dentro de bloques (8-12px).
- Tipografía pequeña (11-13px para contenido secundario, 13-14px para primario, 17-20px para títulos) pero con buen tracking y line-height.
- Múltiples paneles simultáneos cuando aporten — siempre colapsables si el usuario quiere más espacio.
- Información técnica (IDs, paths, monospace) visible pero discreta, en colores secundarios o terciarios.

## 2.5 Principio 5 — Consistencia transversal entre módulos

Los mismos patrones se aplican en todos los módulos:

- Header con breadcrumb + acciones primarias + toggle de tema + avatar.
- Sidebar de módulos siempre en el mismo lugar y formato.
- Panel de propiedades a la derecha cuando hay un item seleccionado.
- Mismo lenguaje cromático de estados en todas partes.
- Misma tipografía y iconografía.
- Mismas convenciones de drag & drop, click, doble click, menú contextual.

Aprender un módulo debe enseñar implícitamente cómo usar los demás.

---

# 3. Lenguaje Visual

## 3.1 Paleta cromática

El producto soporta **light mode y dark mode** desde el día uno, con switch persistente accesible desde el header. El dark mode es ciudadano de primera clase, no una variante atornillada al light.

### 3.1.1 Dark mode — paleta principal

| Token | Valor | Uso |
| --- | --- | --- |
| `bg-canvas` | `#0F1117` | Fondo del canvas / área principal |
| `bg-surface` | `#161823` | Fondo de paneles, cards, toolbars |
| `bg-surface-elevated` | `#1A1D2A` | Cards sobre paneles (un nivel arriba), filas seleccionadas |
| `bg-input` | `#0F1117` | Fondo de inputs y selects |
| `border-subtle` | `#1F2230` | Bordes de paneles y separadores |
| `border-default` | `#2A2E3F` | Bordes de botones, inputs |
| `text-primary` | `#F3F4F6` | Texto principal |
| `text-secondary` | `#D1D5DB` | Texto secundario |
| `text-tertiary` | `#9CA3AF` | Labels, hints, metadata |
| `text-muted` | `#6B7280` | Texto muted, placeholders |
| `text-disabled` | `#4B5563` | Texto deshabilitado |

### 3.1.2 Light mode — paleta principal

| Token | Valor | Uso |
| --- | --- | --- |
| `bg-canvas` | `#FAFBFC` | Fondo del canvas / área principal |
| `bg-surface` | `#FFFFFF` | Fondo de paneles, cards |
| `bg-surface-elevated` | `#F4F5F8` | Cards sobre paneles, filas seleccionadas |
| `bg-input` | `#FFFFFF` | Fondo de inputs |
| `border-subtle` | `#E5E7EB` | Bordes sutiles |
| `border-default` | `#D1D5DB` | Bordes de botones |
| `text-primary` | `#111827` | Texto principal |
| `text-secondary` | `#374151` | Texto secundario |
| `text-tertiary` | `#6B7280` | Labels, hints |
| `text-muted` | `#9CA3AF` | Muted, placeholders |
| `text-disabled` | `#D1D5DB` | Deshabilitado |

### 3.1.3 Colores semánticos (idénticos en ambos modos)

| Token | Valor base | Variantes |
| --- | --- | --- |
| `state-success` | `#10B981` | `#34D399` (text), `rgba(16,185,129,0.15)` (bg subtle), `rgba(16,185,129,0.25)` (border subtle) |
| `state-warning` | `#F59E0B` | `#FBBF24` (text icon), `#F2B055` (text emphatic), `rgba(245,158,11,0.15)` (bg), `rgba(245,158,11,0.25)` (border) |
| `state-error` | `#EF4444` | `#F87171` (text), `rgba(239,68,68,0.15)` (bg), `rgba(239,68,68,0.25)` (border) |
| `state-neutral` | `#6B7280` | `#9CA3AF` (text), `rgba(107,114,128,0.18)` (bg), `rgba(107,114,128,0.3)` (border) |

### 3.1.4 Colores de acción

| Token | Valor | Uso |
| --- | --- | --- |
| `action-primary` | `#2563EB` | Botones primarios, selección activa, links |
| `action-primary-hover` | `#1D4ED8` | Hover de primarios |
| `action-text` | `#93C5FD` | Texto sobre fondos azul-tenue, selección |
| `action-bg-subtle` | `rgba(37,99,235,0.15)` | Fondo de items seleccionados, highlight de FK en árboles |

### 3.1.5 Colores de tipo de nodo / atributo (semantic-free)

| Token | Valor | Uso |
| --- | --- | --- |
| `type-user-task` | `#60A5FA` (azul) | Tarea de usuario, atributos string referenciados como entidad-de-usuario |
| `type-system-task` | `#A78BFA` (púrpura) | Tarea de sistema, scripts |
| `type-decision` | `#FBBF24` (ámbar) | Decisión, gateways |
| `type-pk` | `#C4B5FD` (violeta claro) | Llave primaria |
| `type-fk` | `#F2B055` (ámbar) | Llave foránea |
| `type-required` | `#93C5FD` (azul claro) | Restricción "requerido" |
| `type-data-uuid` | `#93C5FD` | Tipo de dato uuid |
| `type-data-string` | `#FBBF24` | Tipo de dato string |
| `type-data-number` | `#A78BFA` | Tipo de dato integer/decimal |
| `type-data-date` | `#34D399` | Tipo de dato date/datetime |
| `type-data-boolean` | `#FB923C` | Tipo de dato boolean |
| `type-data-json` | `#F472B6` | Tipo de dato json |

Estos colores se reservan para fondos semi-transparentes de iconos y para chips de tipo. Nunca se usan como borde de estado de un card.

## 3.2 Tipografía y jerarquía

| Estilo | Tamaño | Peso | Family | Uso |
| --- | --- | --- | --- | --- |
| Display | 20px | 600 | Sans | Títulos de página (listados) |
| H1 | 17-19px | 600 | Sans | Títulos de editor (nombre del artefacto editado) |
| H2 | 14-15px | 600 | Sans | Títulos de card grande / sección |
| Body | 13px | 400-500 | Sans | Texto principal de UI |
| Body small | 12px | 400 | Sans | Inputs, secundarios |
| Caption | 11px | 400-500 | Sans | Metadata, hints |
| Label | 10px | 600 | Sans uppercase letter-spacing 0.08em | Labels de campos, headers de sección |
| Mono | 11-13px | 400-500 | `ui-monospace, monospace` | IDs técnicos, paths, código, valores literales |
| Tiny | 9-10px | 600 | Sans uppercase letter-spacing 0.04em | Badges, etiquetas de tipo en nodos |

**Family recomendada:** Inter (variable) o stack del sistema (`-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif`). Para monospace: stack del sistema (`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`).

## 3.3 Iconografía

- **Estilo:** line icons, peso 2, esquinas redondeadas (linecap/linejoin: round).
- **Librería recomendada:** Tabler Icons o Lucide. Ambas open source, MIT, conjunto similar.
- **Tamaños canónicos:** 12px (en chips/badges), 14px (en menús), 16px (en sidebar/inputs), 18-20px (en bloques de icono de cards).
- **Color:** heredan `currentColor`. En cards, viven dentro de un cuadrado redondeado (28-36px) con fondo `rgba(<type-color>, 0.18)` y el icono en `<type-color>` saturado.

## 3.4 Espaciado y rejilla

Sistema de espaciado en múltiplos de 4px: `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48`.

- **Padding interno de cards:** 14-16px.
- **Gap entre cards:** 10-14px.
- **Padding de paneles:** 16-18px.
- **Padding del área principal de un editor:** 20-28px.
- **Border-radius:** 4px (inputs, chips), 6-8px (botones, badges), 10-12px (cards, paneles, surface-elevated).

## 3.5 Estados de elementos

Cada elemento "configurable" (un nodo en el canvas, un proceso en una card, un atributo en una tabla) puede estar en uno de cuatro estados:

| Estado | Borde | Glow | Status dot | Badge | Significado |
| --- | --- | --- | --- | --- | --- |
| **Configurado** | `state-success` 1.4px | Sí, sutil | `state-success` | "configurado" verde | Todo correcto |
| **Advertencia** | `state-warning` 1.4px | Sí, sutil | `state-warning` | "advertencia" ámbar | Funcional pero con observaciones |
| **Error** | `state-error` 1.4px | Sí, sutil | `state-error` | "con errores" rojo | Configuración inválida, bloqueante |
| **Sin configurar** | `state-neutral` 1.4px **dashed** | No | `state-neutral` | "borrador" gris | Vacío o sin datos suficientes |

El glow es un `filter: drop-shadow` o capa SVG duplicada con `feGaussianBlur stdDeviation="2.5"` opacidad 0.5. Sutil, no chillón.

## 3.6 Patrones de glow y elevación

- **Cards y paneles** tienen una elevación implícita por contraste con el fondo (`bg-surface` sobre `bg-canvas`).
- **No se usan shadows pesados** estilo Material Design. La estética es flat-with-glow.
- **El glow de estado** es la única elevación visible y solo aplica a elementos con un estado relevante.
- **Selección de un elemento** se indica con un borde adicional `action-primary` 1.5px dashed alrededor del card (offset 4px), no con cambio de elevación.

---

# 4. Navegación Global

## 4.1 Mapa de navegación

```
[Login]
   ↓
[Selección de Proyecto] ← se puede volver desde el header
   ↓
[Home del Proyecto]
   ├── [Workflows] → [Listado] → [Editor de Proceso]
   ├── [Entities]  → [Listado] → [Editor de Entidad]
   ├── [Forms]     → [Listado] → [Editor de Formulario]
   ├── [Templates] → [Librería] → [Detalle de Template]
   └── [Configuración del Proyecto]
```

El usuario está siempre en un punto identificable de este árbol. El breadcrumb del header refleja la ruta exacta.

## 4.2 Flujo de entrada del usuario

1. El usuario carga la URL → si no hay sesión, redirección a **Login**.
2. Login exitoso → carga la pantalla de **Selección de Proyecto**.
3. El usuario elige un proyecto → carga el **Home del Proyecto** seleccionado.
4. Desde el Home, el usuario navega a cualquier módulo vía sidebar.
5. Para cambiar de proyecto, click en el selector de proyecto en la sidebar → vuelve a la pantalla de Selección de Proyecto.

No existe pantalla de "global home" sin proyecto: el usuario siempre está dentro del contexto de un proyecto, o seleccionando uno.

## 4.3 Selector de proyecto activo

Ubicación: parte superior de la sidebar en modo lista. Muestra:

- Nombre del proyecto activo (peso 600, 13px).
- Nombre del cliente al que pertenece (caption, 11px, muted).
- Icono chevron-down a la derecha sugiriendo despliegue.

Al hacer click, navega a la pantalla de **Selección de Proyecto** (no a un dropdown). Razón: el cambio de proyecto es disruptivo (cambia toda la BD, toda la metadata, todos los items visibles); merece una pantalla completa para confirmar la decisión.

En modo concentración (editor abierto), el selector de proyecto no es visible. El usuario debe primero salir del editor (botón "‹" del header o breadcrumb) para cambiar de proyecto.

## 4.4 Breadcrumb y contexto en header

Formato canónico del breadcrumb:

```
[Cliente] / [Proyecto] / [Módulo] / [Item]
```

- En modo lista: hasta `[Módulo]` (sin `[Item]` porque no hay item seleccionado).
- En modo concentración: completo hasta `[Item]`, con el item en peso 500 y color primary (los demás en tertiary).
- Cada segmento es clickeable y navega al nivel correspondiente.

Cuando hay cambios sin guardar en el editor, aparece un **chip "cambios sin guardar"** al lado del item en el breadcrumb, en ámbar tenue.

---

# 5. Login y Selección de Proyecto

## 5.1 Pantalla de Login

Pantalla centrada con un card único en el centro de la viewport. Contenido:

- Logo de la plataforma arriba (placeholder: cuadrado azul con icono).
- Título "Workflow Platform" en peso 600.
- Subtítulo "Inicia sesión para continuar" en text-tertiary.
- Campo email (TextInput).
- Campo password (TextInput type password con toggle de visibilidad).
- Botón "Iniciar sesión" primary, full width del card.
- Link secundario "¿Olvidaste tu contraseña?" debajo (placeholder en MVP, no funcional).

Sin registro abierto: en el MVP, los usuarios son creados invitados por el operador. La pantalla no muestra link "Crear cuenta".

**Estados especiales:**

- Credenciales inválidas → banner rojo arriba del card: "Email o contraseña incorrectos".
- Email no registrado → mismo mensaje (no se diferencia para no filtrar existencia de cuentas).
- Servidor caído → banner rojo: "No fue posible conectar con el servidor. Reintenta en unos momentos."

## 5.2 Pantalla de Selección de Proyecto

Layout:

- Header simplificado: logo + texto "Bienvenido de vuelta, [Nombre]" + avatar.
- Contenido principal: grid de cards de proyecto, agrupado por cliente.

Cada **card de proyecto** contiene:

- Nombre del proyecto (peso 600, 14px).
- Nombre del cliente (caption, 11px).
- Tres mini-estadísticas en línea: "5 procesos · 12 entidades · 8 forms".
- Fecha de última actividad ("hace 2 horas").
- Indicador visual sutil (icono o badge) si tiene cambios pendientes o errores.

Si el usuario tiene proyectos de múltiples clientes, se agrupan visualmente con un header de cliente arriba de su set de cards.

**Estados especiales:**

- Sin proyectos: estado vacío centrado con icono grande, mensaje "No tienes proyectos asignados aún", y nota "Contacta al administrador para que te asigne uno". En el MVP, el operador puede ser el mismo usuario, así que también aparece botón "Crear nuevo proyecto" — pero esta funcionalidad puede diferirse a Configuración global.
- Cargando: skeleton de cards.

## 5.3 Crear nuevo proyecto

Acción disponible desde la pantalla de Selección o desde Configuración. Abre un modal/wizard de pocos pasos:

1. **Nombre del proyecto** y selección de **cliente** (autocomplete con opción "crear nuevo cliente").
2. **Configuración de la BD**: nombre de la BD a crear, credenciales del servidor PostgreSQL operativo. En el MVP, valores por defecto son los del servidor central operado por el creador.
3. **Confirmación**: muestra resumen y al aceptar crea la BD, aplica migraciones del esquema METADATA, y redirige al Home del proyecto recién creado.

Este flujo NO está en el alcance prioritario del MVP de UI; puede stubearse con un único modal "Nuevo proyecto" que solo pide nombre, y la BD se crea con valores por defecto sin exponer credenciales al usuario.

---

# 6. Home del Proyecto

## 6.1 Layout

Pantalla en **modo lista**: header completo + sidebar visible + área principal de contenido.

El área principal está organizada en cinco widgets verticales, con jerarquía visual descendente:

1. **Saludo y nombre del proyecto** (banner superior).
2. **Acciones rápidas** (cards horizontales para crear cosas).
3. **Elementos recientes** (lista de los últimos 5 items editados de cualquier tipo).
4. **Estadísticas del proyecto** (counters).
5. **Slot de documentación / tutoriales** (links externos en MVP).

## 6.2 Saludo y nombre del proyecto

Banner sin fondo destacado, solo texto:

- "Hola, [Nombre del usuario]" — Display.
- Nombre del proyecto en H1, con cliente en caption debajo.
- Breve descripción del proyecto si existe (configurable en Configuración del proyecto).

## 6.3 Acciones rápidas

Fila horizontal de 4 cards de igual tamaño, una por acción primaria:

| Acción | Icono | Destino |
| --- | --- | --- |
| Nuevo proceso | `route` (icono de workflow) | Editor de proceso vacío |
| Nueva entidad | `database` | Editor de entidad vacío (greenfield) |
| Nuevo formulario | `forms` | Editor de formulario (pide entidad base primero) |
| Importar template | `download` | Modal de importación |

Cada card tiene:

- Icono dentro de un bloque coloreado a la izquierda (igual patrón que los cards de nodos en el canvas).
- Texto de la acción (peso 600, 14px).
- Descripción corta debajo (caption).
- Hover state: borde se ilumina sutilmente, cursor pointer.

En pantallas estrechas (`<960px`), se reorganiza a 2 cols. En móvil (`<640px`), a 1 col vertical.

## 6.4 Elementos recientes

Lista vertical de los últimos 5 items editados en cualquier módulo del proyecto. Cada item:

- Icono del tipo de elemento (proceso, entidad, form, template) a la izquierda.
- Nombre del item.
- Tipo en caption ("Proceso", "Entidad", etc.).
- Tiempo desde última edición ("hace 2 horas").
- Estado actual (configurado, advertencia, error) como dot pequeño a la derecha.

Click en un item → navega al editor correspondiente.

**Estado vacío** (proyecto nuevo): mensaje "Aún no hay actividad. Crea tu primer proceso, entidad o formulario para empezar."

## 6.5 Estadísticas del proyecto

Fila horizontal con 4 counters:

- Número total de **procesos**.
- Número total de **entidades**.
- Número total de **formularios**.
- Número total de **templates importados**.

Cada counter es un mini-card con:

- Número grande (24-28px peso 600).
- Etiqueta debajo (caption).
- Indicador opcional de cambio en últimos 7 días ("+2 esta semana", verde).

## 6.6 Slot de documentación

Card grande al final con título "Recursos y documentación" y 2-3 links externos:

- "Guía de inicio rápido" → link a doc externa.
- "Patrones comunes de procesos" → link.
- "Referencia de tipos de nodo" → link.

En el MVP estos pueden ser placeholders apuntando a docs en Notion, GitBook o similares. En iteraciones futuras, el slot evoluciona a tutoriales embebidos.

## 6.7 Estado vacío (proyecto nuevo)

Cuando el proyecto está recién creado y no tiene ningún artefacto:

- Saludo y nombre del proyecto aparecen normalmente.
- Las **acciones rápidas** son aún más prominentes (cards más grandes o con mensaje sugerente).
- Los widgets **elementos recientes** y **estadísticas** muestran estados vacíos amigables.
- Aparece un banner sutil arriba: "¡Bienvenido a tu nuevo proyecto! Empieza creando un proceso o importando un template."

---

# 7. Módulo Workflows (Procesos)

Este es el módulo central del producto. Su UX es la más cuidada de toda la plataforma.

## 7.1 Listado de procesos

Pantalla en **modo lista**. Estructura:

### 7.1.1 Header y barra de título

- Breadcrumb: `Cliente / Proyecto / Procesos`.
- Título "Procesos" con subtítulo "N procesos en este proyecto".
- Botón primary "Nuevo proceso" a la derecha.

### 7.1.2 Barra de filtros

Fila horizontal:

- Campo de búsqueda con icono lupa (filtra por nombre).
- Select "Todos los estados" (filtra por configurado / advertencias / con errores / borrador).
- Select "Recientes primero" (ordena por última edición / nombre / estado).

### 7.1.3 Grid de cards de proceso

Cada **card de proceso** contiene:

- **Icono del módulo** (route) dentro de un bloque coloreado a la izquierda arriba.
- **Badge de estado** a la derecha arriba (configurado/advertencias/borrador/con errores).
- **Nombre del proceso** (peso 600, 14px).
- **Mini-estadística**: "N nodos · M variables".
- **Última edición** abajo, separado por un border-top sutil: "hace 2 horas".

Hover state: borde se ilumina, cursor pointer. Click navega al editor.

### 7.1.4 Card "Crear nuevo"

Al final del grid, un card con borde dashed que invita a crear un nuevo proceso. Texto: "Nuevo proceso" + "o importar template" en caption.

### 7.1.5 Responsive behavior

| Breakpoint | Columnas |
| --- | --- |
| ≥ 1280px | 4 columnas |
| ≥ 960px | 3 columnas |
| ≥ 640px | 2 columnas |
| < 640px | 1 columna |

Implementación: `grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))` consigue este comportamiento naturalmente.

### 7.1.6 Estado vacío

Sin procesos en el proyecto:

- Icono grande de workflow centrado.
- Mensaje: "Aún no hay procesos en este proyecto".
- Dos CTAs: "Crear el primer proceso" (primary) y "Importar template" (secondary).

## 7.2 Diseñador de Procesos — layout general

Pantalla en **modo concentración**. Estructura:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ☰  ← Cliente / Proyecto / Procesos / [Nombre]  [cambios] · acciones │
├──────────────────────────────────────────────────────────────────────┤
│ ● Configurado  ● Advertencia  ● Error  ● Sin configurar              │ Legend
├──────────────────────────────────────────────────────┬───────────────┤
│                                                       │               │
│   [toolbar]                                           │ PROPIEDADES   │
│                                                       │               │
│                                                       │ [contenido    │
│              CANVAS                                   │  variable     │
│           (puntos sutiles)                            │  según nodo   │
│                                                       │  seleccionado]│
│                                                       │               │
│   [minimap]                                           │               │
│                                                       │               │
└──────────────────────────────────────────────────────┴───────────────┘
```

- **Header** con menú hamburguesa (acceso a sidebar), breadcrumb completo, chip de cambios sin guardar, y acciones: "Vista previa", "Simular", "Guardar" (primary).
- **Banda de leyenda** debajo del header explica el código cromático de estados. Visible siempre durante el MVP; en iteraciones futuras puede colapsarse al primer uso.
- **Canvas** ocupa la mayoría del espacio. Fondo con patrón de puntos sutiles (`#1F2230` 1px cada 22px) sobre `bg-canvas`.
- **Toolbar flotante** arriba a la izquierda del canvas.
- **Minimap** abajo a la izquierda.
- **Panel de propiedades** a la derecha (280px). Aparece cuando hay un nodo seleccionado; cuando no hay selección, muestra propiedades del proceso completo (nombre, descripción, variables del proceso, configuración general).

El panel de propiedades es **colapsable** vía un botón "›" en su esquina superior. Cuando está colapsado, se reduce a un slim rail vertical (28-32px) con un icono de "panel" que permite reexpandirlo.

## 7.3 Canvas y comportamientos

### 7.3.1 Toolbar del canvas

Mini-toolbar flotante en esquina superior izquierda del canvas, con fondo `bg-surface` y borde sutil. Botones:

- Zoom in / Zoom out / Nivel actual (texto "100%") / Reset zoom (cmd+0 o click sobre el "100%").
- Separador.
- **Auto-layout** — reorganiza los nodos en un grid limpio respetando las conexiones (algoritmo dagre o ELK).
- **Validar** — corre todas las reglas de validación del proceso y resalta nodos con problemas.

### 7.3.2 Interacciones del canvas

- **Pan**: drag sobre fondo vacío con click izquierdo.
- **Zoom**: scroll del mouse (con cmd/ctrl en algunos sistemas), o pinch en trackpad. Rango: 25%-200%.
- **Seleccionar nodo**: click sobre un nodo. Aparece borde dashed azul (offset 4px) y se abre panel de propiedades a la derecha.
- **Multi-select**: shift+click para añadir nodos a la selección. Drag con rubber band sobre área vacía para selección por rectángulo. (En MVP, multi-select puede limitarse a operaciones de borrado masivo y mover en grupo).
- **Mover nodo**: drag sobre el nodo. Snap a grid implícito de 20px.
- **Borrar nodo**: tecla Delete/Backspace con nodo seleccionado, o click derecho → "Eliminar".
- **Conectar nodos**: ver §7.4.
- **Doble click sobre nodo**: abre el editor avanzado del nodo (puede ser modal o panel completo, según el tipo). En MVP, doble click puede equivaler a "abrir form asociado" para tareas humanas, y "abrir editor de script" para tareas de sistema.
- **Click derecho sobre nodo**: menú contextual con "Editar", "Duplicar", "Eliminar", "Configurar conexiones".
- **Click derecho sobre fondo vacío**: menú contextual con "Pegar" (si hay nodo copiado) y "Crear nodo aquí" → submenú de tipos.

### 7.3.3 Minimap

Mini-representación del canvas completo abajo a la izquierda. Cada nodo se muestra como un rectángulo del color de su estado. El viewport actual se indica con un rectángulo azul punteado. Click en cualquier punto del minimap → pan a esa posición. Tamaño fijo: 150×90px.

### 7.3.4 Leyenda de estados

Visible debajo del header, fila horizontal con 4 indicadores:

- Punto verde con glow → "Configurado"
- Punto ámbar con glow → "Advertencia"
- Punto rojo con glow → "Error"
- Punto gris (sin glow) → "Sin configurar"

## 7.4 Paleta de nodos — botón "+" contextual

No hay paleta fija visible. La paleta aparece bajo demanda en dos escenarios:

### 7.4.1 "+" sobre nodo (hover)

Al pasar el mouse sobre un nodo, aparece un botón circular azul "+" en el **borde derecho del nodo** (centrado verticalmente), parcialmente solapado con el nodo. Click sobre el "+" → despliega un popover con los tipos de nodo disponibles:

- Inicio (solo si no existe ya un Inicio en el proceso)
- Tarea de usuario
- Tarea de sistema
- Decisión
- Fin

Al seleccionar un tipo, el nuevo nodo se crea **a la derecha del nodo origen, alineado en el mismo Y**, y la conexión entre ambos se traza automáticamente. El nuevo nodo queda seleccionado y su panel de propiedades se abre.

### 7.4.2 "+" sobre nodo con varias salidas

Si el nodo origen es una Decisión (con múltiples caminos de salida), el hover muestra **un "+" por cada salida no conectada**, ubicados en posiciones distintas alrededor del nodo. Esto permite construir las ramas de una decisión sin ambigüedad.

### 7.4.3 "+" en canvas vacío

Cuando el canvas está vacío (proceso nuevo), aparece un "+" grande centrado con texto "Comienza añadiendo el nodo de Inicio". Click → menú con todos los tipos (en este caso, "Inicio" estará destacado como recomendado).

### 7.4.4 Conectar dos nodos existentes

Para conectar manualmente dos nodos ya creados:

- Hover sobre el borde derecho del nodo origen → aparece un pequeño **handle de conexión** (círculo pequeño).
- Drag desde el handle hasta el nodo destino → crea la conexión.
- Si el nodo destino no acepta la conexión (p. ej. ya tiene una entrada y solo acepta una), feedback visual: la línea se vuelve roja durante el drag y al soltar se cancela.

## 7.5 Tipos de nodo del MVP

Los cinco tipos de nodo soportados en el MVP. Cada uno tiene icono específico, color de tipo (no de estado), forma del card, y comportamiento.

### 7.5.1 Inicio (`start`)

- **Identificador técnico:** `start`.
- **Etiqueta UI:** "Inicio".
- **Forma:** círculo de 44px, no rectángulo.
- **Color de tipo:** verde tenue para borde (cuando configurado).
- **Conexiones:** 0 entradas, exactamente 1 salida.
- **Configuración:** ninguna en MVP. Solo etiqueta visible opcional.
- **Restricción:** exactamente 1 nodo Inicio por proceso.

### 7.5.2 Fin (`end`)

- **Identificador técnico:** `end`.
- **Etiqueta UI:** "Fin".
- **Forma:** círculo de 44px con doble borde (convención BPMN heredada).
- **Color de tipo:** gris.
- **Conexiones:** N entradas, 0 salidas.
- **Configuración:** etiqueta visible opcional ("Aprobado", "Rechazado", para distinguir múltiples fines).
- **Restricción:** al menos 1 nodo Fin por proceso. Múltiples Fines permitidos.

### 7.5.3 Tarea de usuario (`human_task`)

- **Identificador técnico:** `human_task`.
- **Etiqueta UI:** "Tarea de usuario".
- **Etiqueta visible en card:** "TAREA DE USUARIO".
- **Forma:** rectángulo redondeado 180×70px.
- **Color de tipo:** azul (`type-user-task`).
- **Icono:** persona (`user`).
- **Conexiones:** 1 entrada, 1 salida.
- **Configuración (panel de propiedades):**
  - **Etiqueta** del nodo (visible en card).
  - **Formulario asignado** — select de FormDefinitions del proyecto. Si vacío, estado "Sin configurar".
  - **Asignación** — select: "Solicitante", "Manager", "RRHH", "Otro" (placeholder en MVP; sin lógica de asignación real).
  - **Variables de entrada** — qué variables del contexto se le pasan al form (en MVP: todas por defecto).
  - **Variables de salida** — qué outputs del form se vuelcan al contexto.

### 7.5.4 Tarea de sistema (`script_task`)

- **Identificador técnico:** `script_task`.
- **Etiqueta UI:** "Tarea de sistema".
- **Etiqueta visible en card:** "TAREA DE SISTEMA".
- **Forma:** rectángulo redondeado 180×70px.
- **Color de tipo:** púrpura (`type-system-task`).
- **Icono:** code/script (`code`).
- **Conexiones:** 1 entrada, 1 salida.
- **Configuración (panel de propiedades):**
  - **Etiqueta** del nodo.
  - **Editor de código** (Monaco Editor embebido o link a modal con Monaco). Lenguaje: JavaScript en MVP.
  - **Variables de entrada** y **variables de salida** mapeadas al contexto.
  - En MVP el editor de código puede ser un textarea simple si Monaco añade complejidad; se evalúa al implementar.

### 7.5.5 Decisión (`exclusive_gateway`)

- **Identificador técnico:** `exclusive_gateway`.
- **Etiqueta UI:** "Decisión".
- **Etiqueta visible en card:** "DECISIÓN".
- **Forma:** rectángulo redondeado 180×70px (no rombo BPMN; demasiado disruptivo visualmente).
- **Color de tipo:** ámbar (`type-decision`).
- **Icono:** bifurcación (`git-branch` o similar).
- **Conexiones:** 1 entrada, 2-N salidas (caminos).
- **Configuración (panel de propiedades):**
  - **Etiqueta** del nodo (típicamente formulada como pregunta).
  - **Variable a evaluar** — select de variables del contexto, o expresión libre.
  - **Caminos de salida** — lista editable de pares `(condición, destino)`. Cada camino con:
    - Etiqueta visible ("sí, aprueba", "no", "monto > 1000", etc.).
    - Color (verde, rojo, gris) para el conector en el canvas.
    - Condición — expresión que debe evaluar a true para tomar ese camino.
    - Destino — nodo al que apunta.
  - Un **camino por defecto** (fallback) obligatorio.

## 7.6 Panel de propiedades del nodo

Visible a la derecha cuando hay un nodo seleccionado. Estructura común:

### 7.6.1 Header del panel

- Label "PROPIEDADES" en uppercase pequeño.
- Botón "✕" para cerrar (o colapsar) el panel.

### 7.6.2 Identificador del nodo

Bloque con:

- Icono de tipo en bloque coloreado.
- Nombre del nodo (peso 600).
- Identificador técnico en monospace (`human_task`, `exclusive_gateway`, etc.).
- Badge de estado a la derecha (configurado/advertencia/error/borrador).

### 7.6.3 Campos editables

Varían según el tipo de nodo. Pattern común:

- Label en uppercase 10px peso 500 + tracking.
- Input/select abajo, full width del panel.
- Hint en caption debajo si necesario.

Inputs:

- **Inputs de texto** y selects con fondo `bg-input`, borde `border-subtle`, radius 6px.
- **Selects de variables** muestran sus valores en monospace y prefijo `contexto.` para variables del proceso.
- **Checkboxes** con `accent-color: action-primary`.

### 7.6.4 Caminos de salida (solo para Decisión)

Lista vertical de cards mini, cada uno con:

- Punto coloreado a la izquierda (verde/rojo/gris según camino).
- Etiqueta del camino en peso 500.
- Icono "→" a la derecha.
- Nombre del nodo destino en caption debajo.

Botón "+ Agregar camino" abajo (dashed border).

## 7.7 Validación visual y estados

### 7.7.1 Validación a nivel de nodo

Cada nodo se evalúa contra sus reglas (definidas por su tipo) cada vez que cambia su configuración. Resultado:

- **Configurado**: todas las reglas pasan. Borde verde con glow.
- **Advertencia**: configuración funcional pero con observaciones (p. ej. "el camino 'no' no tiene destino definido"). Borde ámbar.
- **Error**: configuración inválida que impide ejecución (p. ej. tarea de usuario sin form asignado). Borde rojo.
- **Sin configurar**: nodo recién creado sin propiedades básicas (sin etiqueta, sin tipo de form, etc.). Borde gris dashed.

### 7.7.2 Validación a nivel de proceso

Triggered manualmente con el botón "Validar" en la toolbar del canvas. Corre validaciones globales:

- Existe exactamente un Inicio.
- Existe al menos un Fin.
- Todo nodo alcanzable desde Inicio.
- Todo nodo alcanza eventualmente un Fin (sin loops sin escape).
- Toda variable referenciada existe en el contexto.

Resultado: panel inferior temporal con lista de errores y advertencias, click en cada uno pan-a-zoom al nodo afectado.

## 7.8 Variables del proceso (contexto)

Accesible desde el panel de propiedades cuando no hay nodo seleccionado (es decir, cuando se está viendo el proceso completo).

Lista vertical de variables, cada una con:

- Nombre (monospace).
- Tipo de dato (badge coloreado).
- Valor por defecto si aplica.
- Botón eliminar.

Botón "+ Agregar variable" → modal con campos: nombre, tipo, valor por defecto opcional, descripción.

## 7.9 Vista de simulación (dry-run)

Accesible desde el botón "Simular" en el header del editor. Diferenciador clave del MVP — permite validar diseños end-to-end sin tener motor real.

### 7.9.1 Modo simulación

Al activarse, la UI cambia ligeramente:

- El botón "Simular" se vuelve "Detener simulación" en rojo tenue.
- Aparece un **panel inferior** con el trace de la simulación (similar al panel de logs de QA Studio).
- Los nodos van cambiando de color según se ejecutan:
  - **Verde activo** (con glow más intenso): nodo completado.
  - **Ámbar pulsante**: nodo en ejecución (esperando input del usuario si es tarea humana).
  - **Gris**: nodo pendiente.

### 7.9.2 Interacción con tareas humanas en simulación

Cuando el flujo llega a una `human_task`:

- El nodo se ilumina ámbar pulsante.
- Aparece un modal con el formulario asociado renderizado.
- El usuario llena los datos como lo haría un usuario final.
- Al enviar, el modal se cierra, el nodo cambia a verde, y la simulación continúa al siguiente nodo.

### 7.9.3 Interacción con tareas de sistema

- El script se ejecuta automáticamente (sin sandbox real en MVP; puede mostrar los inputs y outputs simulados).
- El nodo cambia rápidamente a verde.
- El trace registra la ejecución y los valores resultantes en el contexto.

### 7.9.4 Interacción con decisiones

- El sistema evalúa la condición usando los valores actuales del contexto.
- Toma el camino correspondiente.
- El trace registra qué camino se tomó y por qué.

### 7.9.5 Panel inferior de trace

Lista vertical con timestamps relativos. Cada entrada:

```
00:00.0  ► Inicio
00:00.1  ► Solicitud (tarea de usuario) — esperando input
00:01.5  ✓ Solicitud completada — fechas: 2026-06-15 / 2026-06-22
00:01.5  ► ¿Aprueba jefe? (decisión)
00:01.5  → camino "sí, aprueba" (contexto.decision_jefe = true)
00:01.5  ► Aprobación RRHH (tarea de usuario)
...
```

Al finalizar, mensaje "Simulación completada. Llegó a Fin." o "Simulación bloqueada en [nodo]" si encontró un nodo no configurado.

### 7.9.6 Variables visibles durante simulación

El panel de propiedades muestra el estado actual del contexto: lista de variables con sus valores actuales, actualizada en tiempo real conforme avanza la simulación.

---

# 8. Módulo Entities

## 8.1 Listado de entidades

Pantalla en **modo lista**, estructura idéntica a la del listado de procesos:

- Header con breadcrumb.
- Título "Entidades" + contador.
- Botón primary "Nueva entidad".
- Barra de filtros (búsqueda, modo greenfield/brownfield, ordenamiento).
- Grid de cards de entidad.

Cada **card de entidad** muestra:

- Icono de database en bloque coloreado.
- Badge de estado (configurada / advertencia / error / borrador).
- Nombre de la entidad (peso 600).
- Nombre de la tabla física en monospace + flag de modo ("greenfield" o "brownfield").
- Mini-stat: "N atributos · M relaciones".
- Última edición.

Card "Nueva entidad" + dashed border al final del grid.

## 8.2 Diseñador de entidades (greenfield)

Pantalla en **modo concentración**. Layout:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ☰  ← Cliente / Proyecto / Entidades / [Nombre]    [acciones]        │
├──────────────────────────────────────────────────────┬───────────────┤
│ [Icono] [Nombre editable]                            │ ATRIBUTO      │
│         tabla física: vacation_requests · greenfield │               │
│                                                       │ [contenido    │
│ ATRIBUTOS                          [+ Agregar]       │  del atributo │
│ ┌─────────────────────────────────────────────────┐  │  seleccionado]│
│ │ ⋮ id              uuid       PK                 │  │               │
│ │ ⋮ employee_id     uuid       FK, REQ           │← │               │
│ │ ⋮ start_date      date       REQ                │  │               │
│ │ ⋮ end_date        date       REQ                │  │               │
│ │ ⋮ reason          string     —                  │  │               │
│ │ ⋮ status          string     def: pendiente    │  │               │
│ └─────────────────────────────────────────────────┘  │               │
│                                                       │               │
│ RELACIONES                         [+ Agregar]       │               │
│ ┌─────────────────────────────────────────────────┐  │               │
│ │ Solicitud  →  [N:1]  →  Empleado                │  │               │
│ │ vía employee_id                                  │  │               │
│ └─────────────────────────────────────────────────┘  │               │
└──────────────────────────────────────────────────────┴───────────────┘
```

### 8.2.1 Header de la entidad

- Icono de database en bloque coloreado.
- Nombre de la entidad editable inline (click → input).
- Meta info en caption: "tabla física: [nombre]" + flag "greenfield" o "brownfield" con icono check verde.

### 8.2.2 Acciones del header

- **Ver SQL** — muestra el DDL que la herramienta generará (CREATE TABLE, ALTER TABLE, etc.). Útil para usuarios técnicos.
- **Guardar** (primary).

## 8.3 Tabla de atributos

Estructura tabular con columnas:

| Columna | Tipo | Contenido |
| --- | --- | --- |
| Drag | Handle | Icono ⋮⋮ para reordenar (drag and drop) |
| Nombre | Texto | Nombre técnico (monospace) + descripción debajo (caption) |
| Tipo | Chip | Tipo de dato como chip coloreado (`type-data-*`) |
| Marcas | Chips | PK, FK, REQ, UNQ, BK como pills compactas |
| Menú | Icono | Click → menú contextual (Editar, Duplicar, Eliminar) |

Click en una fila → fila se resalta (fondo `action-bg-subtle`, borde de fila azul) y el panel derecho carga sus propiedades.

## 8.4 Panel de propiedades del atributo

Igual estructura que el panel del Workflow:

- Header "ATRIBUTO" + cerrar.
- Identificador con icono, nombre, tipo lógico ("attribute / FK", etc.).
- Campos:
  - **Nombre técnico** (monospace).
  - **Etiqueta visible**.
  - **Tipo de dato** (select).
  - **Relación FK** (si aplica, select de entidades del proyecto).
- **Restricciones** (checkboxes): Requerido, Único, Llave de negocio.
- Sección al final con border-top separador: **Columna física** (monospace, editable). Hint: "nombre real de la columna en SQL".

Esta separación visual entre "negocio" (arriba) y "técnico" (abajo) refleja la separación que tiene el metamodelo (Attribute.metadata).

## 8.5 Sección de relaciones

Debajo de la tabla de atributos. Cards compactas, una por relación:

```
[Entidad origen]  →  [cardinality]  →  [Entidad destino]
vía [atributo FK]
```

- Cardinality en pill monospace ("N:1", "1:N", "1:1").
- Flecha icon entre entidades.
- Click → abre modal/panel para editar la relación.

Botón "+ Agregar relación" → wizard:

1. Tipo de relación (N:1, 1:N, 1:1, N:N).
2. Entidad destino (select).
3. Atributo FK (autosugerido si ya existe, o crear nuevo).

## 8.6 Generación de SQL y vista previa

Click en "Ver SQL" en el header → modal con código SQL:

```sql
CREATE TABLE vacation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  status text DEFAULT 'pendiente'
);

CREATE INDEX idx_vacation_requests_employee ON vacation_requests(employee_id);
```

Botón "Copiar" para copiar al portapapeles.

Al guardar la entidad en modo greenfield, este SQL se ejecuta automáticamente contra la BD del proyecto. Si la entidad ya existía y se modificó, se generan `ALTER TABLE` apropiados (con confirmación previa si hay cambios destructivos como DROP COLUMN).

---

# 9. Módulo Forms

## 9.1 Listado de formularios

Misma estructura que listado de procesos y de entidades. Cada **card de formulario** muestra:

- Icono de form en bloque coloreado.
- Badge de estado.
- Nombre del formulario.
- **Entidad base** en caption ("basado en Solicitud").
- Mini-stat: "N campos".
- Última edición.

## 9.2 Diseñador de formularios — layout general

Pantalla en **modo concentración**. Layout de **tres columnas**:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ☰  ← Cliente / Proyecto / Forms / [Nombre]            [acciones]    │
├─────────────┬─────────────────────────────────────────┬──────────────┤
│ ATRIBUTOS   │                                          │ PROPIEDADES  │
│ DISPONIBLES │           LIENZO WYSIWYG                │              │
│             │                                          │ [contenido   │
│ [árbol      │  [campo 1]                              │  variable    │
│  navegable] │  [campo 2]                              │  según campo │
│             │  [campo 3 seleccionado]                 │  seleccionado│
│             │  [campo 4]                              │  o forma]    │
│             │  [drop zone]                            │              │
│             │                                          │              │
└─────────────┴─────────────────────────────────────────┴──────────────┘
   colapsable                                              colapsable
```

Ambas columnas laterales son **colapsables**. Cuando ambas están colapsadas, el lienzo ocupa la mayor parte del viewport, ideal para forms grandes.

## 9.3 Árbol de atributos disponibles (navegación entre relaciones)

Panel izquierdo, 280px. Esta es la **feature diferenciadora del módulo de Forms**: permite construir formularios que combinan atributos de múltiples entidades navegando por las relaciones.

### 9.3.1 Estructura del árbol

- **Nivel 0:** la entidad base del form (llamada "contexto"), destacada con fondo `action-bg-subtle` y chip "contexto" en monospace.
- **Nivel 0 attributes:** los atributos de la entidad base se listan debajo, indentados, con un border-left sutil.
- **FKs son expandibles:** un atributo FK se distingue visualmente (color `type-fk` ámbar) y tiene un chevron a la izquierda. Click → expande y muestra:
  - Header con icono de database + nombre de la entidad relacionada en cursiva (caption).
  - Atributos de la entidad relacionada, indentados un nivel más, con su propio border-left.
- **FKs de niveles profundos también son expandibles**, sin límite explícito de profundidad en el árbol UI (la profundidad efectiva la limita la implementación; recomendado: 5 niveles).

### 9.3.2 Items del árbol

Cada atributo en el árbol es un item con:

- Icono pequeño a la izquierda (dot, o icono específico de tipo de dato).
- Nombre técnico en monospace.
- Tipo de dato a la derecha (caption pequeña coloreada según `type-data-*`).
- Indicador de PK/FK si aplica, a la derecha.

Cursor `grab` en hover, indicando que se puede arrastrar al lienzo.

### 9.3.3 Búsqueda

Campo de búsqueda en el tope del panel. Filtra el árbol mostrando solo los atributos que coinciden + sus ancestros (entidades padre) para preservar el contexto de navegación.

### 9.3.4 Hint educativo

Al final del panel, un cuadrado con borde dashed ámbar y mensaje:

> 💡 Navegación: click en una FK para expandir y ver los atributos de la entidad relacionada. Arrastra cualquier atributo al lienzo.

Aparece siempre en el MVP. En iteraciones futuras se puede ocultar tras el primer uso exitoso.

### 9.3.5 Colapsar el panel

Botón "‹" en la esquina superior derecha del panel. Al colapsar, el panel se reduce a un slim rail (28-32px) con icono de árbol. Click en el rail → reexpande.

## 9.4 Lienzo WYSIWYG

Columna central. Renderiza el formulario en construcción de forma fiel a cómo se verá en runtime, con superpuestos de edición.

### 9.4.1 Header del lienzo

- Nombre del formulario editable inline.
- Meta info en caption: "basado en [Entidad base]" + "N campos".

### 9.4.2 Campos del formulario

Cada campo se renderiza como un **card** con:

- **Drag handle** ⋮⋮ a la izquierda para reordenar verticalmente.
- **Etiqueta visible** del campo (peso 600).
- **Badges** a la derecha de la etiqueta: REQ si es requerido, RO si readonly, etc.
- **Identificador técnico** en monospace, alineado a la derecha (`start_date`, `employee.full_name`, etc.).
- **Input renderizado** del componente UI correspondiente, con un valor de ejemplo si aplica.

### 9.4.3 Distinción visual: campo local vs. campo relacionado

- **Campo local** (atributo de la entidad base): card normal, ID técnico solo el nombre del atributo (`start_date`).
- **Campo relacionado** (atributo de una entidad navegada via FK): card con label flotante en la esquina superior izquierda "CAMPO RELACIONADO" en azul, ID técnico con notación dot (`employee.full_name`), readonly por defecto.

### 9.4.4 Selección de un campo

Click sobre un campo → borde azul dashed (offset 4px) y panel derecho carga sus propiedades.

### 9.4.5 Drop zone

Al final de la lista de campos, un área con borde dashed y mensaje "Arrastra un atributo aquí". También se muestra entre campos cuando el usuario arrastra un atributo desde el árbol (zona de inserción).

### 9.4.6 Reordenar campos

Drag and drop vertical con el handle ⋮⋮. Animaciones suaves de inserción.

### 9.4.7 Eliminar un campo

Hover sobre un campo → aparece botón ✕ en la esquina superior derecha. Click → confirma y elimina.

## 9.5 Panel de propiedades del campo

Columna derecha, 280px. Cuando hay un campo seleccionado, muestra sus propiedades.

### 9.5.1 Identificador del campo

Bloque con:

- Icono del componente UI en bloque coloreado.
- Nombre visible del campo.
- Identificador técnico (path completo si es relacionado: `employee.full_name`).

### 9.5.2 Ruta de navegación (para campos relacionados)

Sección destacada — solo aparece para campos relacionados. Muestra el path visualmente:

```
[contexto] › [employee_id (FK ámbar)] › [full_name]
```

Cada segmento es un chip de color (azul para entidad raíz, ámbar para FK que conecta, gris para atributo final). Hint debajo: "campo en entidad relacionada (vía FK)".

Esto es la materialización visible del campo `xPath` reservado en el SRS del MVP previo.

### 9.5.3 Campos editables

- **Etiqueta visible**.
- **Placeholder**.
- **Texto de ayuda** (helpText).
- **Componente UI** — select de componentes disponibles para el dataType del atributo referenciado.
- **Valor por defecto** (si aplica).

### 9.5.4 Comportamiento

Checkboxes:

- **Solo lectura** (readonly) — checked por defecto para campos relacionados.
- **Oculto** (hidden) — campo está en el form pero no visible al usuario.
- **Override de requerido** — permite hacer un campo no requerido aunque el atributo sí lo sea.

### 9.5.5 Validaciones

Sección "Validaciones" — checkboxes y campos según el tipo de dato del atributo:

- string: minLength, maxLength, pattern (regex).
- integer/decimal: min, max.
- date: minDate, maxDate.

### 9.5.6 Nota informativa para campos relacionados

Al final del panel, un cuadrado con borde azul tenue y mensaje:

> Nota: los campos relacionados son solo lectura por defecto. Para editar la entidad relacionada usa un sub-formulario.

Sub-formularios maestro-detalle están fuera del MVP, pero la nota anticipa la limitación al usuario.

## 9.6 Modos del formulario

En el panel de propiedades cuando no hay campo seleccionado (es decir, viendo el form completo), se configura el modo:

- **CRUD** (Create / Edit / Delete sobre un registro por PK).
- **List/Search** (listado paginado con búsqueda).

Cada modo habilita opciones distintas en los campos (search.mode para list_search, actions para crud).

---

# 10. Módulo Templates

## 10.1 Librería de templates

Pantalla en **modo lista** con dos pestañas:

- **Mis templates** — la librería personal del creador (templates importados/exportados localmente al proyecto).
- **Templates de la plataforma** — placeholder en MVP, futuro para templates compartidos.

Grid de cards de template, cada una con:

- Icono del tipo de template (proceso, form, entidad).
- Nombre + descripción corta.
- Última actualización.
- Botón "Importar al proyecto" en hover.

## 10.2 Export e import

### 10.2.1 Exportar un proceso/form/entidad como template

Desde el listado del módulo correspondiente, menú contextual del item → "Exportar como template" → modal:

- Nombre del template.
- Descripción.
- Selección de qué incluir si aplica (p. ej. exportar un proceso incluye también sus formularios referenciados; el usuario decide si los incluye o no).
- Botón "Descargar JSON" o "Guardar en librería".

### 10.2.2 Importar template al proyecto

Desde la librería o desde "Acciones rápidas" del Home → "Importar template" → modal:

- Drag and drop de archivo JSON o pick desde librería.
- Vista previa del contenido (qué procesos, forms, entidades trae).
- **Resolución de conflictos** — si algún nombre ya existe en el proyecto, opciones: renombrar, sobrescribir, omitir.
- Botón "Importar".

## 10.3 Templates parametrizables

Fuera del alcance del MVP. Los templates son monolíticos en v1: se importan tal cual. La parametrización (mismo template instanciado con valores distintos) llega en iteración posterior.

---

# 11. Estados Transversales

## 11.1 Loading

Tres patrones según contexto:

- **Loading de página completa** (transición entre módulos, carga inicial): spinner centrado con texto "Cargando..." abajo. Duración esperada < 2s; si es mayor, mostrar skeleton.
- **Skeleton** (en grids y listas): placeholders gris claro con animación shimmer suave en los lugares donde irían cards/filas.
- **Loading inline** (operación que afecta solo a un elemento, como guardar): el elemento muestra un spinner pequeño al lado o el botón cambia su texto a "Guardando..." y se deshabilita.

## 11.2 Empty states

Cuando una lista/tabla está vacía:

- Icono grande del tipo de elemento (centrado).
- Mensaje principal: "Aún no hay [elementos] en este proyecto".
- Mensaje secundario explicando cómo empezar.
- CTA primary para crear el primer elemento.
- Opcional: CTA secondary para una acción alternativa (importar, etc.).

## 11.3 Error states

Diferentes según tipo:

- **Error de carga de datos**: card en el área principal con icono de alerta rojo, mensaje "No fue posible cargar [X]", y botón "Reintentar". Detalles técnicos accesibles en un disclosure ("Ver detalles").
- **Error de validación de campo**: borde rojo del input, mensaje rojo debajo del input con icono de alerta pequeño.
- **Error de operación (al guardar, eliminar)**: toast en la esquina inferior derecha con mensaje rojo, persistencia 5s + botón "Cerrar". Detalles técnicos disponibles en hover.
- **Error 500 / inesperado**: pantalla completa con mensaje amistoso "Algo salió mal" + botón "Recargar" + texto pequeño con error técnico.

## 11.4 Success / feedback

- **Operación exitosa** (guardar, crear, eliminar): toast en esquina inferior derecha con mensaje verde, persistencia 3s. Texto conciso: "Proceso guardado", "Atributo eliminado".
- **Operación grande** (importar template, generar SQL): toast con link "Ver detalles" → modal con resumen.

## 11.5 Confirmaciones destructivas

Cualquier acción destructiva irreversible requiere confirmación:

- Modal centrado con icono rojo de alerta.
- Título: "¿Eliminar [elemento]?"
- Mensaje explicando consecuencias: "Esta acción no se puede deshacer. Se eliminarán también [N dependencias]."
- Dos botones: "Cancelar" (secondary) y "Eliminar" (red primary).

Para acciones particularmente peligrosas (borrar un proyecto completo): el modal exige escribir el nombre del elemento como confirmación, similar al patrón de GitHub.

## 11.6 Validación en tiempo real

- Mientras el usuario escribe en un input con restricciones (regex, longitud, etc.), no mostrar error.
- Al perder foco (blur), validar y mostrar error si falla.
- Al enviar el form, validar todo y resaltar todos los errores simultáneamente.
- No bloquear el envío si solo hay advertencias; solo si hay errores.

---

# 12. Comportamiento Responsive y de Paneles

## 12.1 Breakpoints

| Nombre | Ancho mínimo | Notas |
| --- | --- | --- |
| Mobile | < 640px | Soporte mínimo en MVP; UI se reorganiza a 1 col, sidebar se vuelve drawer |
| Tablet | 640px - 960px | Grids a 2 cols, paneles más estrechos |
| Desktop | 960px - 1280px | Layout estándar |
| Wide | ≥ 1280px | 4 cols en grids de cards |

El producto está pensado para **desktop primario** (uso interno por equipo técnico). Mobile es soporte de cortesía: visualizar dashboards, completar tareas simples; no diseñar workflows complejos.

## 12.2 Paneles colapsables

Cada panel lateral en los editores es colapsable:

- **Workflow Designer:** panel derecho (propiedades) colapsable.
- **Entity Designer:** panel derecho (propiedades) colapsable.
- **Form Designer:** ambos paneles (árbol izquierdo, propiedades derecho) colapsables.

Al colapsar, el panel se reduce a un slim rail vertical (28-32px) con un icono representativo. Click en el rail → reexpande.

El estado colapsado/expandido se persiste por usuario y por tipo de panel (no por proyecto), de modo que el usuario obtenga consistencia entre sesiones.

## 12.3 Modo concentración vs. acompañado por módulo

| Módulo / pantalla | Modo |
| --- | --- |
| Login | N/A (pantalla aislada) |
| Selección de proyecto | N/A (pantalla aislada) |
| Home del proyecto | Acompañado |
| Listado de Workflows | Acompañado |
| Editor de Workflow | Concentración |
| Listado de Entities | Acompañado |
| Editor de Entity | Concentración |
| Listado de Forms | Acompañado |
| Editor de Form | Concentración |
| Librería de Templates | Acompañado |
| Configuración del proyecto | Acompañado |

En modo concentración, el header sigue mostrando el menú hamburguesa para abrir la sidebar bajo demanda. La sidebar emerge como un panel temporal sobre el canvas (sin reducir su ancho), y se cierra al click fuera o al pulsar Esc.

---

# 13. Lenguaje y Nomenclatura

## 13.1 Diccionario UI ↔ identificador técnico

El producto usa dos capas de vocabulario:

- **UI**: términos amigables, en español, accesibles a usuarios no técnicos.
- **Código/Metadata**: identificadores técnicos en inglés snake_case.

Esto permite mantener consistencia técnica en el código mientras se cuida la experiencia del usuario hispanohablante.

| UI muestra | Identificador técnico | Notas |
| --- | --- | --- |
| Proceso | `process` / `process_definition` | "Workflow" se reserva para el nombre del producto y del módulo |
| Caso | `process_instance` | Instancia ejecutándose; UI no expone esto en MVP |
| Nodo | `node` | Elemento del grafo |
| Inicio | `start` | |
| Fin | `end` | |
| Tarea de usuario | `human_task` | Tipo de nodo |
| Tarea de sistema | `script_task` | Tipo de nodo |
| Decisión | `exclusive_gateway` | Tipo de nodo. Internamente se puede llamar "if_else" |
| Camino | `transition` | Arista del grafo |
| Variable | `context_variable` | Variable del proceso |
| Contexto | `context` | Conjunto de variables; namespace usado en expresiones |
| Entidad | `entity` | |
| Atributo | `attribute` | |
| Relación | `relation` | Entre entidades |
| Formulario | `form_definition` / `form` | |
| Campo | `form_field` | |
| Plantilla / Template | `template` | UI puede usar ambos; preferir "Template" por reconocibilidad |
| Cliente | `customer` | |
| Proyecto | `project` | También es la BD aislada |
| Configurado | `valid` | Estado |
| Advertencia | `warning` | Estado |
| Error | `error` / `invalid` | Estado |
| Sin configurar | `draft` / `unconfigured` | Estado |
| Greenfield | `greenfield` | Modo de proyecto |
| Brownfield | `brownfield` | Modo de proyecto (fuera de MVP) |

## 13.2 Tono de mensajes al usuario

- **Mensajes informativos y exitosos:** breves, neutrales, positivos. "Proceso guardado", "Atributo creado".
- **Mensajes de error:** claros, accionables, no agresivos. Mal: "Operación fallida". Bien: "No fue posible guardar el proceso. Reintenta en unos momentos."
- **Mensajes de validación:** explican qué falta y cómo arreglarlo. Mal: "Campo inválido". Bien: "El nombre debe tener al menos 3 caracteres."
- **Mensajes de confirmación destructiva:** explícitos sobre consecuencias. "Al eliminar este proceso se eliminarán también los 3 formularios asociados."
- **Tono general:** profesional y directo. Sin emoticonos en mensajes serios (sí en estados vacíos o tips amigables).

## 13.3 Glosario UI

Definiciones de los términos UI clave para evitar inconsistencia entre miembros del equipo:

| Término | Definición |
| --- | --- |
| Proceso | Definición de un workflow ejecutable. Es un grafo de nodos. |
| Caso | Una ejecución concreta de un proceso. En MVP no se muestran casos. |
| Nodo | Cada paso del proceso. Tiene un tipo (inicio, tarea, decisión, fin). |
| Camino | La conexión entre dos nodos, opcionalmente con una condición. |
| Variable del proceso | Dato que viaja con el caso a lo largo de su ejecución. |
| Contexto | El conjunto de variables del proceso, accesible desde cualquier nodo. |
| Entidad | Una tabla del modelo de datos del proyecto. |
| Atributo | Una columna de una entidad. |
| Formulario | Definición de una interfaz para capturar o mostrar datos. |
| Campo | Cada elemento individual de un formulario, vinculado a un atributo. |
| Campo local | Campo vinculado a un atributo de la entidad base del formulario. |
| Campo relacionado | Campo vinculado a un atributo de una entidad relacionada (navegando una FK). |
| Template | Proceso, form o entidad reutilizable, exportable como JSON e importable a otro proyecto. |
| Greenfield | Modo en que el modelo de datos se crea desde cero en la herramienta. |
| Modo concentración | Layout de editor con chrome reducido al mínimo. |
| Modo lista | Layout con sidebar de módulos visible. |

---

# 14. Accesibilidad

## 14.1 Contraste mínimo

- Texto principal sobre fondos: ratio mínimo **4.5:1** (WCAG AA).
- Texto grande (≥18px o ≥14px bold): mínimo **3:1**.
- Componentes UI (botones, inputs): borde con contraste ≥3:1 contra fondo.

La paleta definida en §3.1 cumple estos ratios. Verificar en implementación con herramientas (ej. Stark, axe).

## 14.2 Soporte de teclado

Todos los flujos deben ser navegables sin mouse:

- **Tab** mueve el foco entre elementos interactivos.
- **Shift+Tab** retrocede.
- **Enter** activa botones y links; en inputs envía el formulario si aplica.
- **Esc** cierra modales, popovers, paneles emergentes.
- **Espacio** marca/desmarca checkboxes.
- **Flechas** navegan dentro de menús, listas y árboles.

Atajos globales (mínimos en MVP):

- **Cmd/Ctrl + S** — Guardar el item actual.
- **Cmd/Ctrl + Z / Shift+Z** — Undo / Redo (diferido en MVP si complica el canvas; ver §15).
- **Cmd/Ctrl + K** — Command palette (diferido en MVP).

## 14.3 ARIA y lectores de pantalla

- Iconos decorativos: `aria-hidden="true"`.
- Iconos funcionales (botones de solo icono): `aria-label` descriptivo.
- Inputs con `<label>` asociado o `aria-labelledby`.
- Estados dinámicos (loading, error) anunciados con `aria-live="polite"` o `aria-live="assertive"` según urgencia.
- Modales con `role="dialog"` y foco gestionado correctamente al abrir/cerrar.

El canvas de workflows es el componente más difícil de hacer accesible — se difiere una solución completa a post-MVP. En MVP, asegurar al menos que se puede navegar entre nodos con Tab y editar sus propiedades con teclado vía el panel derecho.

---

# 15. Decisiones Diferidas (post-MVP)

Para no contaminar el alcance del MVP de UI, las siguientes decisiones de UX quedan explícitamente diferidas:

- **Undo/redo en el canvas.** Implementarlo bien requiere un sistema de comandos serializable. En MVP, los cambios se persisten y un usuario que se equivoca puede deshacer manualmente.
- **Command palette (Cmd+K)** estilo Linear. Útil pero no esencial para el flujo de un usuario que recién conoce la herramienta.
- **Atajos de teclado avanzados** más allá de los básicos del §14.2.
- **Personalización del layout** (drag de paneles para reordenarlos, guardar layouts personalizados).
- **Tutoriales interactivos in-app.** Por ahora docs externas.
- **Notificaciones in-app y centro de actividad.** No hay actividad real que notificar sin motor.
- **Dark/light mode automático según hora o preferencia del sistema.** En MVP solo switch manual persistente.
- **Internacionalización a otros idiomas.** Español-only en MVP.
- **Sub-formularios maestro-detalle.** Diferido; el campo relacionado readonly resuelve los casos básicos.
- **Editor visual de expresiones para condiciones de decisión.** En MVP es input de texto libre con autocompletado básico.
- **Vista de instancias en ejecución con highlight del nodo activo.** Requiere motor real.
- **Exportación de procesos como imagen o PDF.** Útil para documentación; diferido.

---

# 16. Historial de Versiones

| **Versión** | **Fecha** | **Descripción** |
| --- | --- | --- |
| 1.0 | Mayo 2026 | Versión inicial del UX Spec de Workflow Platform. Establece los principios de UX, el lenguaje visual completo (paletas dark/light, tipografía, iconografía, estados), la navegación global, y los layouts detallados de los seis módulos del MVP de UI: Login, Selección de proyecto, Home del proyecto, Workflows (procesos), Entities, Forms enriquecidos y Templates. Documenta los patrones transversales (loading, empty, error), comportamiento responsive y de paneles colapsables, nomenclatura UI ↔ identificador técnico (camino C de doble capa), accesibilidad mínima, y decisiones explícitamente diferidas a post-MVP. Deriva del documento de Visión v1.0 y consolida todas las decisiones tomadas durante el bucle consultivo, incluyendo los wireframes validados de Workflow Designer, Lista de procesos, Entity Designer y Form Designer con navegación entre relaciones. |

*— Fin del documento —*

Confidencial · Mayo 2026 · Workflow Platform · UX Spec v1.0
