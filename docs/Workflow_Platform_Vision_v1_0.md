**DOCUMENTO DE VISIÓN**

Workflow Platform

*Plataforma low-code para construir y ejecutar procesos de negocio personalizados*

Mayo 2026  ·  v1.0  ·  Confidencial — Documento interno

---

# 1. Resumen Ejecutivo

Workflow Platform es una plataforma low-code para diseñar y ejecutar procesos de negocio personalizados, compuestos por workflows, formularios y datos. Combina la lógica secuencial de los procesos estructurados con la flexibilidad de un editor de nodos estilo n8n, sobre un metamodelo que permite representar dominios de negocio diversos sin escribir código.

El producto nace como **herramienta personal de delivery acelerado**: un toolkit que permite a su creador y a un equipo técnico cercano construir soluciones de software a la medida para clientes de distintos sectores, en una fracción del tiempo y costo que requeriría el desarrollo tradicional. La vocación es comercial: cuando la plataforma esté madura, evolucionará hacia un producto SaaS multi-tenant donde el creador opera la plataforma central y los clientes consumen sus instancias o las llevan on-premise.

| **Posicionamiento** Workflow Platform no compite con n8n por usuarios de automatización, ni con Camunda por ingenieros de BPM, ni con Retool por dashboards internos. Compite con la práctica tradicional de **codear soluciones a la medida desde cero**: reduce un proyecto típico de 3 meses de desarrollo custom a 3-5 semanas de configuración + ajustes finos, con una librería personal de templates que crece con cada proyecto entregado. |
| --- |

Este documento de Visión es el norte estratégico del producto. Define qué es, para quién, qué se construye en el primer MVP de UI, qué se difiere, y cuáles son los criterios de éxito. Los documentos técnicos (UX Spec, SRS de Frontend, SRS de Backend, Definición de Metadata, Modelo de Datos) derivan de aquí y son responsables de las decisiones detalladas dentro del marco que esta Visión establece.

---

# 2. Contexto y Motivación

## 2.1 Origen — el MVP previo

Antes de Workflow Platform existió un MVP llamado *Metadata Framework Tool* (MFT, mayo 2026, v1.0-v1.6 del SRS y v1.1 del Framework Conceptual). Ese MVP validó una hipótesis técnica fundamental: **es posible construir un sistema que ingiera el esquema de una base de datos relacional existente, exponga sus tablas como artefactos de metadata, permita diseñar formularios CRUD sobre esa metadata, y los ejecute persistiendo datos en las tablas físicas originales — todo sin escribir código**.

El MVP cumplió su propósito. Demostró que el enfoque de metadata + formularios dinámicos es viable y útil. Pero también reveló los límites del alcance original: los formularios sueltos sobre entidades individuales son una pequeña fracción del valor que un equipo de delivery necesita para entregar soluciones a clientes. Lo que falta no es más formularios — es **procesos**.

## 2.2 El problema que Workflow Platform resuelve

Un equipo de delivery que construye soluciones a la medida para clientes diversos enfrenta tres fricciones recurrentes:

**1. Cada proyecto reinventa la rueda.** Un proceso de aprobación de gastos para un cliente del sector retail tiene el 80% de su lógica idéntica al proceso de aprobación de vacaciones para un cliente del sector salud. Sin embargo, en el modelo tradicional cada proyecto se codea desde cero. No hay capitalización de patrones.

**2. Los cambios son caros.** Cuando un cliente quiere ajustar su proceso — añadir un nivel de aprobación, cambiar una regla de enrutamiento, reordenar pasos — el equipo de delivery debe entrar a código, hacer pull request, pasar QA, desplegar. Lo que el cliente percibe como "un cambio trivial" se traduce en horas-hombre que el cliente no quiere pagar y el equipo no quiere absorber.

**3. La complejidad técnica del BPM tradicional ahuyenta.** Las herramientas establecidas (Camunda, Bizagi, Pega) son potentes pero pesadas: requieren expertos certificados, infraestructura significativa, y curvas de aprendizaje de meses. No son adecuadas para equipos pequeños que necesitan entregar rápido a clientes que no quieren pagar consultoría especializada.

