const ZONA = 'America/Mexico_City'

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de México. */
export function hoyMexico(ahora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora)
}

export function fechaCorta(fecha: Date | string | null | undefined): string {
  if (!fecha) return ''
  const d =
    typeof fecha === 'string' ? new Date(fecha.length === 10 ? `${fecha}T12:00:00` : fecha) : fecha
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: ZONA,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function fechaHora(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: ZONA,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** "hoy", "ayer", "hace 3 días" o la fecha corta. */
export function relativo(fecha: Date | string, ahora = new Date()): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  const dias = Math.floor((hoyMs(ahora) - hoyMs(d)) / 86_400_000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  return fechaCorta(d)
}
const hoyMs = (d: Date) => new Date(`${hoyMexico(d)}T00:00:00Z`).getTime()
