# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Workflow Platform is a **low-code SPA** for designing and executing business processes (workflows, forms, entities). Built as a UI-first MVP — the backend is simulated entirely by MSW (Mock Service Worker) so the interface can be validated and iterated independently.

Primary documentation lives in `docs/`. When in doubt about product requirements, business rules, or API contracts, **consult the docs first**. If doubt persists and user input is needed, always present the options the documentation recommends.

Key docs:
- `docs/Workflow_Platform_Frontend_SRS_v1_0.md` — frontend requirements, routes, component specs, validation rules
- `docs/Workflow_Platform_UX_Spec_v1_0.md` — design system (tokens, typography, layout patterns, interaction spec)
- `docs/Workflow_Platform_Vision_v1_0.md` — product vision, MVP scope, success criteria
- `docs/Workflow_Platform_Backend_SRS_v1_1.md` — API contracts (the 8 endpoints MSW must simulate)
- `docs/Metadata_Definition_WorkflowPlatform_v1_1.md` — domain entity shapes and JSON schemas
- `docs/Workflow_Platform_Physical_Data_Model_v1_1.md` — entity relationships and attribute definitions
- `docs/pendientes.md` — open decisions and deferred items

## Commands

```bash
npm run dev          # start dev server (MSW auto-starts in browser)
npm run build        # typecheck + vite build
npm run typecheck    # tsc --noEmit (no emit, full strict check)
npm run lint         # eslint with --max-warnings 0
npm run lint:fix     # eslint --fix
npm run format       # prettier write src/**/*.{ts,tsx,css}
npm run format:check # prettier check (used in CI)
npm run test         # vitest run (single pass)
npm run test:watch   # vitest watch mode
npm run test:e2e     # playwright test
```

Run a single test file:
```bash
npx vitest run src/features/processes/validation.test.ts
```

Run a single Playwright spec:
```bash
npx playwright test e2e/entities.spec.ts
```

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript 5 (strict) |
| Build | Vite 5 |
| Routing | React Router 6 (`createBrowserRouter`) |
| Server state | TanStack Query 5 |
| Client state | Zustand 5 |
| Forms | React Hook Form 7 + Zod 3 |
| Canvas | React Flow 11 (custom nodes) |
| Drag & drop | @dnd-kit/core + @dnd-kit/sortable |
| Styling | Tailwind CSS 3 + CSS custom properties (tokens) |
| Icons | Lucide React |
| Notifications | sonner |
| Mock API | MSW 2 (browser service worker) |
| Testing | Vitest + @testing-library/react; Playwright for e2e |

## Architecture

### Source layout

```
src/
  app/           # router, queryClient, AppShell, useTheme
  features/      # one folder per module (entities, forms, processes, tasks, instances)
  ui/            # shared primitive components (Button, Modal, Table, Badge, …)
  api/
    types/       # TypeScript interfaces for all domain entities and DTOs
    queries/     # TanStack Query hooks (useRead, usePersist, useMyTasks, …)
  mocks/
    browser.ts   # MSW worker setup
    handlers/    # one file per API endpoint group
    fixtures/    # JSON seed data (vacation_management demo project)
  lib/           # pure utilities: zod schemas, formatters, cn()
  styles/
    tokens.css   # CSS custom properties for dark + light themes
  test/
    setup.ts     # @testing-library/jest-dom
```

### Theme system

Design tokens are CSS custom properties defined in `src/styles/tokens.css`. Dark mode is applied via the `.dark` class on `<html>` (toggled by `src/app/useTheme.ts`). Tailwind's `darkMode: 'class'` is set, but most color values reference `var(--token-name)` directly so they respond to the class automatically without Tailwind dark-mode variants.

Color palette, typography scale, spacing, and node/attribute type colors all come from `docs/Workflow_Platform_UX_Spec_v1_0.md §3`.

### API layer (MSW mock)

All backend calls go through 8 endpoints (SRS Backend §4). In dev, MSW intercepts them:

| Hook | Endpoint |
|------|---------|
| `useRead` | `GET /api/read?object_type=…` |
| `usePersist` | `POST /api/persist` (batch create/update/delete) |
| `useStartInstance` | `POST /api/processes/{id}/instances` |
| `useInstance` | `GET /api/instances/{id}` |
| `useMyTasks` | `GET /api/tasks/me` |
| `useClaimTask` | `POST /api/tasks/{id}/claim` |
| `useCompleteTask` | `POST /api/tasks/{id}/complete` |
| `useHealth` | `GET /api/health` |

MSW handlers live in `src/mocks/handlers/`. Each handler file maps to one endpoint group. Fixtures in `src/mocks/fixtures/` are JSON files validated against Zod schemas at startup.

MSW mock state is persisted to `localStorage` so it survives page reloads during demos. A `window.resetMocks()` helper resets it to the seed fixtures.

### Domain types (`src/api/types/`)

All entities from `docs/Metadata_Definition_WorkflowPlatform_v1_1.md`:
- Metadata artefacts: `RootProject`, `Entity`, `Attribute`, `FormDefinition`, `FormField`, `ProcessDefinition`, `Node`
- Runtime: `ProcessInstance`, `NodeInstance`, `Task`, `ContextVariableValue`
- Enums: `ObjectType`, `DataType`, `NodeType`, `ComponentType`, `TaskStatus`, `ProcessStatus`
- DTOs: `PersistOperation`, `PersistResponse`, `ReadResponse`, `ErrorResponse`

No `any` allowed (`@typescript-eslint/no-explicit-any: error`).

### Naming rules (VR-40)

All technical names (`object_name`, `attribute.name`, `node.name`) must match `^[a-z][a-z0-9_]{0,62}$`. Validate in the UI before persisting; the MSW handler also enforces this and returns 422 with `details[]`.

### Process canvas

`src/features/processes/canvas/` contains React Flow setup and 5 custom node types: `StartNode`, `EndNode`, `HumanTaskNode`, `ScriptTaskNode`, `ExclusiveGatewayNode`. The last two display a ⚠ badge ("no ejecutable en MVP") because the mock engine rejects them with `422 unsupported_node_type`.

Validation rules (VR-25 to VR-28) live in `src/features/processes/validation.ts` as pure functions — reused by both the canvas UI and the dry-run simulator.

### Success criteria (Vision §9)

The complete demo scenario is: create `employee` entity + `vacation_request` entity + `solicitud_form` + `aprobacion_form` + `vacation_approval` process (5 nodes) → start instance → complete 2 human tasks → view completed instance with timeline. This must be achievable in under 60 minutes by a first-time user.

## Implementation phases

See `C:\Users\andru\.claude\plans\vamos-a-concentrarnos-snug-quail.md` for the full phased plan. Current state: **Phase 0 (bootstrap) complete**. Next: Phase 1 — design system primitives + AppShell.

## Import alias

`@/` maps to `src/`. Example: `import { Button } from '@/ui/Button'`.
