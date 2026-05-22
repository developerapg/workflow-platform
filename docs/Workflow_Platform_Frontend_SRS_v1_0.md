# SRS — FRONTEND

**Workflow Platform**

*SPA en React 18 + TypeScript + Vite: módulos del diseñador, bandeja de tareas y ejecución de formularios sobre el API del Backend MVP*

Mayo 2026 · v1.0 · Confidencial — Documento interno

---

# 1. Introducción

## 1.1 Propósito

Este documento especifica el **frontend** del MVP de Workflow Platform: una Single Page Application en **React 18 + TypeScript** construida con **Vite**, que consume el API HTTP del backend (8 endpoints) para:

- Diseñar entidades (con atributos), formularios (form_definitions) y procesos (process_definitions con nodos y transiciones).
- Listar y administrar el árbol del proyecto.
- Ejecutar procesos: ver bandeja de tareas, tomar tareas, completar formularios.
- Ver el estado de instancias de proceso en curso.

El frontend opera contra un único proyecto (el backend MVP es single-project; ver SRS Backend v1.0 §1.3). No hay login, no hay selector de proyecto, no hay gestión de usuarios. Esas capas llegan con el módulo administrativo cuando sea desarrollado como proyecto desacoplado.

## 1.2 Audiencia

- **Equipo de Frontend**, como contrato funcional y arquitectónico de la aplicación a construir.
- **Equipo de Backend**, para validar que el API documentado cubre todas las necesidades del frontend.
- **Operador de deployment**, para entender cómo se construye, se sirve y se configura.
- **Diseñador / UX** (referencia cruzada con UX Spec v1.0).

## 1.3 Alcance

| Incluido en v1.0 | Fuera de alcance |
| --- | --- |
| Módulo de Entidades: lista, detalle, crear/editar entidad con atributos. | Brownfield: pantallas de "ingestar tabla existente". Diferido a v1.2. |
| Módulo de Formularios: lista, detalle, diseñador visual de formularios con FormFields. | Templates: aplicar template del catálogo central. Pertenece al módulo administrativo. |
| Módulo de Procesos: lista, detalle, canvas con React Flow para diseñar `start → human_task → end`. | Canvas con paralelismo, gateways, scripts. Diseñables como metadata (la UI los permite) pero el motor MVP los rechaza al instanciar; la UI debe advertir. |
| Bandeja de tareas: listar, claim, completar con formulario. | Reasignación, timeouts, escalado de tareas. |
| Vista de instancia de proceso en curso (historial, nodo activo, contexto). | Dashboard analítico, reportes, métricas agregadas. |
| Manejo de errores uniforme con mensajes legibles. | i18n / multi-idioma. La UI está en español; los identificadores técnicos en inglés. |
| Diseño responsive básico para desktop (≥ 1280px). | Soporte completo para tablet/móvil. |
| Sin autenticación: la app carga directo al workspace. Header `X-User-Id` opcional configurable. | Login, sesiones, refresh tokens. |
| Build estático servido por nginx, Caddy u otro web server. | Server-Side Rendering, Static Site Generation. |

## 1.4 Documentos de referencia

| Documento | Versión | Cómo se usa aquí |
| --- | --- | --- |
| Workflow Platform — Documento de Visión | 1.0 | Visión de producto, principios. |
| Workflow Platform — UX Spec | 1.0 | Patrones de UI, comportamientos esperados de cada módulo, criterios de aceptación visual. **Este SRS operacionaliza el UX Spec.** |
| Workflow Platform — Definición de Metadata | 1.0 | Firmas JSON canónicas que el frontend debe construir y consumir. |
| Workflow Platform — Modelo de Datos Físico | 1.1 | Solo referencia: el frontend no toca BD. |
| Workflow Platform — SRS Backend | 1.0 | **Contrato del API que este frontend consume.** Endpoints, formatos, códigos de error, reglas de validación que se manifestarán en la UI. |

## 1.5 Convenciones

- Bloques `tsx` son ilustrativos del diseño, no normativos en su sintaxis exacta.
- Reglas funcionales numeradas como **FE-NN** (Frontend Rule).
- Las reglas VR-NN, RT-NN, BR-NN se mencionan cuando el frontend debe mostrarlas al usuario o manejarlas activamente; no se reescriben aquí.

---

# 2. Visión arquitectónica

## 2.1 Posición del frontend

```
┌────────────────────────────────────────────┐
│  Browser (Chrome, Edge, Firefox, Safari)   │
│                                            │
│   ┌────────────────────────────────────┐   │
│   │  React SPA                         │   │
│   │   - React 18 + TS                  │   │
│   │   - TanStack Query (server state)  │   │
│   │   - React Router v6                │   │
│   │   - React Hook Form + Zod          │   │
│   │   - React Flow (canvas)            │   │
│   │   - Tailwind (CSS)                 │   │
│   └─────────────┬──────────────────────┘   │
└─────────────────┼──────────────────────────┘
                  │ HTTP / JSON
                  ▼
       ┌──────────────────────┐
       │  Backend (.NET 9)    │
       │  8 endpoints         │
       └──────────────────────┘
```

## 2.2 Principios arquitectónicos

**FA1 — Server state separado de UI state.** TanStack Query maneja todo lo que viene del backend (caches, refetch, invalidación). Context API + useState manejan estado local de UI (qué tab está activo, qué nodo está seleccionado, si un drawer está abierto). No mezclar.

**FA2 — Organización por módulo de UX.** El código se organiza por feature funcional (Entities, Forms, Processes, Tasks), no por tipo técnico (components, hooks, utils). Cada feature es autocontenida.

**FA3 — Componentes propios, sin librería de UI.** Tailwind CSS para styling. Los componentes base (Button, Input, Modal, Drawer, Table) se construyen una sola vez en `src/ui/` y se reusan. Esto evita bloat de librerías grandes y mantiene control total del look.

**FA4 — Tipado fuerte de extremo a extremo.** Los tipos de los DTOs del backend se definen en TypeScript y se reusan en hooks, componentes y validaciones de Zod. Cero `any`.

**FA5 — Validación en cliente como cortesía, no como garantía.** El backend es la fuente de verdad para validación. El cliente valida lo que puede (con Zod) para dar feedback rápido, pero siempre asume que el servidor podría rechazar y debe manejar errores del API con elegancia.

**FA6 — Optimistic UI selectivamente.** Para operaciones reversibles y rápidas (marcar tarea como claimed), TanStack Query soporta optimistic updates. Para operaciones complejas (persist con batch), se espera al servidor.

## 2.3 Estructura del proyecto

