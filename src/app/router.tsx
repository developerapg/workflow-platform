import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './AppShell'
import { DashboardPage } from './DashboardPage'
import { NotFoundPage } from './NotFoundPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      // Entities
      {
        path: 'entities',
        lazy: () => import('@/features/entities/EntityListPage').then((m) => ({ Component: m.default })),
      },
      {
        path: 'entities/new',
        lazy: () => import('@/features/entities/EntityDetailPage').then((m) => ({ Component: m.default })),
      },
      {
        path: 'entities/:id',
        lazy: () => import('@/features/entities/EntityDetailPage').then((m) => ({ Component: m.default })),
      },
      // Forms
      {
        path: 'forms',
        lazy: () => import('@/features/forms/FormListPage').then((m) => ({ Component: m.default })),
      },
      {
        path: 'forms/new',
        lazy: () => import('@/features/forms/FormDesignerPage').then((m) => ({ Component: m.default })),
      },
      {
        path: 'forms/:id',
        lazy: () => import('@/features/forms/FormDesignerPage').then((m) => ({ Component: m.default })),
      },
      // Processes
      {
        path: 'processes',
        lazy: () => import('@/features/processes/ProcessListPage').then((m) => ({ Component: m.default })),
      },
      {
        path: 'processes/new',
        lazy: () => import('@/features/processes/ProcessDesignerPage').then((m) => ({ Component: m.default })),
      },
      {
        path: 'processes/:id',
        lazy: () => import('@/features/processes/ProcessDesignerPage').then((m) => ({ Component: m.default })),
      },
      // Tasks
      {
        path: 'tasks',
        lazy: () => import('@/features/tasks/TaskInboxPage').then((m) => ({ Component: m.default })),
      },
      {
        path: 'tasks/:id',
        lazy: () => import('@/features/tasks/TaskExecutionPage').then((m) => ({ Component: m.default })),
      },
      // Instances
      {
        path: 'instances/:id',
        lazy: () => import('@/features/instances/InstanceDetailPage').then((m) => ({ Component: m.default })),
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])