Workflow Platform ataca las tres fricciones simultáneamente: **modelado declarativo de procesos en metadata** (los cambios son configuración, no código), **librería de templates reutilizables** (los patrones se capitalizan entre proyectos), y **simplicidad técnica deliberada** (un equipo de 2 personas puede construir y mantener la plataforma).

## 2.3 Por qué ahora y por qué este enfoque

Hay tres condiciones que hacen este momento adecuado para construir esta plataforma:

- El MVP previo demostró que la capa de metadata + persistencia dinámica funciona. No estamos apostando a un experimento conceptual; estamos extendiendo algo ya validado.
- Existen librerías maduras open source para todas las capas críticas: React Flow para el canvas de procesos, Monaco para edición de scripts, AJV/FluentValidation para JSON Schema, frameworks de UI (shadcn/ui) que dan resultado profesional sin equipo de diseño dedicado.
- El modelo de negocio (uso personal primero, comercial después) reduce la presión inicial de polish: el creador es su propio primer usuario y aprende del uso real antes de exponer la plataforma a clientes pagantes.

---

# 3. Naturaleza del Producto

## 3.1 Qué ES Workflow Platform

Workflow Platform es **tres herramientas integradas en una sola plataforma**, alimentadas por un metamodelo común:

1. **Diseñador de modelo de datos.** Permite definir el esquema de datos de un proyecto: entidades, atributos, relaciones. Soporta dos modos: *greenfield* (creación desde cero, la herramienta genera las tablas físicas) y *brownfield* (ingesta de un esquema existente para integrar bases de datos heredadas del cliente).

2. **Diseñador de formularios.** Permite construir formularios visuales sobre el modelo de datos, con navegación entre relaciones para combinar atributos de múltiples entidades en un mismo formulario, validaciones declarativas y catálogo de componentes UI.

3. **Diseñador de workflows.** Permite construir procesos como grafos de nodos conectados — tareas humanas (que usan formularios), tareas automáticas (scripts), compuertas de decisión, eventos, timers. Cada proceso queda almacenado como metadata ejecutable por el motor.

A esto se suma el **motor de ejecución** (fuera del alcance del MVP de UI) que lee la metadata de un proceso, instancia casos (radicados/tickets), y los avanza paso a paso interactuando con humanos y sistemas externos.

| **Lo que Workflow Platform NO es** No es un BPM 2.0 conforme: no busca compatibilidad con Camunda/Bizagi ni import/export de BPMN XML. No es una herramienta de automatización pura tipo n8n: los procesos son humano-céntricos y persistentes (casos que duran días o semanas), no solo automatizaciones técnicas de minutos. No es un constructor de aplicaciones internas tipo Retool: el foco está en procesos, no en dashboards o admin panels. |
| --- |

## 3.2 Filosofía de diseño

Tres principios rigen las decisiones de producto, de la Visión hasta el código:

**Principio 1 — Metadata como única fuente de verdad.** Todo lo que el sistema sabe sobre un proceso, sus formularios, sus datos, está representado en metadata estructurada. El motor de ejecución no contiene lógica de negocio hardcodeada; ejecuta lo que la metadata describe. Esto es lo que permite que un cambio de proceso sea un cambio de configuración, no un cambio de código.

**Principio 2 — Simplicidad deliberada sobre completitud teórica.** Se prefiere un subset pequeño, bien diseñado y fácil de entender, sobre un superconjunto exhaustivo. Cinco tipos de nodo bien hechos vencen a veinte tipos a medio terminar. La completitud llega vía iteraciones, no vía especificación inicial.

**Principio 3 — Aceleración de delivery por encima de configurabilidad universal.** La plataforma optimiza para el caso de un equipo de delivery construyendo procesos para clientes — no para un usuario de negocio cero-código completamente autónomo. Las decisiones que aumentan la velocidad del equipo técnico tienen prioridad sobre las que aumentan la accesibilidad de usuarios no técnicos.

---

# 4. Usuarios y Modelo de Adopción

## 4.1 Perfiles de usuario

La plataforma tiene tres perfiles diferenciados, cuya importancia relativa cambia con el tiempo:

| **Perfil** | **Uso típico** | **Etapa donde es crítico** |
| --- | --- | --- |
| **Creador / Equipo técnico interno** (tú + dev) | Construye procesos, modela datos, integra con BDs existentes del cliente, configura ambientes. Conoce el funcionamiento profundo de la plataforma. | Hoy y siempre. Es el operador permanente de la plataforma. |
| **Analista funcional / BA del lado del cliente** | Diseña ajustes menores a procesos existentes, configura variantes, valida flujos con stakeholders. No codifica. | Etapa intermedia, cuando la plataforma esté madura. |
| **Usuario final del cliente** | Diligencia formularios, completa tareas asignadas, consulta el estado de sus casos. No diseña nada. | Crítico desde el primer cliente: el usuario final es quien valida si los procesos funcionan en la práctica. |

El **MVP de UI prioriza exclusivamente el primer perfil**. Los demás se atienden cuando la plataforma haya validado su valor con el primero.

## 4.2 Modelo de adopción

La adopción del producto sigue tres olas, no simultáneas:

**Ola 1 — Uso personal del creador (meses 1-6 post-MVP).** El creador usa la plataforma en sus propios proyectos a clientes. Descubre fricciones reales en uso productivo, no en uso de demo. Cada fricción genera un ajuste en el siguiente release.

**Ola 2 — Clientes consumiendo instancia central (meses 6-18).** El creador opera una plataforma multi-tenant central. Los primeros 3-5 clientes acceden a su instancia con auth, ven solo sus proyectos, consumen sus procesos. El creador hace todo el diseño; el cliente solo ejecuta.

**Ola 3 — Modelo híbrido / on-premise (meses 18+).** Clientes maduros o con requisitos de soberanía de datos reciben instalaciones propias (BD copiada, despliegue separado, mismo software). El creador mantiene una versión central para clientes que no necesitan on-premise.

---

# 5. Capacidades del Producto Completo (Visión Final)

Esta sección describe el producto **terminado**, no el MVP. Es el norte hacia el cual cada iteración converge.

## 5.1 Modelo de datos

- Diseño de entidades y atributos desde la UI (modo greenfield).
- Ingesta de esquemas existentes desde PostgreSQL, SQL Server, Oracle, MySQL (modo brownfield).
- Detección automática de relaciones y FKs.
- Generación y migración de DDL en bases de datos del cliente.
- Re-ingesta selectiva con preservación de artefactos derivados (forms, procesos).

## 5.2 Formularios

- Constructor drag & drop sobre entidades del modelo.
- Navegación entre relaciones para combinar atributos de múltiples entidades.
- Catálogo de componentes UI extensible (texto, número, fecha, FK select, archivo, rich-text, geográfico).
- Validaciones declarativas y reglas condicionales (mostrar/ocultar campos, requerir según contexto).
- Sub-formularios y formularios maestro-detalle.
- Formularios independientes (no ligados a workflow) para mantenimiento de datos maestros.

## 5.3 Workflows

- Canvas drag & drop con paleta de tipos de nodo.
- Tipos de nodo: start, end, tarea humana, tarea automática (script), compuerta exclusiva, compuerta inclusiva, compuerta paralela, timer, evento de mensaje, sub-proceso, integración (HTTP).
- Variables de contexto del proceso con tipado.
- Sistema de expresiones para condiciones, mapeos y referencias entre nodos.
- Asignación de tareas humanas a roles, usuarios específicos, o reglas dinámicas.
- Vista de instancias en ejecución con highlight del nodo activo.
- Re-ejecución y rollback de instancias.

## 5.4 Motor de ejecución

- Persistencia de instancias con state machine durable.
- Reanudación tras caídas (workflow no se pierde si el servidor reinicia).
- Notificaciones por email/in-app cuando se asigna una tarea.
- API REST y webhooks para integración con sistemas externos.
- Logs y trazabilidad por instancia.

## 5.5 Templates y librería reutilizable

- Export e import de procesos completos como templates.
- Templates parametrizables: el mismo template (ej. "aprobación en 2 niveles") instanciado con parámetros distintos por cliente.
- Librería personal del creador, separada de los proyectos de clientes.
- Versionado de templates.

## 5.6 Multi-tenancy y administración

- Operación multi-tenant donde cada proyecto vive en una BD PostgreSQL dedicada.
- BD operativa central que cataloga clientes, proyectos, usuarios, y conexiones.
- Migraciones de esquema coordinadas sobre N proyectos.
- Backup y exportación por proyecto.
- Permisos por proyecto y por rol dentro del proyecto.

