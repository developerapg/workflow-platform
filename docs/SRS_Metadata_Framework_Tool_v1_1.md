**ESPECIFICACIÓN DE REQUERIMIENTOS DE SOFTWARE**

**Metadata Framework Tool**

*Ingesta · Diseño · Ejecución sobre bases de datos relacionales*

17 de mayo de 2026  ·  v1.6  ·  Estado: Borrador

**Changelog v1.6 — Fase 10 (hardening + e2e):** se documenta el cierre operativo del MVP. Añadido README operativo en raíz con setup, variables (`PORT`, `SQLITE_PATH`, `CONNECTION_SECRET_KEY`, `VITE_API_BASE_URL`), comandos por proyecto y flujo end-to-end. Animaciones del design guide implementadas globalmente (modal fade+scale 150ms, panel collapse 200ms, hover 80ms) con `prefers-reduced-motion` honrado. Accesibilidad: `:focus-visible` con anillo accent y `aria-label` en botones de solo-icono. Re-ingesta wipe & reload (FR-SI-14) operativa desde Fase 4 con preservación de FormDefinitions. Suite e2e Playwright + seed SQL (`backend/tests/fixtures/seed.sql`) cubriendo el happy path: conectar → ingestar → diseñar form CRUD → CRUD completo sobre tabla física.

Autor: BA/QA Agent

*Confidencial — Documento interno*

# 1. Introducción

## 1.1 Propósito

Este documento especifica los requerimientos funcionales y no funcionales de la Metadata Framework Tool: una herramienta interna que materializa operativamente el framework de metadata definido en el Documento de Concepto y Diseño v1.1, mediante un flujo end-to-end de tres pasos — ingesta del esquema, diseño de formularios y ejecución CRUD — sobre bases de datos relacionales del negocio. Está dirigido al equipo técnico responsable de su construcción (backend, frontend, arquitectura, QA, DBA).

| **Modelo de gobernanza documental (v1.1)** Este SRS NO redefine artefactos de metadata. La definición canónica de rootProject, Entity, Attribute, FormDefinition y FormField — incluyendo sus firmas JSON, catálogos y reglas de validación cruzada — reside exclusivamente en el Framework Conceptual v1.1. Este documento es dueño únicamente de los requerimientos funcionales, historias de usuario, criterios de aceptación, contratos de API y requerimientos no funcionales que operan sobre dichos artefactos. |
| --- |

## 1.2 Alcance

**Incluido en el MVP (8 semanas):**

- Módulo 1 — Schema Ingestion sobre PostgreSQL: introspección, mapeo de tipos, detección de PKs/FKs/constraints, generación de artefactos rootProject/Entity/Attribute en la tabla METADATA.

- Módulo 2 — Form Designer: editor drag & drop con catálogo UI hardcodeado, asociación automática componente ↔ dataType, persistencia de FormDefinition y FormField como artefactos de metadata.

- Módulo 3 — Form Runtime: renderizado dinámico, ejecución CRUD single-row contra la tabla física original, validaciones cliente y servidor, listado paginado con búsqueda configurable.

- Arquitectura agnóstica de motor SQL vía interfaz DatabaseAdapter (solo implementación PostgreSQL en el MVP).

**Excluido del MVP (ver §7 Fuera de alcance):**

- Soporte de Oracle, SQL Server, MySQL.

- Autenticación, autorización y control de acceso.

- Formularios maestro-detalle (multi-entidad).

- Artefactos Rule y Event, versionado de metadata, exportación/importación de proyectos.

## 1.3 Documentos de referencia

Este SRS se construye sobre los siguientes documentos. Cuando un concepto no se define en este documento, debe consultarse el documento referenciado:

| **Documento** | **Versión** | **Propiedad sobre** |
| --- | --- | --- |
| Metadata Framework — Concepto y Diseño | 1.1 | Metamodelo completo: tabla METADATA, catálogo ObjectType, firmas JSON de los 5 artefactos, jerarquía, navegación, reglas de validación cruzada. |
| Metadata Framework Tool — Project Vision | 2.0 | Visión de negocio, usuarios objetivo, alcance estratégico del MVP, stack tecnológico, plan de entrega, riesgos. |
| SRS — Metadata Framework Tool (este documento) | 1.1 | Requerimientos funcionales (FR-XX), historias de usuario, criterios de aceptación, contratos de API REST, requerimientos no funcionales (NFR). |

## 1.4 Asunciones y temas abiertos

- La herramienta es single-tenant: una instancia por equipo, capaz de gestionar N rootProjects históricos en la misma instancia.

- Una sola conexión activa por sesión a una BD de negocio; el usuario puede cambiarla y los rootProjects previos permanecen en METADATA.

- Las definiciones de proyectos y cadenas de conexión se almacenan en texto plano en un archivo de configuración del filesystem del servidor; su ruta se inyecta vía variable de entorno (MVP en entorno controlado).

- Re-ingesta selectiva de un rootProject existente (v2): el usuario elige qué tablas re-ingestar. Solo las Entities cuya tabla física aparece en la selección se borran y recrean; las demás permanecen intactas con sus Attributes, Relations y FormDefinitions. Si el esquema físico cambia y elimina/modifica Attributes referenciados por FormFields, esos campos se marcan inválidos y se reportan. Las relaciones de Entities preservadas hacia Entities re-ingestadas se re-mapean automáticamente a los nuevos UUIDs.

- Catálogo de componentes UI hardcodeado en frontend para el MVP, encapsulado en un ComponentRegistry con interfaz preparada para extensión futura vía metadata.

- Por Entity se generan dos formularios: uno CRUD (Create/Edit/Delete sobre un registro por PK) y uno List/Search.

- Logging de operaciones CRUD a stdout o archivo durante el ciclo de vida del request; no se persiste en tabla de auditoría en el MVP.

- Búsqueda en List/Search: por campo, configurable entre exact, contains y semantic (semantic queda fuera del alcance funcional del MVP; solo el contrato y la opción en UI se incluyen).

- Tablas sin Primary Key no se exponen como Entity: se omiten en la ingesta y se reportan como advertencia.

- Tipos PostgreSQL no mapeados al catálogo de dataType (tsvector, point, arrays, tipos custom) se omiten a nivel de Attribute y se reportan en el reporte de ingesta.

- La tabla METADATA reside en la MISMA base de datos PostgreSQL del negocio (instancia única); en iteraciones futuras puede separarse en una BD dedicada.