```
workflow-platform-frontend/
├── public/
│   └── index.html
├── src/
│   ├── api/                    → cliente HTTP, hooks de TanStack Query
│   │   ├── client.ts           → fetch wrapper con interceptores
│   │   ├── endpoints.ts        → constantes de URLs
│   │   ├── types.ts            → DTOs tipados de request/response
│   │   ├── useReadMetadata.ts  → hook genérico para GET /api/read
│   │   ├── usePersist.ts       → mutation para POST /api/persist
│   │   ├── useStartProcess.ts  → mutation para POST /api/processes/{id}/instances
│   │   ├── useInstance.ts      → query para GET /api/instances/{id}
│   │   ├── useMyTasks.ts       → query para GET /api/tasks/me
│   │   ├── useClaimTask.ts     → mutation para POST /api/tasks/{id}/claim
│   │   └── useCompleteTask.ts  → mutation para POST /api/tasks/{id}/complete
│   ├── features/
│   │   ├── entities/           → módulo Entidades
│   │   │   ├── EntityList.tsx
│   │   │   ├── EntityDetail.tsx
│   │   │   ├── EntityForm.tsx
│   │   │   ├── AttributeList.tsx
│   │   │   ├── AttributeRow.tsx
│   │   │   ├── schemas.ts      → Zod schemas para validación
│   │   │   ├── hooks/          → hooks específicos del módulo
│   │   │   └── index.ts
│   │   ├── forms/              → módulo Formularios
│   │   │   ├── FormList.tsx
│   │   │   ├── FormDesigner.tsx
│   │   │   ├── FormFieldEditor.tsx
│   │   │   ├── FormPreview.tsx
│   │   │   ├── schemas.ts
│   │   │   └── ...
│   │   ├── processes/          → módulo Procesos
│   │   │   ├── ProcessList.tsx
│   │   │   ├── ProcessDetail.tsx
│   │   │   ├── ProcessCanvas.tsx     → React Flow wrapper
│   │   │   ├── NodePalette.tsx
│   │   │   ├── NodePropertiesPanel.tsx
│   │   │   ├── nodes/                → custom node types para React Flow
│   │   │   │   ├── StartNode.tsx
│   │   │   │   ├── HumanTaskNode.tsx
│   │   │   │   ├── EndNode.tsx
│   │   │   │   ├── ScriptTaskNode.tsx       (diseñable, advierte)
│   │   │   │   └── ExclusiveGatewayNode.tsx (diseñable, advierte)
│   │   │   ├── schemas.ts
│   │   │   └── ...
│   │   ├── tasks/              → bandeja y ejecución de tareas
│   │   │   ├── TaskInbox.tsx
│   │   │   ├── TaskCard.tsx
│   │   │   ├── TaskExecutionForm.tsx
│   │   │   ├── schemas.ts
│   │   │   └── ...
│   │   └── instances/          → seguimiento de instancias en curso
│   │       ├── InstanceDetail.tsx
│   │       ├── InstanceHistory.tsx
│   │       ├── ContextViewer.tsx
│   │       └── ...
│   ├── layout/                 → layout app-wide (header, sidebar, breadcrumbs)
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   └── Breadcrumbs.tsx
│   ├── ui/                     → componentes base reusables
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Checkbox.tsx
│   │   ├── Modal.tsx
│   │   ├── Drawer.tsx
│   │   ├── Table.tsx
│   │   ├── Toast.tsx
│   │   ├── Spinner.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── index.ts            → barrel export
│   ├── lib/                    → utilidades transversales
│   │   ├── errors.ts           → parseo de errores del backend
│   │   ├── format.ts           → formateo de fechas, números
│   │   ├── tempIds.ts          → helpers para alias temporales del batch
│   │   ├── tree.ts             → utilidades de árbol del proyecto
│   │   └── ...
│   ├── routes/                 → configuración de rutas
│   │   └── router.tsx
│   ├── App.tsx
│   ├── main.tsx                → entry point, providers (QueryClient, Router)
│   └── env.ts                  → tipado y validación de variables de entorno
├── .env.example
├── index.html
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── package.json
```

### 2.3.1 Razones de la estructura

- **`api/` es plano**, no anidado por feature. Razón: los hooks de TanStack Query son la "interfaz" con el backend; tenerlos juntos facilita ver el contrato del API completo en un solo lugar.
- **`features/` anidado por dominio**. Cada feature tiene sus propios componentes, schemas Zod, hooks locales. Si una feature crece, escala hacia adentro sin contaminar las otras.
- **`ui/` reusable.** Componentes base sin lógica de negocio. Cualquier feature los importa.
- **`lib/` para utilidades sin estado.** Funciones puras de formateo, parseo, etc.
- **No hay `components/` global**. Si un componente es transversal va a `ui/`; si pertenece a una feature, va dentro de ella.

## 2.4 Stack tecnológico

| Componente | Tecnología | Razón |
| --- | --- | --- |
| Lenguaje | TypeScript 5.x | Tipado fuerte. Cero `any` salvo casos justificados. |
| Framework | React 18 | Standard de industria, concurrent features estables. |
| Build | Vite 5.x | Build rápido, HMR instantáneo, soporte TS first-class. |
| Routing | React Router 6.x | Standard, ampliamente documentado. |
| Server state | TanStack Query 5.x | Cache, refetch, invalidación, loading/error states gestionados. |
| Forms | React Hook Form 7.x + Zod 3.x | Performance de RHF + tipos generados desde Zod. |
| Canvas de procesos | React Flow 11.x | Custom nodes, edges, controles, layout extensible. |
| Styling | Tailwind CSS 3.x | Utility-first, sin runtime, sin librería de componentes. |
| Iconos | Lucide React | Set consistente, tree-shakeable, ampliamente usado. |
| Notificaciones | sonner | Toast simple, accesible, sin overhead. |
| HTTP | `fetch` nativo + wrapper propio | No se necesita axios; el wrapper provee interceptores. |
| Test | Vitest + Testing Library | Vitest se integra con Vite; Testing Library es standard. |

---

# 3. Configuración y arranque

## 3.1 Variables de entorno

El frontend lee configuración de variables de entorno en build time (prefijo `VITE_`):

| Variable | Descripción | Default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | URL base del backend (incluye `/api`). | `http://localhost:5080/api` |
| `VITE_USER_ID` | UUID del usuario que se envía como `X-User-Id`. MVP placeholder. | `""` (no se envía header) |
| `VITE_APP_NAME` | Nombre mostrado en el title de la app. | `Workflow Platform` |
| `VITE_LOG_LEVEL` | Nivel de logging del cliente: `debug \| info \| warn \| error`. | `info` |

`src/env.ts` valida estas variables al arranque con Zod. Si faltan o son inválidas, la app muestra un error de configuración en lugar de cargar.

```ts
// src/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  VITE_API_BASE_URL: z.string().url(),
  VITE_USER_ID: z.string().uuid().optional().or(z.literal('')),
  VITE_APP_NAME: z.string().default('Workflow Platform'),
  VITE_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export const env = EnvSchema.parse(import.meta.env);
```

