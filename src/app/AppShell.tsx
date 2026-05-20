import { Outlet, NavLink } from 'react-router-dom'
import { Database, FileText, GitBranch, Inbox, Activity, Moon, Sun } from 'lucide-react'
import { useTheme } from './useTheme'

const NAV_ITEMS = [
  { to: '/entities', icon: Database, label: 'Entidades' },
  { to: '/forms', icon: FileText, label: 'Formularios' },
  { to: '/processes', icon: GitBranch, label: 'Procesos' },
  { to: '/tasks', icon: Inbox, label: 'Tareas' },
  { to: '/instances', icon: Activity, label: 'Instancias' },
] as const

export function AppShell() {
  const { theme, toggle } = useTheme()

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-canvas)]">
      {/* Sidebar */}
      <aside className="flex w-56 flex-shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        {/* Logo */}
        <div className="flex h-14 items-center border-b border-[var(--border-subtle)] px-4">
          <span className="text-h2 font-semibold text-[var(--text-primary)]">Workflow Platform</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-0.5" role="list">
            {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-2.5 rounded-md px-3 py-2 text-body transition-colors',
                      isActive
                        ? 'bg-[var(--action-bg-subtle)] text-[var(--action-text)] font-medium'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-primary)]',
                    ].join(' ')
                  }
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer: user + theme */}
        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-3 py-3">
          <span className="text-body-sm text-[var(--text-tertiary)]">Usuario demo</span>
          <button
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-primary)]"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