## 5.7 Auth y seguridad

- Login con email/contraseña y sesión persistente.
- Roles y permisos a nivel de proyecto.
- Auditoría de operaciones críticas.
- En etapas futuras: SSO, MFA, granularidad de permisos por proceso.

---

# 6. Alcance del MVP de UI

El MVP de UI es la primera iteración tangible: una plataforma **diseñable pero no ejecutable**. El usuario puede construir procesos completos, formularios enriquecidos y modelos de datos; el sistema persiste todo correctamente; lo único que no funciona es que un proceso construido pueda *correr en producción*. La ejecución real se difiere al MVP del motor (siguiente iteración).

## 6.1 Módulos incluidos

| **Módulo** | **Descripción** | **Capacidad post-MVP** |
| --- | --- | --- |
| **Auth mínima** | Login email/password, sesión, registro restringido a invitación. Asp.NET Core Identity como base. | Permite que la plataforma sea mostrable a clientes con un mínimo de defensibilidad. Cimiento para multi-tenancy. |
| **Diseñador de Workflows** | Canvas drag & drop con React Flow. Paleta inicial de 4 tipos de nodo: start, end, tarea humana, compuerta exclusiva. Persistencia como artefactos de metadata. | Es el módulo *diferenciador* del producto. Se construye primero después de auth. |
| **Diseñador de Entities greenfield** | UI para crear entidades, atributos, relaciones desde cero. Generación de DDL contra una BD vacía del proyecto. | Soporta el modo "proyecto nuevo desde la herramienta", complementando el modo brownfield que el MVP previo validó. |
| **Diseñador de Forms enriquecido** | Constructor de formularios con navegación entre relaciones, propiedades extendidas de FormField, vista previa. | Resuelve la principal limitación del MVP previo (un formulario = una entidad base). |
| **Vista de ejecución simulada (dry-run)** | Simulador que recorre el grafo del proceso paso a paso, pidiendo inputs como lo haría el motor real. No persiste casos reales. | Permite validar diseños end-to-end sin tener el motor construido. Crítico para los criterios de éxito. |
| **Templates / librería v1** | Export e import de procesos como JSON. Librería simple del creador (no compartida entre tenants en el MVP). | Primera versión: solo export/import manual. Parametrización completa llega después. |

## 6.2 Módulos explícitamente diferidos

- **Motor de ejecución real.** Es la siguiente iteración, no este MVP. Sin él, los procesos diseñados se simulan pero no corren en producción.
- **Ingesta brownfield.** El MVP previo ya validó el concepto. Su integración con la nueva plataforma se hace en una iteración separada para no contaminar el alcance del MVP de UI.
- **Tipos de nodo avanzados:** timer, evento de mensaje, compuerta paralela, integración HTTP, sub-procesos. Se reservan para iteraciones posteriores.
- **Roles y permisos granulares.** Auth es solo "estás dentro o no estás". Permisos por proyecto/proceso son posteriores.
- **Notificaciones, emails, integraciones externas.** Pertenecen al motor.
- **UI para usuario final ejecutor.** El MVP de UI es para el creador. La UI de "completar mi tarea pendiente" llega cuando exista el motor.

## 6.3 Orden de construcción

```
Fase 1 (semanas 1-3):    Auth + esqueleto multi-tenant
Fase 2 (semanas 4-9):    Diseñador de Workflows (canvas + 4 nodos)
Fase 3 (semanas 10-13):  Diseñador de Entities greenfield
Fase 4 (semanas 14-17):  Diseñador de Forms enriquecido
Fase 5 (semanas 18-20):  Vista de ejecución simulada (dry-run)
Fase 6 (semanas 21-22):  Templates v1 + hardening + demo
```

Estimación total: **22 semanas (~5.5 meses)** con equipo de 2 personas. Bandas: 4 meses (optimista, ejecución limpia) a 6 meses (realista con imprevistos).

