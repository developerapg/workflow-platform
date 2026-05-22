# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 1. Project scope — read this first

This repository contains **only the frontend** of Workflow Platform: a React 18 + TypeScript SPA. The backend (.NET 9 + Dapper + PostgreSQL) and the admin catalog (auth, multi-tenancy) are **separate projects** and live outside this repo. They are documented in `docs/` because the frontend must consume their contracts, but they are **not implemented here**.

MSW (Mock Service Worker) lives in `src/mocks/` and exists **exclusively as a development aid** so the UI can be built and validated before the real backend exists. MSW is not "the backend" — it is a stand-in for the contracts documented in `docs/Workflow_Platform_Backend_SRS_v1_1.md`. When in doubt about endpoint shapes, the SRS Backend is the source of truth; MSW must match it, not the other way around.

**What this repo MUST do:** implement the frontend exactly as specified in the SRS Frontend, the UX Spec and the Process Designer SRS, against the API contract defined in SRS Backend.

**What this repo MUST NOT do:** invent backend behavior, define data model, change the metadata contract, add a real database layer, or implement auth flows beyond the placeholder defined in the Frontend SRS.

---

## 2. Documentation hierarchy — the docs are normative, not decorative

The product is **documentation-driven**. Every numbered rule (`FE-NN`, `PD-NN`, `VR-NN`, `RT-NN`, `BR-NN`, `AR-NN`, `FR-NN`) is a contract. Before writing or modifying any feature, read the relevant document and cite the rules you are implementing. If implementation deviates from a rule, the deviation must be either (a) explicitly justified in `docs/pendientes.md` as a deferred decision, or (b) corrected.

When two documents disagree, this is the precedence:

| For questions about… | Source of truth |
|---|---|
| Domain shapes, JSON signatures, validation rules `VR-NN` | `docs/Metadata_Definition_WorkflowPlatform_v1_1.md` (v1.1) |
| Product scope, what is in/out of the MVP, success criteria | `docs/Workflow_Platform_Vision_v1_0.md` |
| Visual language, interaction patterns, layouts, states | `docs/Workflow_Platform_UX_Spec_v1_0.md` |
| Frontend architecture, routes, modules, rules `FE-NN` | `docs/Workflow_Platform_Frontend_SRS_v1_0.md` |
| Process canvas behavior, rules `PD-NN` | `docs/Workflow_Platform_Process_Designer_SRS_v1_0.md` |
| API contract (8 endpoints), rules `BR-NN` | `docs/Workflow_Platform_Backend_SRS_v1_1.md` |
| Runtime rules `RT-NN`, physical model | `docs/Workflow_Platform_Physical_Data_Model_v1_1.md` |
| Auth, multi-tenancy, customers/projects/users, rules `AR-NN`/`FR-NN` | `docs/Workflow_Platform_Admin_Catalog_SRS_v1_0.md` |
| Deferred items `P-NNN` | `docs/pendientes.md` |

When the user asks for something ambiguous, **first read the docs and present the options that the documentation already recommends** before asking the user to decide. Do not invent answers the docs already give.

### 2.1 Documents the frontend OWNS (this repo implements them)

- **UX Spec v1.0** — every visual decision, interaction, color, typography, state badge and layout.
- **Frontend SRS v1.0** — all `FE-NN` rules. The architecture of this repo.
- **Process Designer SRS v1.0** — all `PD-NN` rules. Profundizes Frontend SRS §8.
- **Metadata Definition v1.1** — every TypeScript type in `src/api/types/` must match the JSON signatures here. Every `VR-NN` rule must be enforced in the UI as documented in SRS Frontend §13.

### 2.2 Documents the frontend CONSUMES but does NOT own

- **Backend SRS v1.1** — defines the 8 endpoints, request/response shapes, error codes. MSW must mimic these; the frontend must consume them as documented. Changing the contract here is out of scope for this repo.
- **Admin Catalog SRS v1.0** — defines login, project selector, member management. The frontend must implement the UI for these flows when the time comes, but the auth backend is a separate project. In MVP v1.0 of the frontend, auth is **deferred** (`X-User-Id` placeholder, see Frontend SRS §1.3 and §3.3 FE-03).
- **Physical Data Model v1.1** — the frontend never touches a DB. Referenced only because some `RT-NN` rules surface in the UI as error codes.

---

## 3. Commands