- Tema abierto: criterio definitivo para resolución de conflictos cuando una re-ingesta detecta que un Attribute usado por un FormField fue eliminado o cambió de tipo.

# 2. Requerimientos Funcionales (FR)

Cada requerimiento usa "debe" para indicar obligatoriedad. Los identificadores se agrupan por módulo: SI (Schema Ingestion), FD (Form Designer), RT (Runtime), MM (Metamodelo), TR (Transversales).

| **REFERENCIA NORMATIVA** Las firmas JSON, catálogos y reglas de validación cruzada que los siguientes requerimientos invocan se definen en el Framework Conceptual v1.1, §4 (tabla METADATA y catálogo ObjectType), §5 (firmas JSON de los 5 artefactos) y §6 (jerarquía y navegación). |
| --- |

## 2.1 Módulo 1 — Schema Ingestion (SI)

**FR-SI-01 ****[Conexión] **El sistema debe permitir definir conexiones a bases de datos PostgreSQL especificando host, puerto, base de datos, schema, usuario y contraseña, persistiéndolas en el archivo de configuración de proyectos referenciado por la variable de entorno METADATA_PROJECTS_CONFIG_PATH.

**FR-SI-02 ****[Conexión] **El sistema debe validar la conexión a la BD del negocio antes de ejecutar la introspección, verificando credenciales y permisos mínimos de lectura sobre information_schema, pg_catalog y los schemas seleccionados.

**FR-SI-03 ****[Conexión] **El sistema debe permitir que solo una conexión esté activa por sesión, pero conservar N rootProjects históricos asociados a conexiones previas en la tabla METADATA.

**FR-SI-04 ****[Descubrimiento] **El sistema debe descubrir automáticamente todas las tablas del schema seleccionado consultando information_schema.tables y pg_catalog, excluyendo por defecto los schemas pg_catalog, information_schema, pg_toast y pg_temp_*.

**FR-SI-05 ****[Descubrimiento] **El sistema debe presentar al usuario una UI de previsualización con la lista de tablas descubiertas, permitiendo selección granular (incluir/excluir) antes de ejecutar la ingesta definitiva.

**FR-SI-06 ****[Mapeo] **El sistema debe mapear cada tipo de dato PostgreSQL al catálogo dataType del Framework Conceptual v1.1 §5.3.1 según la siguiente tabla mínima: varchar/text/char → string, int2/int4/int8/serial → integer, numeric/decimal/float4/float8 → decimal, bool → boolean, date → date, timestamp/timestamptz → datetime, uuid → uuid, json/jsonb → json.

**FR-SI-07 ****[Mapeo] **El sistema debe omitir columnas cuyo tipo PostgreSQL no esté en el catálogo de mapeo (tsvector, point, arrays, tipos custom, etc.) y registrar una advertencia en el reporte de ingesta indicando tabla, columna y tipo no soportado.

**FR-SI-08 ****[Mapeo] **El sistema debe rechazar la generación de Entity para tablas que no tengan Primary Key declarada, registrando una advertencia en el reporte de ingesta.

**FR-SI-09 ****[Constraints] **El sistema debe detectar y traducir las constraints NOT NULL → required:true, UNIQUE → unique:true, PRIMARY KEY → metadata.isPrimaryKey:true, FOREIGN KEY → metadata.isForeignKey:true, conforme a la firma de Attribute definida en el Framework Conceptual v1.1 §5.3.

**FR-SI-10 ****[Relaciones] **El sistema debe inferir relaciones entre entidades a partir de las FOREIGN KEYs detectadas y generar el objeto Relation correspondiente dentro del Content de la Entity origen, conforme a la estructura definida en el Framework Conceptual v1.1 §5.2, con cardinalidad 1:N por defecto (1:1 si la FK es UNIQUE).

**FR-SI-11 ****[Persistencia] **El sistema debe persistir los artefactos generados (rootProject, Entities, Attributes) en la tabla METADATA respetando las firmas JSON definidas en el Framework Conceptual v1.1 §5.1, §5.2 y §5.3, validando cada Content contra su JSON Schema mediante AJV antes de insertar.

**FR-SI-12 ****[Persistencia] **El sistema debe asignar a cada artefacto un IdObject UUID v4 generado en tiempo de creación y establecer correctamente la columna parent según la jerarquía rootProject ← Entity ← Attribute definida en el Framework Conceptual v1.1 §6.1.

**FR-SI-13 ****[Reporte] **El sistema debe generar y mostrar al usuario, al finalizar la ingesta, un reporte con: número de entidades creadas, número de atributos creados, número de relaciones detectadas, lista de tablas omitidas por falta de PK, y lista de columnas omitidas por tipo no soportado.

**FR-SI-14 (v2) ****[Re-ingesta selectiva] **El sistema debe permitir re-ingestar un subconjunto de tablas de un rootProject existente. El wipe & reload se aplica **solo** a las Entities cuya tabla física aparece en `selectedTables` (o a todas si `selectedTables === null`). Las Entities no incluidas en la selección se preservan junto con sus Attributes, Relations y FormDefinitions. El bloqueo por formularios pre-existentes opera **solo sobre las Entities a re-ingestar**: si alguna de ellas tiene FormDefinitions, el sistema rechaza la operación con 409 e indica al cliente qué entidades y cuántos forms eliminar.

**FR-SI-15 (v2) ****[Coherencia de relaciones cruzadas] **Tras una re-ingesta selectiva, el sistema debe actualizar las `Content.relations[]` de las Entities preservadas para apuntar a los nuevos UUIDs de las Entities re-ingestadas (`relatedEntity` y, si aplica, `relatedAttribute`). Las relaciones cuyo destino ya no existe (huérfanas) se eliminan con warning en el log. Cuando una re-ingesta elimine o modifique el dataType de un Attribute referenciado por un FormField existente, el sistema debe marcar dicho FormField como inválido (flag `invalid:true` en su Content, conforme al Framework Conceptual v1.1 §5.5) y listarlo en el reporte para revisión manual.

**FR-SI-16 ****[Estado] **Al abrir el módulo de Schema Ingestion para una conexión que ya tiene un rootProject persistido en METADATA, el sistema debe reconstruir la vista mostrando las Entities ya ingestadas (nombre, tabla física, número de atributos, número de relaciones) sin requerir que el usuario re-ejecute la introspección. La detección se realiza leyendo METADATA en la BD del usuario filtrando por ObjectType=1 y un ObjectName canónico que identifique unívocamente la conexión (convención `&lt;database&gt;__&lt;schema&gt;`). Esta operación es de solo lectura y no escribe artefactos.