| **Por qué Workflows antes que Entities/Forms** El orden tradicional sería "datos → formularios → procesos". Aquí se invierte deliberadamente porque (a) Workflows es el módulo diferenciador y debe construirse antes de que el equipo agote presupuesto en módulos secundarios; (b) construir Workflows primero fuerza decisiones difíciles del metamodelo de procesos al inicio, cuando hay margen para corregir; (c) Entities y Forms son alimentadores del Workflow, no entidades autónomas — construirlos antes implicaría diseñarlos sin saber qué necesita el Workflow. La consecuencia: el MVP del Workflow se construye contra entidades y formularios *mock* en sus primeras semanas, lo cual es aceptable porque la API entre módulos queda definida desde el inicio. |
| --- |

---

# 7. Modelo de Multi-Tenancy y Entrega

## 7.1 Arquitectura de multi-tenancy

La plataforma adopta **multi-tenancy a nivel de base de datos**: cada proyecto vive en una base de datos PostgreSQL dedicada dentro del mismo servidor. La arquitectura lógica es:

```
Servidor PostgreSQL (operado por el creador)
  ├── BD: workflow_platform_admin        ← BD operativa central
  │     ↳ Catálogo de clientes, proyectos, usuarios, conexiones,
  │       templates de la librería personal del creador
  │
  ├── BD: cliente_A_proyecto_1           ← un proyecto del cliente A
  │     ↳ METADATA + tablas de instancias + tablas de negocio
  │
  ├── BD: cliente_A_proyecto_2           ← otro proyecto del cliente A
  │     ↳ totalmente independiente del proyecto 1
  │
  └── BD: cliente_B_proyecto_1           ← proyecto del cliente B
        ↳ totalmente independiente
```

## 7.2 Modelo conceptual

- Un **cliente** es una empresa contratante. Puede tener N **proyectos**.
- Un **proyecto** es una BD completa. Es la unidad de aislamiento, backup, migración y entrega.
- Dentro de un proyecto se definen N **procesos**, M **entidades**, K **formularios** — todos compartiendo la BD del proyecto y la metadata raíz (rootProject).
- Un proyecto pertenece a exactamente un cliente. Si un cliente quiere "lo mismo" en dos proyectos, debe duplicar (o instanciar el mismo template) en cada uno.

## 7.3 Beneficios y costos

**Beneficios:**

- Aislamiento físico absoluto. Cero riesgo de fuga de datos entre clientes por bug de query.
- Backups y restores granulares por proyecto.
- Modelo híbrido on-premise sale gratuito: para entregar la BD a un cliente, se copia su BD a su servidor y se actualiza la conexión.
- Permisos de PostgreSQL mapeables directamente a roles de aplicación.
- Métricas y límites de recursos por proyecto vía mecanismos nativos de PostgreSQL.

**Costos:**

- Operación de migraciones de esquema sobre N bases de datos cuando el metamodelo evoluciona. Esto requiere herramental específico desde el inicio.
- Pool de conexiones por proyecto activo. Manejable, pero más complejo que un único pool global.
- Reportes cross-tenant son técnicamente costosos (iterar N bases). En el modelo de negocio del producto esto rara vez será necesario.

## 7.4 Modelo de entrega al cliente

Tres modalidades soportadas según madurez de la plataforma:

| **Modalidad** | **Cuándo aplica** | **Descripción** |
| --- | --- | --- |
| **Servicio gestionado** | Etapa primaria | El cliente accede a la instancia central operada por el creador. Login, ve sus proyectos, ejecuta sus procesos. El creador opera infra. |
| **On-premise / instalación dedicada** | Cuando el cliente lo requiera (sectores regulados, sensibilidad de datos) | Se copia la BD del proyecto al servidor del cliente, se despliega la misma aplicación, se transfiere la operación. |
| **Híbrido** | Casos puntuales | Algunos procesos del cliente corren en la instancia central, otros en su propia infraestructura. Coordinación vía API. |

---

# 8. Stack Tecnológico

Stack elegido por velocidad de desarrollo, madurez de las librerías clave, y compatibilidad con el modelo de multi-tenancy descrito:

| **Capa** | **Tecnología** | **Justificación** |
| --- | --- | --- |
| Base de datos | PostgreSQL 16+ | JSONB nativo con índices GIN, ideal para el metamodelo. Soporte robusto de bases de datos múltiples en un mismo servidor para multi-tenancy. |
| Backend | .NET 8 + ASP.NET Core | Cambio de stack respecto al MVP previo (que usaba Node.js). Decisión fundamentada en preferencia técnica del equipo, ecosistema maduro de validación (FluentValidation), Identity (auth), y EF Core / Npgsql para PostgreSQL. |
| ORM / acceso a datos | EF Core para metadata + Dapper o Npgsql crudo para introspección y SQL dinámico | EF Core para artefactos donde las queries son predecibles. Dapper/Npgsql donde necesitamos control total (introspección, generación de DDL dinámico, ejecución de SQL sobre tablas de negocio). |
| Validación de schemas | FluentValidation + JsonSchema.Net | Validación de Content de cada artefacto contra JSON Schemas derivados del metamodelo. |
| Frontend | React 18 + TypeScript + Vite | Misma decisión del MVP previo, vigente. SPA única para todos los diseñadores. |
| Canvas de workflows | React Flow | Estándar de facto para canvas de nodos en React. Open source MIT. Usado por productos de referencia (n8n se basa en algo similar). |
| Editor de código (script tasks) | Monaco Editor | Mismo editor que VS Code. MIT, sin licencias. |
| Drag & drop (forms) | dnd-kit | Reutilizado del MVP previo. |
| UI components | shadcn/ui + Tailwind CSS | Componentes accesibles, customizables, sin lock-in. Reutilizado del MVP previo. |
| Estado frontend | Zustand + TanStack Query | Manejo simple de estado UI + cache y sincronización con backend. |
| Testing | xUnit (backend), Vitest (frontend), Playwright (e2e) | Stack estándar de la industria por capa. |
| Infraestructura | Docker + Docker Compose | Empaquetado reproducible. Compatible con deploy en cualquier servidor Linux. |
| Diseño (mockups) | Figma tier gratuito | Suficiente para el alcance del MVP. Sin necesidad de plan pago. |

| **Restricción de presupuesto** El equipo opera bajo restricción de herramientas comerciales. Todas las decisiones de stack priorizan alternativas open source o tiers gratuitos. Hasta donde se ha auditado, **el MVP completo se puede construir sin pagar licencias de software**. Si en alguna fase se descubre una necesidad de herramienta paga, se evalúa explícitamente. |
| --- |

---

# 9. Criterios de Éxito

El MVP de UI se considera exitoso si, al final de las ~22 semanas estimadas, cumple **ambos** criterios siguientes:

**Criterio 1 — Demo end-to-end del proceso de vacaciones (o equivalente).** El equipo debe ser capaz de:

- Diseñar el modelo de datos del proceso (empleados, solicitudes, días disponibles) en la herramienta.
- Construir los formularios de captura (solicitud, aprobación del jefe, aprobación de RRHH).
- Diseñar el workflow con sus 4-5 nodos (start, captura, decisión del jefe, decisión de RRHH, end).
- Ejecutar el dry-run del workflow completo, completando manualmente cada tarea humana, y verificar que el simulador llega correctamente al fin para los caminos "aprobado" y "rechazado".
- Hacer todo lo anterior sin escribir código.

**Criterio 2 — Velocidad de diseño.** Un miembro del equipo familiarizado con la herramienta debe ser capaz de diseñar un proceso nuevo de 3-5 pasos (data + forms + workflow) en menos de 1 hora desde cero. Este criterio es la prueba real de usabilidad — no de cuántas features tiene la herramienta, sino de qué tan rápido se llega del cero al proceso funcional.

Métricas cuantitativas más finas (números de carga, tiempos de respuesta, cobertura de tests) se difieren al SRS de cada capa. La Visión queda en criterios cualitativos verificables.

---

# 10. Riesgos y Mitigaciones

Los riesgos identificados como **alto impacto** son tres. Cada uno tiene mitigación explícita.