## 3.2 Bootstrap

`src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from './routes/router';
import { ErrorBoundary } from './ui/ErrorBoundary';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30s antes de considerar dato stale
      gcTime: 5 * 60_000,       // 5min antes de garbage collection
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster position="bottom-right" />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
```

## 3.3 Reglas de arranque

- **FE-01:** Si `VITE_API_BASE_URL` falla validación Zod, la app no monta. Se muestra una página estática de error de configuración.
- **FE-02:** Al cargar, el primer fetch contra el backend es `GET /api/health`. Si falla, se muestra una pantalla de "Backend no disponible" con botón de reintento. La app no procede a cargar módulos hasta que el health responda OK.
- **FE-03:** El `X-User-Id` se envía en todas las requests solo si `VITE_USER_ID` está configurado y no vacío. Si vacío, no se envía el header (backend acepta requests sin él).

---

# 4. Cliente HTTP y server state

## 4.1 Cliente HTTP base

`src/api/client.ts`:

```ts
import { env } from '@/env';
import { parseBackendError } from '@/lib/errors';

export class ApiClient {
  private baseUrl = env.VITE_API_BASE_URL;
  private userId = env.VITE_USER_ID;

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set('Content-Type', 'application/json');
    if (this.userId) headers.set('X-User-Id', this.userId);

    const correlationId = crypto.randomUUID();
    headers.set('X-Correlation-Id', correlationId);

    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw parseBackendError(res.status, errorBody, correlationId);
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  }
}

export const apiClient = new ApiClient();
```

- **FE-10:** Toda request genera un `X-Correlation-Id` UUID v4. Se loguea en consola con el correlation_id si el log_level es debug. El backend lo retorna en el header de respuesta y en el body de error.
- **FE-11:** El parseo de errores del backend se centraliza en `src/lib/errors.ts`. Toma el status HTTP + body con el shape uniforme (`error.code`, `error.message`, `error.details`) y crea una instancia de `BackendError` que las features pueden mostrar.

## 4.2 Hooks de TanStack Query

### 4.2.1 Query keys

Las query keys son tuplas estructuradas para permitir invalidación granular:

```ts
// src/api/queryKeys.ts
export const queryKeys = {
  metadata: {
    all: ['metadata'] as const,
    byType: (type: string) => ['metadata', type] as const,
    byId: (type: string, id: string) => ['metadata', type, id] as const,
    hydrated: (type: string, id: string) => ['metadata', type, id, 'hydrated'] as const,
  },
  instances: {
    all: ['instances'] as const,
    byId: (id: string) => ['instances', id] as const,
  },
  tasks: {
    me: ['tasks', 'me'] as const,
  },
  health: ['health'] as const,
};
```

### 4.2.2 Hook genérico de lectura

```ts
// src/api/useReadMetadata.ts
export function useReadMetadata<T>(params: {
  objectType: string;
  id?: string;
  parentId?: string;
  hydrate?: boolean;
}) {
  const queryParams = new URLSearchParams();
  queryParams.set('object_type', params.objectType);
  if (params.id) queryParams.set('id', params.id);
  if (params.parentId) queryParams.set('parent_id', params.parentId);
  if (params.hydrate) queryParams.set('hydrate', 'true');

  const key = params.hydrate && params.id
    ? queryKeys.metadata.hydrated(params.objectType, params.id)
    : params.id
      ? queryKeys.metadata.byId(params.objectType, params.id)
      : queryKeys.metadata.byType(params.objectType);

  return useQuery({
    queryKey: key,
    queryFn: () => apiClient.request<{ items?: T[]; item?: T; total?: number }>(
      `/read?${queryParams.toString()}`
    ),
  });
}
```

Uso en una feature:

```tsx
const { data, isLoading, error } = useReadMetadata<Entity>({
  objectType: 'entity',
});
```

### 4.2.3 Hook de mutación: persist

```ts
// src/api/usePersist.ts
export function usePersist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (operations: Operation[]) =>
      apiClient.request<{ results: OperationResult[] }>('/persist', {
        method: 'POST',
        body: JSON.stringify({ operations }),
      }),
    onSuccess: (data, operations) => {
      // Invalidar caches basándose en los object_types afectados
      const affectedTypes = new Set(operations.map(op => op.object_type));
      affectedTypes.forEach(type => {
        queryClient.invalidateQueries({ queryKey: queryKeys.metadata.byType(type) });
      });
    },
  });
}
```

- **FE-20:** Tras una mutation exitosa de `persist`, se invalidan automáticamente todas las queries del `object_type` afectado. Esto re-fetch la lista correspondiente.
- **FE-21:** Si la mutation falla con 422, el error se entrega al componente que llamó. La UI debe mostrar los `details` campo por campo con la `rule` violada (VR/RT/BR).

## 4.3 Manejo de errores del backend

`src/lib/errors.ts`:

```ts
export class BackendError extends Error {
  constructor(
    public httpStatus: number,
    public code: string,
    public details: Array<{
      field?: string;
      rule?: string;
      message: string;
      operation_index?: number;
      temp_id?: string;
    }> = [],
    public correlationId?: string,
    message?: string,
  ) {
    super(message ?? code);
  }

  isValidationError(): boolean {
    return this.httpStatus === 422;
  }

  isUnsupportedRuntimeFeature(): boolean {
    return this.code === 'unsupported_node_type'
        || this.code === 'unsupported_transition_condition';
  }
}

export function parseBackendError(
  status: number,
  body: any,
  correlationId: string,
): BackendError {
  return new BackendError(
    status,
    body?.error?.code ?? 'unknown',
    body?.error?.details ?? [],
    body?.error?.correlation_id ?? correlationId,
    body?.error?.message,
  );
}
```

### 4.3.1 Mostrar errores en UI

- **FE-30:** Para errores estructurales (400, 500, 503): mostrar toast de error con mensaje genérico + opción "Mostrar detalles" que abre un modal con el `correlation_id` (útil para soporte).
- **FE-31:** Para errores 422 con `details`: si la operación venía de un formulario, mapear cada `field` a su input correspondiente y mostrar el `message` debajo del campo. Si no se puede mapear, mostrar lista completa en toast/modal.
- **FE-32:** Para errores 409 (`concurrent_modification`): toast con mensaje "Otro usuario modificó este objeto. Recargar para ver cambios." con botón que invalida la query y refetch.
- **FE-33:** Para errores 422 `unsupported_node_type` o `unsupported_transition_condition` al instanciar un proceso: mostrar un modal explicando que el proceso contiene elementos no soportados en MVP y listar los nodos/transiciones ofensores. El usuario puede volver al diseñador.

---

# 5. Routing

## 5.1 Definición de rutas

`src/routes/router.tsx`:

```tsx
import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/layout/AppShell';
import { EntityList, EntityDetail } from '@/features/entities';
import { FormList, FormDesigner } from '@/features/forms';
import { ProcessList, ProcessDetail } from '@/features/processes';
import { TaskInbox, TaskExecutionForm } from '@/features/tasks';
import { InstanceDetail } from '@/features/instances';
import { NotFound } from '@/ui/NotFound';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'entities', element: <EntityList /> },
      { path: 'entities/new', element: <EntityDetail mode="create" /> },
      { path: 'entities/:id', element: <EntityDetail mode="edit" /> },
      { path: 'forms', element: <FormList /> },
      { path: 'forms/new', element: <FormDesigner mode="create" /> },
      { path: 'forms/:id', element: <FormDesigner mode="edit" /> },
      { path: 'processes', element: <ProcessList /> },
      { path: 'processes/new', element: <ProcessDetail mode="create" /> },
      { path: 'processes/:id', element: <ProcessDetail mode="edit" /> },
      { path: 'tasks', element: <TaskInbox /> },
      { path: 'tasks/:id', element: <TaskExecutionForm /> },
      { path: 'instances/:id', element: <InstanceDetail /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
```

## 5.2 Layout app-wide

`<AppShell />` provee la estructura visual común: sidebar con módulos, top bar, área de contenido. Renderiza el outlet de la ruta hija.