```bash
npm run dev          # Vite dev server; MSW auto-starts in the browser (dev only)
npm run build        # typecheck + vite build
npm run typecheck    # tsc --noEmit (strict)
npm run lint         # eslint --max-warnings 0
npm run lint:fix     # eslint --fix
npm run format       # prettier write src/**/*.{ts,tsx,css}
npm run format:check # prettier check (used in CI)
npm run test         # vitest run (single pass)
npm run test:watch   # vitest watch mode
npm run test:e2e     # playwright test
```

Single test file:
```bash
npx vitest run src/features/processes/validation.test.ts
npx playwright test e2e/entities.spec.ts
```

---

## 4. Stack

Per Frontend SRS §2.4:

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript 5 (strict, no `any`) |
| Build | Vite 5 |
| Routing | React Router 6 (`createBrowserRouter`) |
| Server state | TanStack Query 5 |
| Client state | Context API + `useState` (Frontend SRS FA1, §12.2) — **not Zustand globally**. Zustand may be used inside a single feature if the feature SRS authorizes it; the process designer uses React Flow's `useNodesState`/`useEdgesState` exposed via a local `DesignerContext` (PD-04). |
| Forms | React Hook Form 7 + Zod 3 |
| Canvas | React Flow 11.x (pinned `^11.11`, PD-02) |
| Drag & drop | @dnd-kit (forms designer); React Flow handles drag for canvas |
| Styling | Tailwind CSS 3 + CSS custom properties (UX Spec §3 tokens) |
| Icons | Lucide React |
| Notifications | sonner |
| Mock API (dev only) | MSW 2 |
| Testing | Vitest + Testing Library; Playwright for e2e |

---

## 5. Repository layout

Per Frontend SRS §2.3, with the Process Designer sub-structure of Process Designer SRS §2.3:

```
src/
  app/                       # router, queryClient, AppShell, useTheme
  api/
    client.ts                # fetch wrapper, X-Correlation-Id, error parsing
    types/                   # DTOs from Metadata v1.1 + Backend SRS
    queries/                 # TanStack Query hooks (one per backend endpoint)
  features/
    entities/                # EntityList, EntityDetail, AttributeRow, schemas.ts
    forms/                   # FormList, FormDesigner, FormFieldEditor, FormPreview
    processes/
      ProcessList.tsx
      ProcessDetail.tsx      # orchestrates the designer
      designer/              # PD-03: NORMATIVE sub-structure
        ProcessDesigner.tsx
        canvas/              # CanvasShell, CanvasToolbar, CanvasMinimap, canvasState.ts
        nodes/               # StartNode, EndNode, HumanTaskNode, ScriptTaskNode,
                             # ExclusiveGatewayNode, NodeShell, AddNodeButton, nodeRegistry.ts
        edges/               # TransitionEdge (smoothstep), edgeUtils.ts
        palette/             # NodePalette, PaletteCard
        properties/          # PropertiesPanel, NodeProperties, TransitionProperties
        validation/          # processRules.ts (VR-25..VR-31), useProcessValidation, nodeStatus
        persistence/         # designerToBatch.ts, batchToDesigner.ts
    tasks/                   # TaskInbox, TaskExecutionForm
    instances/               # InstanceDetail, InstanceHistory, ContextViewer
  ui/                        # Button, Input, Select, Modal, Drawer, Table, Badge,
                             # ConfirmDialog, Toast, Spinner, EmptyState, ErrorBoundary
  lib/                       # errors.ts, format.ts, logger.ts, ddl.ts, dataTypeColors.ts,
                             # reservedWords.ts, tempIds.ts
  mocks/
    browser.ts               # MSW worker setup (dev only)
    handlers/                # one file per endpoint group
    fixtures/                # JSON seed data (vacation_management demo)
  styles/
    tokens.css               # CSS custom properties from UX Spec §3.1
  test/
    setup.ts
```

`@/` is the alias for `src/` (e.g. `import { Button } from '@/ui/Button'`).

---

## 6. Design system — UX Spec is the law

Every visual and interaction decision derives from `docs/Workflow_Platform_UX_Spec_v1_0.md`. Do not invent tokens, spacings, or states. The following hard rules apply:

- **Dark + light mode are first-class** (UX Spec §3.1). `<html>` toggles `.dark`. Tailwind `darkMode: 'class'` is set, but components reference `var(--token-name)` directly so they respond to the class without `dark:` variants for every color.
- **Color tokens are NORMATIVE** (UX Spec §3.1.1–§3.1.5). Defined in `src/styles/tokens.css`. Do not hard-code hex values in components.
- **Color communicates state, not type** (UX Spec §2.2). Verde/ámbar/rojo/gris are reserved for `configurado / advertencia / error / sin configurar`. Type distinction (user task vs gateway, string vs integer) uses icons + textual badges + the semantic-free `type-*` colors of UX Spec §3.1.5.
- **Four canonical element states** (UX Spec §3.5): `configurado` / `advertencia` / `error` / `sin configurar` (dashed border, neutral). Every configurable card (a node, a process row, an attribute row) must visually reflect its state via border + glow + status dot + badge.
- **Two interaction modes** (UX Spec §2.1): **modo lista** (sidebar visible, filters, listings) and **modo concentración** (sidebar hidden, editor maximized). Each route is one or the other.
- **Typography scale** is fixed in UX Spec §3.2 — display 20px, H1 17–19, H2 14–15, body 13, small 12, caption 11, label 10 uppercase, mono 11–13, tiny 9–10.
- **Spacing** is in multiples of 4px (UX Spec §3.4). Radii: 4 / 6–8 / 10–12.
- **Icons**: Lucide (or Tabler), line style, weight 2, rounded.

---

## 7. API contract — 8 endpoints (Backend SRS §4)

The frontend consumes exactly these 8 endpoints. Hooks live in `src/api/queries/`. MSW handlers in `src/mocks/handlers/` simulate them in dev.

| Hook | Endpoint |
|------|---------|
| `useReadMetadata` | `GET /api/read?object_type=…&id=…&parent_id=…&hydrate=true` |
| `usePersist` | `POST /api/persist` (batch atomic create/update/delete; resolves `temp_id` aliases) |
| `useStartProcess` | `POST /api/processes/{id}/instances` |
| `useInstance` | `GET /api/instances/{id}` |
| `useMyTasks` | `GET /api/tasks/me` (polled every 30s per FE-130) |
| `useClaimTask` | `POST /api/tasks/{id}/claim` |
| `useCompleteTask` | `POST /api/tasks/{id}/complete` |
| `useHealth` | `GET /api/health` (gate on app boot per FE-02) |

Rules to honor in every hook:

- Every request carries `X-Correlation-Id` (FE-10).
- Errors flow through `BackendError` (`src/lib/errors.ts`); 422 maps to field-level form errors, 409 prompts reload, 5xx surfaces correlation_id (FE-30..FE-33).
- After a `persist` succeeds, the mutation invalidates queries for every `object_type` touched (FE-20).
- The frontend validates `VR-25..VR-31` and `VR-40..VR-41` **before** sending, but the server is the source of truth (FA5, FE-210).

When in MSW: handlers MUST return the same shapes the Backend SRS documents, including the `error.code` / `error.message` / `error.details[]` envelope.

---

## 8. Domain types — from Metadata v1.1

Types in `src/api/types/` are derived from `docs/Metadata_Definition_WorkflowPlatform_v1_1.md`. Cited by name:

- Design artefacts: `RootProject`, `Entity`, `Attribute`, `FormDefinition`, `FormField`, `ProcessDefinition`, `Node`, `Transition`, `ContextVariable`, `Template`.
- Runtime artefacts (consumed by the UI even though they live in `wf_runtime` server-side): `ProcessInstance`, `NodeInstance`, `Task`, `ContextVariableValue`.
- Enums: `ObjectType`, `DataType`, `NodeType`, `ComponentType`, `TaskStatus`, `ProcessStatus`, `FormType`.
- DTOs: `PersistOperation`, `OperationResult`, `PersistResponse`, `ReadResponse`, `ErrorResponse`.

`@typescript-eslint/no-explicit-any: error`. No `any` anywhere.

### 8.1 Naming and validation rules (frontend obligations)

The frontend must enforce these client-side (Frontend SRS §13.2). The server validates them again.

- **VR-40** (snake_case): every technical name (`object_name`, `attribute.name`, `node.name`) must match `^[a-z][a-z0-9_]{0,62}$`.
- **VR-41**: SQL reserved words are forbidden. Hardcoded list in `src/lib/reservedWords.ts`.
- **VR-25**: exactly one `start` node per process.
- **VR-26**: at least one `end` node per process.
- **VR-28**: `start` has no inbound edges, `end` has no outbound edges.
- **VR-20**: every FormField requires a non-empty `attribute_ref`.
- DataType catalog: enforced via `<Select>` constrained to Metadata §6.3.1.

