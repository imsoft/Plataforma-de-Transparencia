const TIME_ZONE = 'America/Mexico_City'

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de México. */
export function todayMexico(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function shortDate(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d =
    typeof date === 'string' ? new Date(date.length === 10 ? `${date}T12:00:00` : date) : date
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function dateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** "hoy", "ayer", "hace 3 días" o la fecha corta. */
export function relative(date: Date | string, now = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const days = Math.floor((todayMs(now) - todayMs(d)) / 86_400_000)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  return shortDate(d)
}
const todayMs = (d: Date) => new Date(`${todayMexico(d)}T00:00:00Z`).getTime()