## 2.2 Módulo 2 — Form Designer (FD)

| **REFERENCIA NORMATIVA** Las firmas JSON de FormDefinition y FormField que los requerimientos de esta sección invocan se definen en el Framework Conceptual v1.1, §5.4 (FormDefinition, ObjectType 10) y §5.5 (FormField, ObjectType 11). Las reglas de validación cruzada entre ambos artefactos están en §5.5 del mismo documento. |
| --- |

**FR-FD-01 ****[Selección] **El sistema debe permitir seleccionar una Entity del rootProject activo como base para la construcción de un formulario.

**FR-FD-02 ****[Formularios] **El sistema debe soportar dos tipos de formulario por Entity, conforme a los modos definidos en el Framework Conceptual v1.1 §5.4: (a) formulario CRUD que opera Create/Edit/Delete sobre un registro identificado por PK; (b) formulario List/Search para listado paginado con búsqueda.

**FR-FD-03 ****[Catálogo] **El sistema debe ofrecer un catálogo hardcodeado de componentes UI compuesto al menos por: TextInput, NumberInput, DatePicker, DateTimePicker, Checkbox, Select, Textarea. El catálogo debe estar encapsulado en una clase ComponentRegistry que exponga una interfaz de registro extensible para iteraciones futuras.

**FR-FD-04 ****[Asociación] **El sistema debe asociar automáticamente un componente UI por defecto según el dataType del Attribute referenciado: string → TextInput, integer/decimal → NumberInput, date → DatePicker, datetime → DateTimePicker, boolean → Checkbox, uuid con isForeignKey:true → Select poblado desde la entidad relacionada, uuid sin FK → TextInput readonly, json → Textarea.

**FR-FD-05 ****[Drag ****&**** Drop] **El sistema debe permitir al diseñador arrastrar Attributes de la Entity al lienzo del formulario y reordenarlos verticalmente mediante drag & drop con dnd-kit, actualizando el campo order de los FormField correspondientes.

**FR-FD-06 ****[Propiedades] **El sistema debe permitir editar por cada FormField del formulario los campos definidos en el Framework Conceptual v1.1 §5.5: label, placeholder, helpText, required (override del Attribute), readonly, hidden, defaultValue y validations compatibles con el dataType.

**FR-FD-07 ****[Búsqueda] **Para formularios List/Search, el sistema debe permitir configurar por cada FormField el modo de búsqueda entre: exact, contains, semantic, persistiéndolo en el campo search.mode definido en el Framework Conceptual v1.1 §5.5. El modo semantic queda reservado para iteraciones futuras y se persiste pero no se ejecuta en el MVP.

**FR-FD-08 ****[Paginación] **Para formularios List/Search, el sistema debe permitir configurar el tamaño de página en el campo pagination.pageSize del FormDefinition con valor por defecto 25 y rango permitido entre 10 y 200.

**FR-FD-09 ****[Preview] **El sistema debe ofrecer una vista previa del formulario antes de su persistencia, con renderizado fiel al runtime y sin ejecutar operaciones contra la BD del negocio.

**FR-FD-10 ****[Persistencia] **El sistema debe persistir cada formulario como un artefacto de tipo FormDefinition (ObjectType 10) en la tabla METADATA, con parent apuntando a la Entity asociada, y cada FormField como artefacto de tipo FormField (ObjectType 11) con parent apuntando al FormDefinition. Ambos Content deben validar contra los JSON Schemas derivados del Framework Conceptual v1.1 §5.4 y §5.5.

> **Nota de implementación MVP (Fase 7, v1.3):** la implementación inicial persiste los campos del formulario **inline** dentro de `FormDefinition.Content.fields[]` (ObjectType=10), no como artefactos FormField separados (ObjectType=11). El catálogo `OBJECT_TYPE.FormField = 11` queda reservado y se introducirá cuando se requiera operar campos individualmente (reordenamiento atómico, permisos por campo, etc.). La firma inline cubre `{attributeId, label?, placeholder?, helpText?, required?, validations?, xPath?}` y se valida con AJV server-side antes de INSERT/UPDATE. Soporte múltiples FormDefinitions por Entity (nombrados, únicos dentro de la Entity).

**FR-FD-11 ****[Validación] **El sistema debe impedir guardar un formulario si su Content no valida contra el JSON Schema correspondiente, si viola las reglas de validación cruzada definidas en el Framework Conceptual v1.1 §5.5 (attributeRef debe pertenecer a la Entity base, search.mode='contains' solo para dataType='string', foreignKeyDisplay solo para FK, component debe existir en ComponentRegistry), o si contiene FormFields que referencian Attributes inexistentes en la Entity base.

## 2.3 Módulo 3 — Form Runtime (RT)

**FR-RT-01 ****[Listado] **El sistema debe presentar un listado de formularios disponibles agrupados por rootProject y por Entity, mostrando el tipo (CRUD o List/Search) y la última fecha de modificación.

**FR-RT-02 ****[Render] **El sistema debe renderizar dinámicamente cada formulario a partir de su FormDefinition leída desde la tabla METADATA, sin requerir código adicional ni rebuild.

**FR-RT-03 ****[Create] **En modo Create, el sistema debe ejecutar una operación INSERT contra la tabla física (campo source de la Entity), mapeando cada valor del formulario a la columna correspondiente (campo metadata.source del Attribute referenciado por attributeRef).

**FR-RT-04 ****[List/Read] **En modo List/Search, el sistema debe ejecutar un SELECT paginado contra la tabla física con LIMIT/OFFSET, aplicando los filtros configurados en cada FormField: exact → WHERE col = $1, contains → WHERE col ILIKE '%' || $1 || '%' (solo para dataType string), semantic → respuesta 501 Not Implemented con mensaje legible.

**FR-RT-05 ****[Update] **En modo Edit, el sistema debe pre-poblar el formulario con los valores actuales del registro seleccionado y ejecutar UPDATE ... WHERE pk = $1 al confirmar, afectando exactamente un registro.

**FR-RT-06 ****[Delete] **En modo Delete, el sistema debe solicitar confirmación explícita al usuario y ejecutar DELETE FROM tabla WHERE pk = $1, afectando exactamente un registro single-row.