```tsx
function AppShell() {
  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <Breadcrumbs />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

- **FE-40:** El sidebar contiene cinco entradas fijas: Entidades, Formularios, Procesos, Tareas, Instancias. Cada una resaltada si la ruta activa coincide.
- **FE-41:** Breadcrumbs muestran la jerarquía actual (ej. "Procesos / Vacation Approval / Editar"). Se calculan desde la ruta y los datos hidratados de la query activa.
- **FE-42:** El TopBar muestra el nombre del proyecto (placeholder en MVP) y un placeholder de usuario (icono + "Usuario" hasta que llegue auth real).

---

# 6. Módulo Entidades

## 6.1 Propósito

Crear, listar, editar y eliminar entidades del proyecto. Cada entidad es una "tabla lógica" (que en greenfield se materializa físicamente; ver SRS Backend §5).

## 6.2 Pantallas

### 6.2.1 `EntityList` — Listado

- **Ruta:** `/entities`.
- **Datos:** `useReadMetadata<Entity>({ objectType: 'entity' })`.
- **UI:** tabla con columnas `name`, `source`, `description`, `updated_at`, `acciones`.
- **Acciones:** botón "Nueva entidad" arriba, botón "Eliminar" por fila (con confirmación).

**Comportamiento:**

- **FE-50:** Si `isLoading`, mostrar `<Spinner />` centrado. Si `error`, mostrar `<ErrorState />` con botón de reintento.
- **FE-51:** Si lista vacía, mostrar `<EmptyState />` con CTA "Crear la primera entidad".
- **FE-52:** Click en una fila navega a `/entities/{id}`.
- **FE-53:** Click en "Eliminar" abre confirmación modal. Si se confirma, despacha `usePersist()` con una operación `delete entity`. Manejar específicamente errores VR-10, VR-11, VR-12 mostrando qué objetos bloquean la eliminación.

### 6.2.2 `EntityDetail` — Detalle / Edición

- **Ruta:** `/entities/:id` (edit) o `/entities/new` (create).
- **Datos:** en edit, `useReadMetadata<Entity>({ objectType: 'entity', id, hydrate: true })` (incluye atributos).
- **UI:** dos pestañas o secciones:
  - **General:** form RHF con `object_name`, `content.source`, `content.description`, `content.mode` (`greenfield` / `brownfield`).
  - **Atributos:** lista editable con `AttributeRow` reordenable.

**Comportamiento:**

- **FE-60:** El form usa `react-hook-form` con Zod resolver. Schema Zod refleja las reglas VR-40 (snake_case), VR-05 (unicidad — esto solo se valida al persistir contra el backend), y los catálogos válidos.
- **FE-61:** Modo `create`: al guardar, despacha `usePersist()` con un batch que incluye:
  1. `create entity` con `temp_id="ent"`.
  2. Por cada atributo en la lista, un `create attribute` con `entity_ref: "ent"`.
  Un solo round-trip al backend, atómico.
- **FE-62:** Modo `edit`: al guardar, calcular el diff entre el estado original y el actual:
  - Atributos añadidos → `create attribute`.
  - Atributos modificados → `update attribute`.
  - Atributos eliminados → `delete attribute`.
  - Cambios en la entidad → `update entity`.
  Despachar todo en un solo batch.
- **FE-63:** Si hay cambios sin guardar y el usuario navega afuera, mostrar confirmación "¿Descartar cambios?".
- **FE-64:** Reorder de atributos vía drag-and-drop. Actualiza el campo `ordinal` localmente. El campo no se envía al backend si solo cambió el orden de items que no se persistieron (lo cual implica que el ordinal debe actualizarse en BD para todos los atributos cuyo ordinal cambió respecto al estado original).

### 6.2.3 `AttributeRow` — Fila editable

Componente que renderiza una fila con inputs inline para `name`, `data_type`, `required`, `is_unique`, `is_business_key`, `default_value`. Más botones de eliminar y duplicar.

- **FE-65:** `data_type` es un `<Select>` con los valores del catálogo de Definición de Metadata §6.3.1.
- **FE-66:** Si `data_type` cambia a uno con conversión destructiva sobre un atributo existente (ej. `string → integer`), el `EntityDetail` debe marcarlo y añadir `confirm_destructive: true` en la operación correspondiente del batch (con confirmación previa al usuario).

## 6.3 Reglas del módulo

- **FE-70:** Al cargar la lista o el detalle, mostrar siempre el `updated_at` formateado relativo ("hace 2 horas") con tooltip de fecha absoluta.
- **FE-71:** El `object_name` no se puede cambiar después de creado en MVP (no hay rename de tablas físicas). La UI lo muestra como readonly en edit.
- **FE-72:** El `mode` (`greenfield` / `brownfield`) no se puede cambiar después de creado. Readonly en edit.

---

# 7. Módulo Formularios

## 7.1 Propósito

Diseñar formularios visuales que el motor de runtime ejecutará para capturar datos. Cada formulario está asociado a una entidad y referencia atributos de esa entidad.

## 7.2 Pantallas

### 7.2.1 `FormList` — Listado

- **Ruta:** `/forms`.
- **Datos:** `useReadMetadata<FormDefinition>({ objectType: 'form_definition' })`.
- **UI:** tabla con `name`, `entity_ref` (resuelto a nombre legible de la entidad), `form_type`, `updated_at`.
- **Filtros:** dropdown para filtrar por entidad.

### 7.2.2 `FormDesigner` — Diseñador visual

- **Ruta:** `/forms/:id` o `/forms/new`.
- **Layout de tres paneles:**

```
┌──────────────┬─────────────────────────┬──────────────────┐
│              │                         │                  │
│  Paleta de   │   Canvas del            │   Propiedades    │
│  componentes │   formulario            │   del campo      │
│              │                         │   seleccionado   │
│  - Text      │   [Field 1]             │                  │
│  - Number    │   [Field 2]             │   - name         │
│  - Date      │   [Field 3]             │   - label        │
│  - Lookup    │                         │   - required     │
│  - Select    │                         │   - validation   │
│              │                         │                  │
└──────────────┴─────────────────────────┴──────────────────┘
```

- **Paleta:** lista de tipos de componente del `ComponentRegistry`. En MVP: `text_input`, `number_input`, `date_picker`, `lookup`, `select`, `textarea`, `checkbox`.
- **Canvas:** lista vertical de fields, drag-and-drop para reordenar. Click selecciona uno.
- **Panel de propiedades:** form RHF con las propiedades del field seleccionado.

**Comportamiento:**

- **FE-80:** Al añadir un field, se inicializa con un `attribute_ref` vacío. La UI exige seleccionar a qué atributo de la entidad referencia antes de guardar (VR-20).
- **FE-81:** El selector de `attribute_ref` muestra atributos de la entidad del formulario (cargada con `useReadMetadata<Entity>({ objectType: 'entity', id: form.content.entity_ref, hydrate: true })`).
- **FE-82:** Al guardar, persist con `update form_definition` que sobrescribe `content.fields[]` completo. No hay diff fino de fields (más simple, y los formularios no son tan grandes como para que importe).
- **FE-83:** Preview en vivo (`FormPreview`) que renderiza el formulario en una pestaña aparte usando los mismos componentes que `TaskExecutionForm` usará en runtime.

### 7.2.3 `FormFieldEditor` — Editor de field individual

Componente del panel de propiedades. Render condicional según `component_type`. Cada tipo tiene su set de props editables.

- **FE-84:** El catálogo de componentes y sus props vive en `src/features/forms/componentRegistry.ts`. Es código TypeScript (no metadata) en MVP. La especificación formal del ComponentRegistry como artefacto del SRS se difiere a v1.2.

## 7.3 Reglas del módulo

- **FE-90:** Cuando se elimina un atributo de la entidad asociada al formulario, los fields que lo referenciaban quedan "rotos" (apuntan a un `attribute_ref` inexistente). El form_designer detecta esto y muestra un warning sobre cada field roto, ofreciendo eliminarlo o re-mapearlo.
- **FE-91:** Si el `form_type` es `list_search`, la UI exige completar `pagination` y `search.mode` (VR-21).
- **FE-92:** Cambios destructivos sobre forms publicados que estén siendo usados por procesos activos requieren confirmación (la UI consulta primero qué procesos los usan).

---

# 8. Módulo Procesos

## 8.1 Propósito

Diseñar procesos visuales como grafos de nodos y transiciones. El canvas usa **React Flow**.

## 8.2 Pantallas

### 8.2.1 `ProcessList` — Listado

- **Ruta:** `/processes`.
- **Datos:** `useReadMetadata<ProcessDefinition>({ objectType: 'process_definition' })`.
- **UI:** tabla con `name`, `status` (`draft` / `configured`), número de nodos (badge), `updated_at`, acciones (editar, iniciar instancia, ver instancias).

### 8.2.2 `ProcessDetail` — Diseñador con canvas

- **Ruta:** `/processes/:id` o `/processes/new`.
- **Layout:** canvas central + paneles laterales.

```
┌──────────────┬─────────────────────────┬──────────────────┐
│              │                         │                  │
│  Paleta de   │   Canvas React Flow     │   Propiedades    │
│  nodos       │                         │   del nodo /     │
│              │   [start] ──▶ [task1]   │   transición     │
│  - Start     │                  │      │   seleccionado   │
│  - End       │                  ▼      │                  │
│  - Human     │            [task2] ─▶ [end]                │
│    task      │                         │                  │
│  - Script    │                         │                  │
│    task ⚠    │                         │                  │
│  - Gateway ⚠ │                         │                  │
│              │                         │                  │
└──────────────┴─────────────────────────┴──────────────────┘
```

- **Paleta:** muestra los 5 tipos de nodo del catálogo. Los tipos no soportados en runtime MVP (`script_task`, `exclusive_gateway`) se muestran con un badge de advertencia ⚠ "No ejecutable en MVP".
- **Canvas:** React Flow con custom node types. Drag-drop desde la paleta crea un nodo. Click selecciona. Edges (transiciones) se crean conectando handles de salida con handles de entrada.
- **Panel de propiedades:** muestra props del nodo o transición seleccionado:
  - Nodo: `name`, `description`, `config` específica del tipo.
  - Transición: `label`, `condition` (texto libre en MVP, advertencia de que no se ejecuta).

**Comportamiento:**

- **FE-100:** El estado del canvas (nodos, transiciones, posiciones) se guarda en estado local del componente (React state). Al pulsar "Guardar", se construye el batch:
  - Nodos añadidos: `create node` por cada uno.
  - Nodos modificados: `update node`.
  - Nodos eliminados: `delete node`.
  - Transiciones: viven inline en `content.transitions[]` del `process_definition`, así que se persisten como un `update process_definition`.
  - Cambio de `status` (draft → configured): incluido en el `update process_definition`.
- **FE-101:** Las posiciones (`position_x`, `position_y`) se persisten en cada nodo. Se actualizan cuando el usuario los arrastra.
- **FE-102:** Las transiciones son edges de React Flow. Cada edge tiene `source_node_id`, `target_node_id`, `label`, `condition`.
- **FE-103:** Al intentar pasar el proceso a `status='configured'`, el frontend valida en cliente las reglas VR-25 a VR-30 ANTES de mandar al backend. Si fallan, muestra los errores sin disparar el persist. Esto ahorra round-trips y da feedback inmediato.
- **FE-104:** Si el usuario añade un `script_task` o `exclusive_gateway`, o llena una `condition` no vacía en una transición, la UI muestra un banner persistente en la parte superior: "Este proceso contiene elementos no ejecutables en el motor MVP. Se podrá guardar pero no instanciar."
- **FE-105:** Acción "Iniciar instancia" disponible solo si el proceso está en `status='configured'`. Despacha `useStartProcess()` con `initial_context` que el usuario llena en un modal previo.

### 8.2.3 Custom nodes de React Flow

Cada tipo de nodo es un componente:

- **`StartNode`:** círculo verde, un handle de salida (derecho).
- **`EndNode`:** círculo rojo, un handle de entrada (izquierdo).
- **`HumanTaskNode`:** rectángulo redondeado, dos handles (entrada izquierda, salida derecha), muestra nombre + form asociado.
- **`ScriptTaskNode`:** rectángulo, dos handles, badge "⚠ MVP".
- **`ExclusiveGatewayNode`:** rombo, múltiples salidas, badge "⚠ MVP".

- **FE-110:** Cada custom node implementa la interfaz `NodeProps<TData>` de React Flow. Estilo con Tailwind classes.
- **FE-111:** Los nodos `script_task` y `exclusive_gateway` son **arrastrables y editables** (la UI los soporta plenamente), pero llevan badge de advertencia visualmente.

## 8.3 Reglas del módulo

- **FE-120:** El canvas mantiene undo/redo locales (mínimo 20 niveles). No se persiste el historial al guardar; al recargar la página, el historial se pierde.
- **FE-121:** Auto-save deshabilitado en MVP. Solo persiste con click explícito en "Guardar".
- **FE-122:** El zoom y pan del canvas se persiste localmente en `localStorage` por proceso (clave `process-{id}-viewport`) para que al reabrir el usuario vea el mismo encuadre.

---

# 9. Módulo Tareas

## 9.1 Propósito

Bandeja de tareas pendientes para el usuario (o globales en MVP sin auth), y ejecución de tareas individuales con el formulario asociado.

## 9.2 Pantallas

### 9.2.1 `TaskInbox` — Bandeja

- **Ruta:** `/tasks`.
- **Datos:** `useMyTasks()` que pide `GET /api/tasks/me`.
- **UI:** lista de cards o tabla con columnas: título, proceso, estado, antigüedad, asignación, botón "Abrir".

**Comportamiento:**

- **FE-130:** Polling cada 30s para detectar tareas nuevas (TanStack Query con `refetchInterval: 30_000`).
- **FE-131:** Si lista vacía, mostrar `<EmptyState />` con "No tienes tareas pendientes".
- **FE-132:** Click en una tarea navega a `/tasks/{id}`.
- **FE-133:** Botón "Tomar" (si está `pending` y `assigned_to` es NULL o coincide con el usuario actual) despacha `useClaimTask()`. Tras éxito, refetch de la bandeja.

### 9.2.2 `TaskExecutionForm` — Ejecutar tarea

- **Ruta:** `/tasks/:id`.
- **Datos:** carga la task individual (vía `useMyTasks()` filtrando o un futuro endpoint `GET /api/tasks/{id}`; en MVP se asume que la bandeja trae lo suficiente) + carga el `form_definition` asociado (`useReadMetadata`).
- **UI:** título de la tarea + form generado dinámicamente desde el `form_definition`.

**Comportamiento:**

- **FE-140:** El formulario se construye dinámicamente: por cada `FormField`, renderiza el componente correspondiente del `componentRegistry` con sus props.
- **FE-141:** Validación con Zod schema generado dinámicamente desde los `FormField` + el `data_type` del `attribute_ref` correspondiente.
- **FE-142:** Al pulsar "Completar", despacha `useCompleteTask()` con `submitted_data` (los valores del form) y opcionalmente `context_updates` (mapeo de campos a variables del contexto del proceso).
- **FE-143:** Tras completar exitosamente, redirigir al detalle de la instancia (`/instances/{process_instance_id}`) para que el usuario vea el avance.
- **FE-144:** Si el backend responde 409 `task_already_completed`, mostrar mensaje "Esta tarea ya fue completada por otra persona" y redirigir a la bandeja.
- **FE-145:** Si el backend responde 422 con `details` por campo, mapear cada `details[i].field` al input correspondiente del formulario y mostrar el `message`.

## 9.3 Reglas del módulo

- **FE-150:** Si una tarea fue `claimed` por otro usuario mientras el actual la estaba mirando, la UI se entera al próximo polling (30s) y muestra un banner discreto "Esta tarea fue tomada por otro". El usuario puede salir o seguir viéndola en modo readonly.
- **FE-151:** El formulario soporta "Guardar borrador" en localStorage por tarea (`task-{id}-draft`) para que un usuario que cierra el navegador no pierda lo escrito. El borrador se limpia al completar.

---

# 10. Módulo Instancias

## 10.1 Propósito

Ver el estado de instancias de proceso en curso o completadas: historial de nodos recorridos, contexto actual, tareas activas.

## 10.2 Pantallas

### 10.2.1 `InstanceDetail` — Detalle de instancia

- **Ruta:** `/instances/:id`.
- **Datos:** `useInstance(id)` que pide `GET /api/instances/{id}`.
- **UI:** tres secciones:
  1. **Cabecera:** nombre del proceso, status (badge color), started_at, completed_at (si aplica).
  2. **Historial:** timeline vertical con cada `node_instance` (orden ascendente por `sequence_number`).
  3. **Contexto:** tabla de variables con `name`, `value`, `data_type`, `set_at`.
  4. **Tareas activas:** si las hay, listadas con link al `TaskExecutionForm`.

**Comportamiento:**

- **FE-160:** Polling cada 15s mientras `status='running'`. Si `completed`, detener polling.
- **FE-161:** Si la instancia falló (`status='failed'`), mostrar `error_message` prominentemente con explicación legible. Para errores conocidos (`reconciliation_irreparable`, `unsupported_node_type_at_runtime`), mostrar texto explicativo en lugar del código crudo.
- **FE-162:** Botón "Cancelar instancia" disponible si `status='running'`. (Aclaración MVP: el endpoint de cancelación no está en los 8 endpoints; este botón queda visualmente pero deshabilitado con tooltip "Disponible en v1.2".)

## 10.3 Reglas del módulo

- **FE-170:** El historial muestra duración aproximada de cada nodo (`entered_at` a `completed_at`). Para el nodo activo (no completado), muestra "en curso desde X".
- **FE-171:** Los valores del contexto que son objetos JSON se muestran como JSON formateado con resaltado.

---

# 11. Componentes UI base

`src/ui/` provee primitivas reusables. Todas siguen estos principios:

- **Accesibilidad:** roles ARIA correctos, focus management, navegación por teclado.
- **Composición:** pequeños, componibles, sin lógica de negocio.
- **Sin librería externa:** Tailwind classes + comportamiento custom.

## 11.1 Inventario MVP

| Componente | Uso | Props clave |
| --- | --- | --- |
| `<Button>` | Botones primarios, secundarios, danger | `variant`, `size`, `loading`, `disabled`, `onClick` |
| `<Input>` | Input de texto, número | `type`, `value`, `onChange`, `error`, `label`, `placeholder` |
| `<Select>` | Dropdown | `options`, `value`, `onChange`, `placeholder` |
| `<Checkbox>` | Booleano | `checked`, `onChange`, `label` |
| `<TextArea>` | Texto largo | `value`, `onChange`, `rows` |
| `<Modal>` | Diálogos modales | `open`, `onClose`, `title`, `children`, `footer` |
| `<Drawer>` | Paneles laterales | `open`, `onClose`, `side`, `title` |
| `<Table>` | Tablas con columnas | `columns`, `rows`, `onRowClick`, `emptyState` |
| `<Toast>` | Notificaciones efímeras (vía sonner) | n/a |
| `<Spinner>` | Loading indicators | `size`, `label` |
| `<EmptyState>` | Estados vacíos | `icon`, `title`, `description`, `action` |
| `<ErrorBoundary>` | Captura errores de React | Wrap top-level |
| `<Badge>` | Etiquetas de estado | `variant`, `children` |
| `<ConfirmDialog>` | Confirmaciones destructivas | `title`, `message`, `onConfirm`, `onCancel` |

## 11.2 Estilos y tema

- **FE-180:** Tailwind tema base, paleta de colores definida en `tailwind.config.js`: gris-pizarra para superficies, azul para acciones primarias, rojo para destructivo, verde para éxito, ámbar para advertencias.
- **FE-181:** Tipografía: `font-sans` por default (system fonts), `font-mono` para identificadores técnicos y JSON.
- **FE-182:** Diseño consistente: spacing en múltiplos de 4px (Tailwind default), radios de borde uniformes (`rounded-md` por default), shadows discretas.

---

# 12. Manejo de estado: server vs UI

## 12.1 Server state (TanStack Query)

Todo lo que viene del backend:

- Lista de entidades, atributos, formularios, procesos, nodos, templates.
- Detalle hidratado de cualquier objeto.
- Estado de instancia.
- Bandeja de tareas.
- Health del backend.

Reglas:

- **FE-190:** `staleTime: 30s` por default. Configurable por query (ej. bandeja de tareas con `refetchInterval: 30_000`).
- **FE-191:** Mutations invalidan queries afectadas en `onSuccess`. Cada feature documenta qué invalida en su hook.
- **FE-192:** Sin optimistic updates en MVP excepto en operaciones triviales (claim de tarea).

## 12.2 UI state (Context API + useState)

Lo que no se persiste en backend:

- Qué tab está activo dentro de un módulo.
- Qué nodo está seleccionado en el canvas.
- Estado de modales (`open` / `closed`).
- Estado de formularios en edición (gestionado por React Hook Form).
- Filtros y ordenamiento de listas.
- Draft local de tareas (en `localStorage`).

Reglas:

- **FE-200:** Estado local a un componente: `useState`.
- **FE-201:** Estado compartido entre varios componentes hermanos: lifting + props.
- **FE-202:** Estado app-wide (poco en MVP): un único `AppContext` simple, no varios contexts.

---

# 13. Validación con Zod

## 13.1 Patrón

Cada feature define sus schemas Zod en `schemas.ts`. Se reusan para:

- Validación de formularios con React Hook Form (`zodResolver`).
- Tipado de datos: `type Entity = z.infer<typeof EntitySchema>`.
- Parseo defensivo de respuestas del backend (opcional pero recomendado para detectar drift de contrato).

## 13.2 Reglas a validar en cliente

| Regla | Dónde | Ejemplo |
| --- | --- | --- |
| VR-40 (snake_case) | Todos los `name` técnicos | Regex `^[a-z][a-z0-9_]{0,62}$` |
| VR-41 (palabras reservadas SQL) | Todos los `name` técnicos | Lista negra hardcodeada en `lib/reservedWords.ts` |
| VR-25 (un solo start por proceso) | Canvas del diseñador | Antes de marcar `configured` |
| VR-26 (al menos un end por proceso) | Canvas | Antes de `configured` |
| VR-28 (start sin entrada, end sin salida) | Canvas | Al conectar edges |
| Tipos de `data_type` válidos | Selector de atributos | Dropdown limitado al catálogo |
| Required en formularios | `react-hook-form` + Zod | Schema `z.string().min(1)` |

- **FE-210:** El cliente valida lo que puede pero el backend es la fuente de verdad. Si una validación pasa en cliente y falla en servidor (porque el backend tiene más contexto), la UI muestra el error del servidor sin distinción.

---

# 14. Logging y debugging

## 14.1 Console logger

`src/lib/logger.ts`:

```ts
const levels = ['debug', 'info', 'warn', 'error'] as const;
const minLevel = levels.indexOf(env.VITE_LOG_LEVEL);

