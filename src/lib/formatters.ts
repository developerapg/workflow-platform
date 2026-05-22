/** Relative time string for display, e.g. "hace 3 días" */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'hace un momento'
  const m = Math.floor(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `hace ${d} día${d !== 1 ? 's' : ''}`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `hace ${mo} mes${mo !== 1 ? 'es' : ''}`
  return `hace ${Math.floor(mo / 12)} año${Math.floor(mo / 12) !== 1 ? 's' : ''}`
}

/** Absolute date string for tooltip */
export function absoluteDate(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Duration between two ISO timestamps */
export function duration(from: string, to: string | null): string {
  if (!to) return `en curso`
  const ms = new Date(to).getTime() - new Date(from).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}