**FR-RT-07 ****[FK Select] **Para FormFields asociados a un Attribute con metadata.isForeignKey:true, el sistema debe poblar el componente Select en runtime ejecutando un SELECT sobre la entidad relacionada (resuelta vía la Relation en el Content de la Entity, conforme al Framework Conceptual v1.1 §6.2) que retorne al menos PK y un campo descriptivo configurable (por defecto el primer Attribute string no nulo, o el referenciado en foreignKeyDisplay.displayAttributeRef si está definido).

**FR-RT-08 ****[Validación cliente] **El sistema debe validar en el cliente, antes de enviar al servidor: required, dataType, minLength, maxLength, pattern, min, max, minDate, maxDate, según las constraints del Attribute referenciado y las validations del FormField (que pueden hacer override conforme al Framework Conceptual v1.1 §5.5).

**FR-RT-09 ****[Validación servidor] **El sistema debe re-validar en el servidor las mismas constraints antes de ejecutar SQL, rechazando la operación con código HTTP 422 y un mensaje legible si la validación falla.

**FR-RT-10 ****[Manejo de errores SQL] **El sistema debe interceptar los errores PostgreSQL (SQLSTATE) y traducirlos a mensajes legibles en español: 23505 → "Valor duplicado en campo único", 23503 → "Referencia a registro inexistente", 23502 → "Campo obligatorio sin valor", 23514 → "Restricción de validación incumplida". Para SQLSTATEs no mapeados se retorna el código y el mensaje original.

**FR-RT-11 ****[Logging] **El sistema debe registrar en stdout o en un archivo de log configurable cada operación CRUD ejecutada, incluyendo timestamp, formId, operación, tabla destino, PK afectada (si aplica) y SQLSTATE de respuesta. No se persiste en tabla de auditoría en el MVP.

**FR-RT-12 ****[Transaccionalidad] **El sistema debe ejecutar cada operación CRUD como una transacción independiente single-row; no se soportan operaciones batch en el MVP.

## 2.4 Metamodelo (MM)

| **REFERENCIA NORMATIVA** Estos requerimientos materializan en el sistema las definiciones normativas del Framework Conceptual v1.1. No introducen estructura nueva: garantizan que la implementación respete el metamodelo. |
| --- |

**FR-MM-01 ****[Tabla] **El sistema debe persistir todos los artefactos de metadata en una única tabla denominada METADATA, con la estructura definida en el Framework Conceptual v1.1 §4.1 (columnas IdObject, ObjectName, ObjectType, ObjectTypeName, Content, parent).

**FR-MM-02 ****[Tipos] **El sistema debe respetar el catálogo de ObjectType definido en el Framework Conceptual v1.1 §4.2: 1 = rootProject, 5 = Entity, 6 = attribute, 10 = FormDefinition, 11 = FormField.

**FR-MM-03 ****[JSON Schema] **El sistema debe validar el campo Content de cada artefacto contra el JSON Schema derivado de la firma correspondiente a su ObjectType (Framework Conceptual v1.1 §5.1 a §5.5) antes de cualquier operación de inserción o actualización.

**FR-MM-04 ****[Integridad] **El sistema debe mantener la integridad referencial de la jerarquía vía la columna parent (FK auto-referencial en METADATA con ON DELETE RESTRICT), conforme al Framework Conceptual v1.1 §9.2, e impedir borrar una Entity cuando exista un FormDefinition cuyo parent sea esa Entity.

**FR-MM-05 ****[Integridad] **El sistema debe validar en la capa de aplicación las referencias lógicas contenidas en Content (attributes[], relatedEntity, relatedAttribute, foreignKeyRef, entityRef, attributeRef) antes de persistir, conforme al Framework Conceptual v1.1 §9.2.

## 2.5 Transversales (TR)

**FR-TR-01 ****[Adapter] **La capa de acceso a la BD del negocio (introspección + ejecución CRUD) debe implementarse detrás de la interfaz DatabaseAdapter con métodos: introspectSchema(), executeInsert(), executeSelect(), executeUpdate(), executeDelete(), translateSqlError(). El MVP entrega únicamente PostgresAdapter.

**FR-TR-02 ****[Adapter] **Los módulos Form Designer y Form Runtime no deben contener SQL crudo ni referencias específicas a PostgreSQL; toda interacción con la BD del negocio debe enrutarse a través del DatabaseAdapter activo.

**FR-TR-03 ****[API] **El backend debe exponer una API REST consumida por el frontend, con los endpoints mínimos listados en §4.

**FR-TR-04 ****[Despliegue] **El sistema debe empaquetarse en imágenes Docker y orquestarse con Docker Compose, con servicios separados para backend, frontend y la BD PostgreSQL que aloja METADATA.

**FR-TR-05 ****[i18n] **Los mensajes legibles al usuario (errores, validaciones, advertencias) deben estar en español y centralizados en un catálogo de mensajes en el backend, permitiendo extensión futura a otros idiomas.

# 3. Historias de Usuario y Criterios de Aceptación

Las historias se agrupan por perfil. Cada historia incluye al menos un escenario feliz y uno borde/error en formato Given/When/Then.

## 3.1 Backend Developer

**US-01: **Como Backend Developer, quiero configurar una conexión a una base de datos PostgreSQL del negocio, para poder ejecutar la ingesta sobre ella.

**Criterios de aceptación:**

**1. *****Dado ***que dispongo de credenciales válidas de la BD del negocio y la ruta del archivo de configuración está definida en METADATA_PROJECTS_CONFIG_PATH, ***Cuando ***registro una nueva conexión con host, puerto, schema, usuario y contraseña, ***Entonces ***el sistema valida la conectividad, la persiste en el archivo de configuración y la muestra en la UI como conexión disponible.

**2. *****Dado ***que registro una conexión con credenciales inválidas, ***Cuando ***intento validarla, ***Entonces ***el sistema responde con HTTP 400 y el mensaje "No es posible conectarse a la base de datos: <causa>" sin persistir la conexión.

**US-02: **Como Backend Developer, quiero ejecutar la ingesta automática del esquema de una BD PostgreSQL conectada, para obtener un rootProject poblado con sus Entities y Attributes sin escribir código.

**Criterios de aceptación:**

**1. *****Dado ***que existe una conexión activa válida a una BD con N tablas con PK, ***Cuando ***ejecuto la operación de ingesta, ***Entonces ***el sistema crea exactamente un rootProject, N Entities cuyo parent es el rootProject, y M Attributes cuyo parent es la Entity correspondiente, todos persistidos en METADATA y validados contra el JSON Schema derivado del Framework Conceptual v1.1 §5.

