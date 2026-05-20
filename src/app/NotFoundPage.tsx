export function NotFoundPage() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-display font-semibold text-[var(--text-primary)]">404</h1>
        <p className="mt-2 text-[var(--text-secondary)]">Página no encontrada.</p>
        <a href="/" className="mt-4 inline-block text-[var(--action-text)] underline">
          Volver al inicio
        </a>
      </div>
    </div>
  )
}