---

## 9. Process designer — canonical reference is the PD SRS

`src/features/processes/designer/` follows `docs/Workflow_Platform_Process_Designer_SRS_v1_0.md` (rules `PD-NN`). Key obligations that have historically been missed:

- **React Flow 11.x pinned** (PD-01, PD-02). No alternative library.
- **Drag-and-drop from palette to canvas works** (`onDrop` + `onDragOver` + `screenToFlowPosition()`), **and** the **contextual "+" button on hover** of every node creates the next node and auto-links it (UX Spec §7.4, formalized as PD rules). Both paths coexist; "+" is the primary recommended path.
- **Handles on all four sides** (top/right/bottom/left) per node, with type-specific connection rules. Not a single fixed handle.
- **Smoothstep ortho edges with rounded corners**, not free Bézier curves.
- **Visual state per node** in real time: `configurado` / `advertencia` / `error` / `sin configurar` border + glow + dot, recomputed via `useProcessValidation`.
- **The 5 node types**: `start`, `end`, `human_task`, `script_task`, `exclusive_gateway`. The last two are designable but show ⚠ "no ejecutable en MVP" (FE-104, FE-111). The runtime rejects them at instantiation with `422 unsupported_node_type`.
- **Save is explicit** (FE-121, PD-06). No auto-save. Viewport persists in localStorage per process (FE-122, PD-07).
- **Canvas state is local to the designer** (PD-04) — not in a global store.

If the current code under `src/features/processes/canvas/` does not match this — and a recent review suggests it does not — that is technical debt to be reconciled, not an alternative spec.

---

## 10. Validation rules surface in the UI

Frontend SRS §13.2 enumerates which `VR-NN` rules the UI validates locally. Rules live in `src/features/processes/validation.ts` (process rules) and `src/features/{entities,forms}/schemas.ts` (Zod). They are **pure functions** so the dry-run simulator and the canvas share them.

Backend error codes the UI must handle explicitly: `unsupported_node_type`, `unsupported_transition_condition`, `concurrent_modification`, `task_already_completed`, `reconciliation_irreparable` (FE-32, FE-33, FE-144, FE-161).

---

## 11. Success criteria — Vision §9

The MVP is successful if a team member can, in under 1 hour and without writing code:

1. Design the data model (entities + attributes) for a vacation process.
2. Build the capture and approval forms.
3. Design the workflow with 4–5 nodes (start → captura → decisión jefe → decisión RRHH → end).
4. Run the dry-run end-to-end and reach `end` correctly on both "approved" and "rejected" paths.

The vacation demo fixture in `src/mocks/fixtures/` is the canonical reference scenario.

---

## 12. Working norms

- **Read the doc before coding.** Cite the rule numbers (`FE-NN`, `PD-NN`, `VR-NN`) you are implementing or relaxing. If a rule is being deferred, log it in `docs/pendientes.md` as a new `P-NNN`.
- **The doc wins.** If the code disagrees with the spec, the code is wrong (unless the deviation is recorded as a pendiente).
- **Match scope.** This repo is the frontend SPA. Do not implement backend logic. Do not invent data shapes.
- **Match the UX Spec exactly** for tokens, typography, states, layouts. Pixel-perfect is not required; **token-perfect** is.
- **No `any`.** Strict TS, ESLint `--max-warnings 0`.
- **Comments only when WHY is non-obvious.** Identifiers do the WHAT.
- **Do not create planning/analysis docs** unless asked. Use `docs/pendientes.md` for deferred decisions.

---

## 13. Implementation status

Phase 0 (bootstrap) is complete. The current code under `src/features/` (entities, forms, processes) is a first pass that **does not yet fully comply** with the UX Spec §3, the four-state visual system (UX Spec §3.5), the dual-mode navigation (UX Spec §2.1), or the Process Designer SRS (PD-NN rules — handles on 4 sides, contextual "+", drag-from-palette, smoothstep edges, real-time visual state). Reconciling the existing code with the specs is the active line of work.

When asked to "implement X" or "fix Y", first locate the relevant section in the docs, then identify the gap between current code and spec, then propose the minimal change that closes the gap.

---

## 14. Import alias

`@/` → `src/`. Example: `import { Button } from '@/ui/Button'`.