**2. *****Dado ***que la BD contiene 3 tablas sin PK y 2 columnas con tipo tsvector, ***Cuando ***ejecuto la ingesta, ***Entonces ***el sistema omite esas 3 tablas y esas 2 columnas, y el reporte de ingesta lista cada caso con tabla, columna y motivo.

## 3.2 Frontend Developer

**US-03: **Como Frontend Developer, quiero construir un formulario CRUD sobre una Entity descubierta arrastrando atributos al lienzo, para exponer la entidad a usuarios finales sin escribir código.

**Criterios de aceptación:**

**1. *****Dado ***que selecciono una Entity con 6 atributos en el Form Designer, ***Cuando ***arrastro 4 atributos al lienzo, reordeno dos posiciones, edito una etiqueta y guardo el formulario, ***Entonces ***el sistema persiste un artefacto FormDefinition (ObjectType 10) y los 4 FormField correspondientes (ObjectType 11), conforme a las firmas del Framework Conceptual v1.1 §5.4 y §5.5, con parent correctamente establecido y orden y etiqueta personalizada preservados.

**2. *****Dado ***que un FormField referencia un attributeRef inexistente en la Entity base, ***Cuando ***intento guardar el formulario, ***Entonces ***el sistema rechaza la operación con HTTP 422 — conforme a la regla de validación cruzada del Framework Conceptual v1.1 §5.5 — y el mensaje "El campo <name> referencia un atributo que no existe en la entidad base".

**US-04: **Como Frontend Developer, quiero ver un Select poblado automáticamente para los campos FK, para no tener que construir manualmente las opciones.

**Criterios de aceptación:**

**1. *****Dado ***que un Attribute tiene isForeignKey:true con foreignKeyRef hacia una Relation válida (Framework Conceptual v1.1 §5.3), ***Cuando ***arrastro ese Attribute al lienzo, ***Entonces ***el componente se asocia automáticamente al Select y al previsualizar el formulario las opciones se pueblan con PK y descriptor de la entidad relacionada.

**2. *****Dado ***que la entidad relacionada no tiene ningún Attribute string para usar como descriptor, ***Cuando ***previsualizo el formulario, ***Entonces ***el Select muestra únicamente la PK y emite una advertencia en el panel del Designer indicando "Sin campo descriptivo configurado".

## 3.3 Tech Lead / Arquitecto

**US-05: **Como Tech Lead, quiero que toda la interacción con la BD del negocio pase por la interfaz DatabaseAdapter, para poder incorporar otros motores SQL en futuras iteraciones sin tocar Designer ni Runtime.

**Criterios de aceptación:**

**1. *****Dado ***que el MVP solo implementa PostgresAdapter, ***Cuando ***reviso el código de los módulos Form Designer y Form Runtime, ***Entonces ***no existe ninguna importación de la librería pg ni SQL crudo; todas las operaciones se enrutan a través de DatabaseAdapter.

**2. *****Dado ***que en el futuro se implementa MySQLAdapter, ***Cuando ***se cambia el adapter activo en configuración, ***Entonces ***el sistema ejecuta el flujo completo de ingesta-diseño-runtime sin modificaciones en los módulos superiores.

## 3.4 DBA / Data Engineer

**US-06: **Como DBA, quiero obtener un reporte detallado al finalizar la ingesta, para validar que el reverse engineering capturó correctamente el esquema.

**Criterios de aceptación:**

**1. *****Dado ***que ejecuto la ingesta sobre una BD de prueba con 25 tablas, ***Cuando ***termina la ingesta, ***Entonces ***el sistema muestra el reporte con: cantidad de Entities (≤25), cantidad de Attributes, cantidad de Relations detectadas, lista de tablas omitidas con motivo, lista de columnas omitidas con motivo.

**2. *****Dado ***que una tabla del reporte está marcada como "omitida por falta de PK", ***Cuando ***consulto el detalle, ***Entonces ***el reporte indica el nombre de la tabla, su schema y el motivo exacto.

**US-11: **Como DBA, cuando regrese al módulo de Schema Ingestion sobre una conexión ya ingestada previamente, quiero ver el resumen de Entities ya descubiertas sin tener que volver a introspectar, para entender en qué estado está el rootProject sin esperar la introspección completa.

**Criterios de aceptación:**

**1. *****Dado ***que existe un rootProject en METADATA para la conexión activa, ***Cuando ***navego al módulo de Schema Ingestion, ***Entonces ***el sistema lee METADATA (sin invocar al motor de introspección) y muestra el listado de Entities ya ingestadas con su tabla física asociada, número de atributos y número de relaciones.

**2. *****Dado ***que la conexión activa no tiene rootProject en METADATA, ***Cuando ***navego al módulo, ***Entonces ***el sistema muestra el empty state con el botón "Descubrir tablas" para iniciar la primera ingesta.

**US-07: **Como DBA, quiero re-ingestar un rootProject cuando el esquema del negocio cambie, para mantener la metadata sincronizada sin perder los formularios ya diseñados.

**Criterios de aceptación:**

**1. *****Dado ***que existe un rootProject con FormDefinitions creados sobre una Entity Customer, ***Cuando ***ejecuto re-ingesta y la tabla customers en la BD del negocio no cambió, ***Entonces ***todos los FormDefinitions y FormFields permanecen válidos sin marca invalid.

**2. *****Dado ***que la columna customer_email fue eliminada de la tabla del negocio entre la primera ingesta y la re-ingesta, ***Cuando ***ejecuto re-ingesta, ***Entonces ***el Attribute correspondiente se elimina, los FormFields que lo referencian se marcan con invalid:true (conforme al campo invalid definido en el Framework Conceptual v1.1 §5.5) y aparecen listados en el reporte de re-ingesta.

## 3.5 Usuario interno del Runtime

**US-08: **Como Usuario interno, quiero crear un nuevo registro desde un formulario CRUD, para alimentar la BD del negocio sin abrir un cliente SQL.

**Criterios de aceptación:**

**1. *****Dado ***que abro un formulario CRUD en modo Create y diligencio todos los campos requeridos con valores válidos, ***Cuando ***presiono "Guardar", ***Entonces ***el sistema ejecuta INSERT en la tabla física, retorna HTTP 201 con la PK generada y registra la operación en el log.

**2. *****Dado ***que dejo vacío un campo required, ***Cuando ***presiono "Guardar", ***Entonces ***la validación cliente impide el envío y resalta el campo con el mensaje "Campo obligatorio".