| **Riesgo** | **Impacto** | **Mitigación** |
| --- | --- | --- |
| **R1 — El canvas de workflows (React Flow) consume más tiempo del esperado.** El canvas es famosamente un sumidero de tiempo: customizar paneles, validaciones visuales, snap, alineación, multi-select, undo/redo, paneles de propiedades por tipo de nodo. La estimación de 6 semanas para Fase 2 puede romperse fácilmente. | Alto | **Timebox estricto.** Si al final de la semana 9 el canvas no está funcional con los 4 tipos de nodo básicos, se evalúa recorte de scope visual (sin undo/redo, sin multi-select) antes de continuar a Fase 3. **Spike previo:** dedicar 2-3 días en Fase 1 para hacer un prototipo desechable de React Flow que valide las customizaciones críticas. |
| **R2 — El metamodelo de procesos se queda corto al chocar con el primer proceso complejo.** El metamodelo se diseña sobre papel; al confrontarlo con un proceso real (ej. el de vacaciones con sus particularidades) puede revelar que faltan artefactos o que las firmas JSON son insuficientes. El costo de rehacer el metamodelo cuando ya hay código consumiéndolo es alto. | Alto | **Validación con 2-3 procesos diversos antes de escribir SRS de metamodelo.** Diseñar en papel: vacaciones, aprobación de gastos, onboarding de empleado. Si los tres se modelan sin fricciones, el metamodelo es probablemente correcto. **Versionado explícito del metamodelo:** asumir que va a evolucionar (v2.0, v2.1...) y dejar mecanismos de migración en el código desde el inicio. |
| **R3 — Scope creep.** Aparecen features que parecían menores pero crecen: notificaciones, integraciones, permisos granulares, polish visual de cada módulo. Los 6 módulos del MVP se vuelven 9 y el timeline se rompe. | Alto | **Lista cerrada y revisada quincenalmente.** Cualquier feature no listada en §6.1 entra a un backlog separado y se evalúa para iteración siguiente, no para el MVP. **Definición clara de "terminado" por módulo:** cada Fase tiene un checklist de aceptación explícito en su SRS, y se cierra cuando los puntos están marcados, sin perfeccionismo adicional. |

Riesgos **medios** identificados (sin mitigación detallada en la Visión; se elaboran en SRS):

- Cambio de stack a .NET introduce fricción más allá de lo estimado.
- Coordinación con segundo dev consume más tiempo del esperado.
- Falta de claridad de la siguiente jugada (motor real) hace que algunas decisiones de UI envejezcan.

---

# 11. Supuestos Críticos

La Visión asume explícitamente lo siguiente. Si alguno de estos supuestos se rompe, debe re-evaluarse la planificación.

**S1 — El motor de ejecución llegará.** El MVP de UI no es un fin en sí mismo. Tiene sentido solo si la siguiente iteración construye el motor que ejecuta los procesos diseñados. Si el motor no se construye, el MVP queda como demo sin producto.

**S2 — La decisión de .NET es definitiva.** El cambio de stack respecto al MVP previo (Node.js) no es un experimento. La inversión de aprendizaje, librerías elegidas, y patrones idiomáticos se asume como permanente. Reversión a otro stack tendría costos elevados.

**S3 — Multi-tenancy por base de datos es manejable operativamente cuando haya 5-10 clientes.** El modelo elegido tiene costo de migración coordinada de esquemas que crece con N proyectos. La Visión asume que con herramental adecuado (scripts, automatización) esto sigue siendo viable para un equipo de 2-3 personas hasta al menos 10 proyectos activos. Si el modelo de negocio crece más rápido que la capacidad operativa, hay que revisar la arquitectura de tenancy.

---

# 12. Fuera de Alcance del MVP de UI

Los siguientes elementos están explícitamente fuera del alcance. Aparecen aquí no porque no sean importantes, sino porque su exclusión es deliberada y debe entenderse para no abrirse "por descuido".

- **Motor de ejecución real con state machine durable.** Es la siguiente iteración.
- **Ingesta de bases de datos existentes (modo brownfield).** Validado en MVP previo; integración con la nueva plataforma queda para iteración posterior.
- **Notificaciones por email, push, in-app.** Pertenecen al motor de ejecución.
- **Integraciones HTTP, webhooks, conectores con sistemas externos.** Pertenecen al motor.
- **Tipos de nodo avanzados:** timer, evento de mensaje, compuerta paralela, compuerta inclusiva, sub-procesos.
- **Roles y permisos granulares por proyecto/proceso/recurso.** Auth en MVP es binaria.
- **UI para usuario final ejecutor de tareas.** Sin motor no hay tareas que asignar.
- **Versionado de procesos en producción.** Cuando el motor exista, los procesos en producción necesitarán versionado para soportar instancias antiguas conviviendo con definiciones nuevas. Diferido.
- **Internacionalización completa.** El MVP es español-only.
- **Reportería, dashboards, BI sobre instancias.**
- **Auditoría exhaustiva y trazabilidad de cambios.**
- **Encriptación en reposo de credenciales y datos sensibles.**
- **SSO, MFA, OAuth con proveedores externos.**