export const logger = {
  debug: (...args: unknown[]) => minLevel <= 0 && console.debug(...args),
  info: (...args: unknown[]) => minLevel <= 1 && console.info(...args),
  warn: (...args: unknown[]) => minLevel <= 2 && console.warn(...args),
  error: (...args: unknown[]) => minLevel <= 3 && console.error(...args),
};
```

- **FE-220:** Cada request HTTP logea en debug: `[req] POST /api/persist [correlation_id]`.
- **FE-221:** Cada response logea en debug: `[res] 200 OK 234ms [correlation_id]`.
- **FE-222:** Cada error 5xx logea en error con stack.

## 14.2 DevTools

- **FE-223:** TanStack Query DevTools incluidos solo en modo desarrollo (`if (import.meta.env.DEV) ...`).

---

# 15. Manejo de errores

## 15.1 Estrategia

Tres niveles:

1. **Errores de validación del backend (422)**: se muestran en el formulario que los disparó. Detalles por campo se mapean a `<Input>` correspondiente.
2. **Errores de conflicto (409)**: toast + acción sugerida (recargar, cancelar).
3. **Errores inesperados (500/503)**: toast con mensaje genérico + `correlation_id` para soporte.

## 15.2 Reglas

- **FE-230:** Nunca mostrar stack traces al usuario.
- **FE-231:** Para errores 500/503, el botón "Mostrar detalles" abre un modal con `correlation_id`, hora, ruta, método. El usuario puede copiar el correlation_id para soporte.
- **FE-232:** Toast errors persisten 5s por default; toast de éxito 3s. Click cierra inmediatamente.
- **FE-233:** Si el backend está caído (health falla), mostrar pantalla full-page de "Servicio no disponible" con botón de reintento. Esto evita que el usuario interactúe con una UI que no funcionará.

---

# 16. Performance y carga

## 16.1 Code splitting

- **FE-240:** Cada feature se carga vía `lazy` + `Suspense`:

```tsx
const EntityList = lazy(() => import('@/features/entities/EntityList'));
```

Las rutas de React Router muestran un `<Spinner />` mientras se carga el chunk.

## 16.2 Caching de queries

- **FE-241:** `staleTime: 30s` global. Listas de metadata casi siempre se sirven del cache durante navegación.
- **FE-242:** `gcTime: 5min` global. Queries no usadas se eliminan del cache.

## 16.3 Tamaño del bundle

- **FE-243:** Bundle inicial (sin React Flow ni canvas) ≤ 250kb gzipped.
- **FE-244:** Chunk de `processes/` (incluye React Flow) ≤ 350kb gzipped y se carga lazy.

## 16.4 Targets de performance

| Métrica | Target |
| --- | --- |
| First Contentful Paint | < 1.5s en red 4G |
| Time to Interactive | < 3s en red 4G |
| Latencia percibida en interacciones | < 100ms |
| Canvas de React Flow con 50 nodos | 60fps en pan/zoom |

---

# 17. Build y deployment

## 17.1 Build

```bash
npm run build
```

Produce un directorio `dist/` con HTML, JS, CSS, assets. Es estático: no requiere servidor Node.

## 17.2 Servir

El operador despliega `dist/` detrás de un web server (nginx, Caddy, etc.) con:

- HTTPS (terminación TLS en el web server, no en el frontend).
- Fallback a `index.html` para todas las rutas (React Router maneja la navegación cliente).
- Headers de cache apropiados (HTML sin cache, JS/CSS con hash en filename y cache de 1 año).

## 17.3 Configuración por entorno

Variables `VITE_*` se inyectan en build time. Para distintos entornos:

- **Desarrollo**: `.env.development` (autocompletado por Vite).
- **Producción**: variables se pasan al comando de build.

```bash
VITE_API_BASE_URL=https://api.example.com/api npm run build
```

---

# 18. Requisitos no funcionales

| Categoría | Requisito |
| --- | --- |
| **Accesibilidad** | WCAG 2.1 AA en componentes base (`ui/`). Navegación por teclado en todas las pantallas. Roles ARIA correctos. |
| **Browser support** | Últimas 2 versiones de Chrome, Edge, Firefox, Safari. Sin soporte IE. |
| **Resolución** | Optimizado para desktop ≥ 1280px. Funcional en 1024px. No optimizado para móvil en MVP. |
| **Performance** | Ver §16.4. |
| **Seguridad** | Sin secretos en el bundle (auth viene en v1.2). Sanitización de HTML en cualquier dato que se renderice (React lo hace por default; cuidar `dangerouslySetInnerHTML`). |
| **Mantenibilidad** | TypeScript strict mode. ESLint + Prettier configurados. Cero `any`. Tests unitarios en hooks y utilidades clave. |
| **Observabilidad cliente** | Logger configurable por nivel. Correlation IDs en cada request. |

---

# 19. Asumpciones y temas abiertos

- **A-01.** El backend es estable y los contratos del API no cambian entre releases sin coordinación. Drift de contrato puede causar errores silenciosos; mitigación: parseo defensivo de respuestas con Zod en endpoints críticos.
- **A-02.** El `VITE_USER_ID` se configura en build time o en deployment. No hay UI para cambiarlo en runtime. Cuando llegue auth real, el header se obtiene del JWT y esta variable desaparece.
- **A-03.** No hay multi-proyecto en frontend MVP. La app carga el único proyecto configurado en el backend. Cuando llegue el módulo administrativo, se añade un selector de proyecto en el TopBar que envía el header `X-Project-Id`.
- **A-04.** El polling de `/tasks/me` (30s) y `/instances/{id}` (15s) puede causar tráfico significativo con muchos usuarios concurrentes. Se reemplaza por WebSockets / SSE en v1.2 si métricas reales lo justifican.
- **A-05.** El `componentRegistry` para FormFields vive en código TypeScript en MVP, no en BD. Cambios al registry requieren rebuild del frontend.
- **A-06.** La validación cliente del proceso completo (VR-25 a VR-30) se replica en backend; mantener ambas en sync es trabajo manual. En v1.2 podría centralizarse vía JSON Schema compartido.
- **A-07.** El frontend no implementa caché offline (Service Worker). Una desconexión causa que las queries fallen y la UI se quede en estado de error hasta reconexión.

---

# 20. Out of scope (v1.0)

- Autenticación, login, gestión de sesión.
- Selector de proyecto (multi-proyecto).
- Soporte para `script_task`, `exclusive_gateway` y `condition` **en ejecución** (sí en diseño con advertencia).
- Brownfield: pantalla de ingesta de tabla existente.
- Templates: pantalla de aplicar template del catálogo central.
- Dashboard analítico, reportes.
- Notificaciones push (in-app, email, webhooks).
- WebSockets / SSE para actualizaciones en tiempo real.
- Modo offline / Service Worker.
- i18n (multi-idioma).
- Soporte móvil pleno.
- Audit log visual de operaciones.
- Comparación de versiones de procesos / diff visual.
- Importación/exportación de proyectos.
- Reasignación, escalado, delegación de tareas.

---

# 21. Historial de versiones

| Versión | Fecha | Descripción |
| --- | --- | --- |
| 1.0 | Mayo 2026 | SRS inicial del Frontend del MVP de Workflow Platform. Single Page Application en React 18 + TypeScript + Vite con stack: TanStack Query para server state, Context API + useState para UI state, React Hook Form + Zod para formularios, React Flow para el canvas de procesos, React Router v6 para routing, Tailwind CSS para styling (sin librería de componentes), Lucide React para iconos y sonner para notificaciones. Estructura organizada por feature (`features/entities`, `features/forms`, `features/processes`, `features/tasks`, `features/instances`) con capa `api/` plana de hooks de TanStack Query, capa `ui/` de primitivas reusables y capa `lib/` de utilidades transversales. Cinco módulos funcionales: Entidades (CRUD con atributos editables in-line y batch atómico), Formularios (diseñador visual de tres paneles con paleta + canvas + propiedades), Procesos (canvas con React Flow extensible y custom nodes para start, end, human_task, script_task y exclusive_gateway, marcando los dos últimos con badge ⚠ "No ejecutable en MVP"), Tareas (bandeja con polling, claim y ejecución de formulario dinámico) e Instancias (detalle con historial, contexto y tareas activas). Consume los 8 endpoints del Backend MVP con manejo uniforme de errores (mapeo de 422 a fields, 409 con acción sugerida, 500/503 con correlation_id para soporte). Sin autenticación; `X-User-Id` opcional desde variable de entorno. Build estático servido por web server externo (nginx/Caddy) con fallback a `index.html` para rutas cliente. Code splitting por feature, targets de performance documentados (FCP < 1.5s, TTI < 3s, 60fps en canvas con 50 nodos). Define ~60 reglas frontend numeradas FE-NN cubriendo cliente HTTP, routing, comportamiento por módulo, validación, manejo de estado, errores, performance y deployment. Deja explícitamente fuera de alcance: auth, multi-proyecto, ejecución de script_task/gateway/condition, brownfield, templates, dashboards analíticos, WebSockets, modo offline, i18n, soporte móvil pleno. |

*— Fin del documento —*

Confidencial · Mayo 2026 · Workflow Platform · SRS Frontend v1.0