**3. *****Dado ***que ingreso un valor duplicado en un campo con unique:true, ***Cuando ***el servidor ejecuta el INSERT, ***Entonces ***PostgreSQL retorna SQLSTATE 23505, el backend lo traduce a "Valor duplicado en campo único" y el formulario muestra el mensaje en el campo afectado.

**US-09: **Como Usuario interno, quiero buscar registros paginados en un formulario List/Search, para encontrar la información que necesito sin SQL.

**Criterios de aceptación:**

**1. *****Dado ***que un formulario List/Search tiene tamaño de página 25 y un FormField customer_name configurado en modo contains, ***Cuando ***escribo "mar" en el filtro y presiono buscar, ***Entonces ***el sistema ejecuta SELECT con WHERE customer_name ILIKE '%mar%' LIMIT 25 y muestra la primera página con paginador en el pie.

**2. *****Dado ***que un FormField está configurado con modo semantic, ***Cuando ***intento ejecutar la búsqueda, ***Entonces ***el sistema responde con HTTP 501 y el mensaje "Búsqueda semántica disponible en próximas versiones".

**US-10: **Como Usuario interno, quiero eliminar un registro existente con confirmación, para evitar borrados accidentales.

**Criterios de aceptación:**

**1. *****Dado ***que selecciono un registro desde el List y abro la acción Delete, ***Cuando ***confirmo la eliminación en el diálogo modal, ***Entonces ***el sistema ejecuta DELETE WHERE pk = $1, retorna HTTP 204 y registra la operación en el log.

**2. *****Dado ***que el registro a eliminar es referenciado por una FK con ON DELETE RESTRICT, ***Cuando ***confirmo la eliminación, ***Entonces ***PostgreSQL retorna SQLSTATE 23503, el backend lo traduce a "No es posible eliminar: existen registros que lo referencian" y la UI lo muestra.

# 4. Flujo de Datos y Endpoints

| **Cambio respecto a v1.0** La sección 4 de la v1.0 ("Definición de Artefactos de Formulario") fue absorbida por el Framework Conceptual v1.1 §5.4 y §5.5. Esta sección, antes numerada §5, pasa a ser §4. La numeración subsiguiente se ajustó en consecuencia. |
| --- |

## 4.1 Entradas, salidas y reglas de negocio

### 4.1.1 Datos de entrada

- Credenciales de conexión a PostgreSQL del negocio (host, puerto, schema, user, password) → archivo de configuración.

- Selección granular de tablas a ingestar → request del usuario en UI.

- Definiciones de formulario construidas por el diseñador → request del Form Designer.

- Valores de campos diligenciados por el usuario final → request del Form Runtime.

### 4.1.2 Datos de salida

- Artefactos en la tabla METADATA (estructura definida en el Framework Conceptual v1.1 §4 y §5): rootProject, Entity, Attribute, FormDefinition, FormField.

- Registros INSERT/UPDATE/DELETE en las tablas físicas de la BD del negocio.

- Reportes de ingesta (sin persistencia: se entregan en la respuesta HTTP).

- Logs de operación CRUD a stdout/archivo.

### 4.1.3 Reglas y restricciones de negocio

- Una Entity no puede existir sin Attributes (mínimo 1: la PK).

- Toda Entity debe declarar source (nombre de la tabla física), conforme al Framework Conceptual v1.1 §5.2.

- Todo Attribute debe declarar metadata.source (nombre de la columna física), conforme al Framework Conceptual v1.1 §5.3.

- Una Relation requiere obligatoriamente cardinality y relatedEntity; relatedAttribute es opcional pero recomendado.

- Los FormFields heredan dataType y validaciones base del Attribute referenciado, pero pueden hacer override de required y agregar validations adicionales conforme al Framework Conceptual v1.1 §5.5.

- Las operaciones Delete requieren confirmación explícita en UI antes de enviar al servidor.

- No se permite borrar un Attribute si existe algún FormField que lo referencie en attributeRef.

## 4.2 API REST mínima

Todos los endpoints retornan JSON. Los errores siguen el formato { code, message, details } y los códigos HTTP estándar.

| **Método** | **Endpoint** | **Propósito** |
| --- | --- | --- |
| GET | /api/projects | Lista los rootProjects existentes. |
| POST | /api/projects/connections | Registra y valida una conexión a BD del negocio. |
| POST | /api/projects/{id}/ingest | Ejecuta la ingesta (o re-ingesta) sobre la conexión activa. |
| GET  | /api/ingestion/state?connectionId={id} | Lee METADATA y devuelve el estado del rootProject (si existe) con sus Entities. Implementa FR-SI-16. |
| GET | /api/projects/{id}/tree | Retorna el árbol completo del rootProject. |
| GET | /api/entities/{id} | Retorna una Entity con sus Attributes y Relations resueltos. |
| GET | /api/entities/{id}/forms?connectionId={n} | Lista los FormDefinition asociados a la Entity. |
| GET | /api/forms/{id}?connectionId={n} | Retorna un FormDefinition con sus fields hidratados. |
| POST | /api/forms | Crea un FormDefinition. |
| PUT | /api/forms/{id} | Actualiza un FormDefinition existente (incrementa version). |
| DELETE | /api/forms/{id}?connectionId={n} | Elimina un FormDefinition. |
| GET | /api/runtime/forms/{id} | Retorna la FormDefinition lista para renderizar. |
| POST | /api/runtime/{formId}/list | List/Search paginado contra la tabla física. Body: `{connectionId, filters[], page, pageSize}`. |
| GET | /api/runtime/{formId}/descriptor?connectionId={n} | Devuelve el `RuntimeFormDescriptor` (columnas, pkColumns, attributeId por columna) para construir el formulario de edición. |
| GET | /api/runtime/{formId}/record?connectionId={n}&<pk_col>={v}... | Lee un registro por PK + devuelve descriptor. |
| POST | /api/runtime/{formId}/records | Crea un registro. Body: `{connectionId, data}`. |
| PUT | /api/runtime/{formId}/records | Actualiza un registro por PK. Body: `{connectionId, pk, data}`. |
| DELETE | /api/runtime/{formId}/records?connectionId={n}&<pk_col>={v}... | Elimina por PK (la UI confirma antes). |
| GET | /api/runtime/{formId}/fk-options/{attributeId}?connectionId={n}&q={search} | Devuelve hasta 50 `{value, label}` para poblar el select de FK con convención automática de label. |
| GET | /api/runtime/forms/{id}/data | (Diferido — se subsume en `POST /api/runtime/{formId}/list`. Mantener referencia normativa hasta Fase 10.) |
| POST | /api/runtime/forms/{id}/data | Create: INSERT en la tabla física. |
| PUT | /api/runtime/forms/{id}/data/{pk} | Update: UPDATE por PK. |
| DELETE | /api/runtime/forms/{id}/data/{pk} | Delete: DELETE por PK con confirmación. |