---

# 13. Próxima Jugada (Post-MVP de UI)

Una vez completado el MVP de UI, la siguiente iteración se enfoca simultáneamente en dos frentes:

**Frente A — Uso real del MVP por el creador.** El creador empieza a usar la plataforma en sus propios proyectos de delivery, aunque sin motor real. Aprovecha el diseñador para acelerar la fase de análisis con clientes: el cliente *ve* su proceso diseñado mucho antes de que esté ejecutable, lo cual mejora la calidad del feedback temprano.

**Frente B — Construcción del motor de ejecución.** Sobre los cimientos arquitectónicos del MVP, se construye el motor que toma los procesos diseñados y los ejecuta de verdad: persistencia de instancias, asignación de tareas, notificaciones, integraciones básicas. Estimación preliminar para el MVP del motor: 4-6 meses adicionales.

Cuando ambos frentes converjan, la plataforma estará lista para vender un primer proyecto a un cliente real con ejecución productiva, no demo.

---

# 14. Glosario y Conceptos Clave

| **Término** | **Definición** |
| --- | --- |
| Workflow Platform | Nombre de trabajo de la plataforma. Sujeto a cambio cuando se defina marca comercial. |
| Cliente | Empresa o persona contratante de un proyecto. Puede tener N proyectos. |
| Proyecto | Unidad de aislamiento: una BD PostgreSQL dedicada. Contiene la metadata y los datos de un dominio de negocio específico de un cliente. |
| Proceso | Definición de un workflow ejecutable: un grafo de nodos conectados, con variables de contexto y lógica de transiciones. Reside como artefacto de metadata dentro de un proyecto. |
| Caso / Instancia | Una ejecución concreta de un proceso. La "solicitud de vacaciones de Juan Pérez" es una instancia del proceso "vacaciones". |
| Nodo | Cada paso del workflow: tarea humana (form), tarea automática (script), compuerta de decisión, start, end. |
| Tarea humana | Nodo del workflow que pausa la ejecución esperando que un humano complete un formulario. |
| Variable de contexto | Dato que viaja con una instancia del proceso a lo largo de su ejecución. Almacena valores intermedios y permite que los nodos se comuniquen entre sí. |
| Entidad | Representación de una tabla del modelo de datos del proyecto. Hereda del Framework Conceptual del MVP previo. |
| Atributo | Representación de una columna de una entidad. Hereda del Framework Conceptual del MVP previo. |
| FormDefinition | Definición de un formulario asociado a una entidad. Hereda del Framework Conceptual del MVP previo, extendida con navegación entre relaciones. |
| Template | Proceso, formulario o conjunto reutilizable exportable, que puede instanciarse en otros proyectos con o sin parámetros. |
| Tenant | Unidad de aislamiento de la plataforma. En este modelo, un tenant equivale a un proyecto (una BD). |
| Dry-run | Modo de simulación del MVP de UI que permite recorrer un workflow paso a paso sin motor real, para validar el diseño. |
| Greenfield | Modo en que el modelo de datos se crea desde cero en la herramienta. |
| Brownfield | Modo en que el modelo de datos se ingiere desde una BD existente. Validado en MVP previo; integración con la nueva plataforma diferida. |
| Metadata | Conjunto de artefactos estructurados que describen el modelo de datos, los formularios y los procesos del proyecto. Es la única fuente de verdad del sistema. |

---

# 15. Historial de Versiones

| **Versión** | **Fecha** | **Descripción** |
| --- | --- | --- |
| 1.0 | Mayo 2026 | Versión inicial del documento de Visión de Workflow Platform. Establece el norte estratégico del producto, define el alcance del MVP de UI (6 módulos en ~22 semanas), formaliza el modelo de multi-tenancy por base de datos, y articula los criterios de éxito, riesgos y supuestos. Deriva conceptualmente del MVP previo (Metadata Framework Tool, v1.0-v1.6) que validó la viabilidad técnica del enfoque metadata + formularios dinámicos. |

*— Fin del documento —*

Confidencial · Mayo 2026 · Workflow Platform · Documento de Visión v1.0