## 4.3 Diagrama de flujo end-to-end

  ┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐

  │  PostgreSQL        │    │  Form Designer     │    │  Form Runtime      │

  │  del negocio       │    │  (frontend)        │    │  (frontend)        │

  └────────┬───────────┘    └────────┬───────────┘    └────────┬───────────┘

           │  introspección          │  diseña                 │  ejecuta

           ▼                         ▼                         ▼

  ┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐

  │  Schema Ingestion  │───▶│  Tabla METADATA    │◀───│  Form Runtime API  │

  │  (PostgresAdapter) │    │  (rootProject,     │    │  (renderiza,       │

  │                    │    │   Entity,          │    │   valida, ejecuta) │

  │                    │    │   Attribute,       │    │                    │

  │                    │    │   FormDefinition,  │    │                    │

  │                    │    │   FormField)       │    │                    │

  └────────────────────┘    └────────────────────┘    └────────┬───────────┘

                                                               │  CRUD

                                                               ▼

                                                    ┌────────────────────┐

                                                    │  PostgreSQL        │

                                                    │  del negocio       │

                                                    │  (tablas físicas)  │

                                                    └────────────────────┘

| **REFERENCIA NORMATIVA** La estructura interna de la tabla METADATA y las firmas de los cinco artefactos (rootProject, Entity, Attribute, FormDefinition, FormField) están definidas en el Framework Conceptual v1.1, §4 y §5. |
| --- |

# 5. Requerimientos No Funcionales (NFR)

| **Categoría** | **Requerimiento** |
| --- | --- |
| Rendimiento — ingesta | Una BD de hasta 200 tablas debe ingestarse en menos de 60 segundos en hardware de desarrollo estándar (8 vCPU, 16 GB RAM). |
| Rendimiento — runtime | El 95% de las operaciones CRUD single-row deben responder en menos de 500 ms con la BD del negocio en la misma red local. |
| Rendimiento — list/search | Una consulta paginada con tamaño 25 sobre una tabla de hasta 1 M de filas debe responder en menos de 1.5 s, asumiendo índices existentes sobre los campos filtrados. |
| Escalabilidad — METADATA | La tabla METADATA debe soportar al menos 10 000 artefactos (combinación de rootProjects/Entities/Attributes/FormDefinitions/FormFields) sin degradación apreciable de las consultas jerárquicas, usando índice B-tree sobre parent e índice GIN sobre Content (conforme al Framework Conceptual v1.1 §9.1). |
| Disponibilidad | Herramienta interna sin SLA formal en el MVP. Objetivo informal: disponible durante horario laboral del equipo (5×9), con reinicio manual aceptable. |
| Seguridad — transporte | Toda comunicación API entre frontend y backend debe usar HTTPS en cualquier despliegue no local. |
| Seguridad — credenciales | Las credenciales de BD se almacenan en archivo de filesystem con permisos 600 (solo owner read/write). La aplicación nunca debe loggear contraseñas en plano. |
| Seguridad — inyección SQL | Toda construcción de SQL (introspección y CRUD) debe usar parámetros bind ($1, $2…) provistos por node-postgres. No se permite concatenación de strings con input de usuario. |
| Trazabilidad | Cada operación CRUD ejecutada debe generar al menos una línea de log con timestamp ISO 8601, formId, operación, tabla destino, SQLSTATE de respuesta y duración en ms. |
| Usabilidad | El flujo end-to-end (conectar → ingestar → diseñar → ejecutar CRUD) debe completarse por un desarrollador interno en menos de 15 minutos sobre una BD nueva. |
| Mantenibilidad | Cobertura de pruebas unitarias mínima del 70% en el backend (validación de schemas, mapeo de tipos, traducción de errores). Pruebas e2e con Playwright cubren el flujo completo en al menos un caso happy path por módulo. |
| Portabilidad | Toda interacción con la BD del negocio debe pasar por DatabaseAdapter. Un nuevo motor SQL puede incorporarse implementando la interfaz sin modificar Form Designer ni Form Runtime. |
| Compatibilidad | Frontend soportado en últimas dos versiones mayores de Chrome, Firefox y Edge. Sin soporte para Internet Explorer. |
| Localización | Mensajes de UI y errores en español en el MVP, con catálogo centralizado para habilitar i18n en iteraciones futuras. |
| Despliegue | Empaquetado con Docker; despliegue mediante Docker Compose en infraestructura interna existente. |

# 6. Integraciones y Dependencias Externas

| **Sistema** | **Propósito** | **Tipo** | **Notas** |
| --- | --- | --- | --- |
| PostgreSQL 16+ (BD del negocio) | Fuente para introspección y destino de CRUD en runtime | Driver node-postgres (pg) | Requiere permisos de lectura en information_schema/pg_catalog y permisos CRUD en las tablas expuestas. |
| PostgreSQL 16+ (BD de metadata) | Persistencia de la tabla METADATA | Driver node-postgres (pg) | Puede coincidir con la BD del negocio en el MVP o estar en una instancia separada. |
| AJV (JSON Schema) | Validación de Content de cada artefacto | Librería embebida | Schemas derivados del Framework Conceptual v1.1 §5.1 a §5.5. |
| dnd-kit | Drag & drop en Form Designer | Librería frontend | Restringido a reordenamiento vertical en el lienzo del MVP. |
| React 18 + Vite + TypeScript | SPA del Designer y Runtime | Stack frontend | Una sola SPA con routing interno. |
| Node.js + Fastify + TypeScript | Backend REST | Stack backend | Hot reload en desarrollo, compilación a JS en producción. |
| Zustand + React Query | Estado UI y cache de queries al backend | Librerías frontend | — |
| shadcn/ui + Tailwind CSS | Componentes UI base | Librería frontend | Sin lock-in de design system. |
| Docker + Docker Compose | Empaquetado y orquestación | Infra | Servicios backend, frontend, postgres. |
| Vitest + Supertest + Playwright | Testing unit/integration/e2e | Stack de pruebas | Pruebas e2e del flujo end-to-end en semana 8. |

# 7. Fuera de Alcance (v1.1)

- Soporte para Oracle, SQL Server y MySQL: queda diferido para iteración 2 mediante implementaciones adicionales de DatabaseAdapter.

- Autenticación, autorización y RBAC: la herramienta opera en entorno controlado en el MVP.

- Formularios maestro-detalle o multi-entidad (joins): un formulario = una Entity base en el MVP.

- Artefactos Rule y Event para reglas de negocio y workflows.

- Versionado completo de metadata y formularios (el campo version se reserva en rootProject).

- Exportación / importación de proyectos entre ambientes.

- Componentes UI avanzados: file upload, rich-text, campos geográficos.

- Detección automática de diffs estructurales entre ingestas (diff de columnas, tipos, FKs). La re-ingesta selectiva (v2) ya permite al usuario elegir qué tablas refrescar, pero no detecta cambios automáticamente — la decisión sigue siendo manual.

- Búsqueda semántica en runtime: el contrato y la opción en el Designer están definidos, pero la ejecución retorna HTTP 501.

- Tabla de auditoría persistente para operaciones CRUD.

- Internacionalización a otros idiomas distintos del español.

- Encriptación en reposo de credenciales de BD.

# 8. Historial de Versiones

| **Versión** | **Fecha** | **Descripción** |
| --- | --- | --- |
| 1.0 | 16 de mayo de 2026 | Versión inicial del SRS. Consolidaba visión, framework conceptual v1.0 y respuestas del bucle consultivo. Incluía la definición de FormDefinition y FormField (duplicada con el Framework Conceptual). |
| 1.1 | 16 de mayo de 2026 | Refactor de gobernanza documental: se elimina la antigua §4 "Definición de Artefactos de Formulario" y se reemplaza por referencias normativas al Framework Conceptual v1.1 §5.4 y §5.5. Las secciones siguientes se renumeran (antigua §5 → §4, §6 → §5, §7 → §6, §8 → §7, §9 → §8). Se agrega §1.3 "Documentos de referencia" para formalizar la jerarquía de propiedad documental. Los requerimientos funcionales conservan sus identificadores y se actualizan para referenciar el Framework cuando invocan estructuras del metamodelo. |
| 1.2 | 17 de mayo de 2026 | Se agrega FR-SI-16 (visibilidad del estado persistido al volver al módulo de ingesta) y la US-11 correspondiente. Se añade el endpoint `GET /api/ingestion/state` a la API REST (§4.2). Motivación: al regresar al módulo, el usuario veía "no se ha descubierto ningún schema" aunque la ingesta sí estaba persistida, porque la UI dependía del estado volátil del último preview. La detección se hace leyendo METADATA con el filtro ObjectType=1 + ObjectName canónico `&lt;database&gt;__&lt;schema&gt;`. |
| 1.3 | 17 de mayo de 2026 | Fase 7 (Form Designer — persistencia). Se aclara FR-FD-10 con la nota de implementación MVP: los fields se persisten **inline** en `FormDefinition.Content.fields[]` con firma `{attributeId, label?, placeholder?, helpText?, required?, validations?, xPath?}`. FormField (ObjectType=11) queda reservado para una iteración futura cuando se requiera operar campos individualmente. Se agrega el campo libre `xPath` (mecanismo de navegación reservado, sin semántica en MVP). El endpoint `GET /api/forms/{id}` se añade explícitamente a §4.2 y los demás endpoints de forms se documentan con el parámetro `connectionId` (METADATA vive en la BD del usuario, no en SQLite local). Forms múltiples por Entity, nombrados, únicos dentro de la Entity. Validación AJV server-side antes de INSERT/UPDATE. |
| 1.4 | 17 de mayo de 2026 | Fase 8 (Runtime — List/Search). Se implementa `POST /api/runtime/{formId}/list` (request: `{connectionId, filters[], page, pageSize}`; response: `{columns, rows, total, page, pageSize, formName, formMode, entityName, physicalTable}`). Las columnas a mostrar provienen del `FormDefinition.fields[]` cuando el form es de tipo `list`; cuando el form es CRUD, se aplica fallback "PK + primeros 5 atributos". Operadores soportados: `=, <>, <, <=, >, >=, LIKE, ILIKE, IN, IS NULL, IS NOT NULL` con whitelist en frontend según `dataType`. Se implementa el traductor SQLSTATE → mensaje legible en español en `backend/src/errors/sql-translator.ts` cubriendo los códigos definidos en FR-RT-10 (23502/23503/23505/23514, 22001/22003/22008/22P02, 42501/42P01/42703, 08001/08003/08006, 53300, 57014, 40001). El traductor es la **única** frontera donde se ven `SQLSTATE` crudos. FK display amigable (poblado desde la entidad relacionada) queda diferido a Fase 9. |
| 1.5 | 17 de mayo de 2026 | Fase 9 (Runtime — CRUD Create/Read/Update/Delete + audit). Se implementan en el adapter `selectByPk/insert/update/delete` (`PgAdapter`, único punto que toca `pg`). Nuevos endpoints: `GET /runtime/{formId}/descriptor`, `GET /runtime/{formId}/record?<pk>`, `POST /runtime/{formId}/records`, `PUT /runtime/{formId}/records`, `DELETE /runtime/{formId}/records?<pk>`, `GET /runtime/{formId}/fk-options/{attributeId}?q=`. El `descriptor` incluye `pkColumns[]` y para cada columna su `attributeId` (necesario para invocar fk-options). FK display: convención automática server-side — primer match en `name | title | label | display_name | email | code | username`, fallback a la PK; carga hasta 50 opciones, preserva el valor actual fuera de esa ventana con etiqueta "(actual)". Override explícito (foreignKeyDisplay) queda para iteración posterior. Audit log: tabla `operation_log` en SQLite **local** del MFT (no en la BD del negocio) con `{ts, connection_id, form_id, entity_id, physical_table, operation, pk_json, success, error_message}`; migración `002_operation_log_fix.sql` corrige `form_id INTEGER → TEXT (UUID)` y añade `connection_id`/`entity_id`/`physical_table`. El audit nunca rompe la operación del negocio (errores de escritura silenciados). UI: nueva sub-vista `RuntimeEditPage` dentro del módulo Runtime con layout `Form (flex) | Panel metadata (260px)`, integración List ↔ Edit (botones edit/trash por fila + `+ Nuevo Registro` en topbar), modal de confirmación de delete, validación cliente de required/maxLength/minLength antes del POST/PUT (re-validada server-side por restricciones de PG). |

*— Fin del documento —*
