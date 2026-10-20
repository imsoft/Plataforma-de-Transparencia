/**
 * Semáforo de cumplimiento (sección 5.2). Funciones puras sobre fechas de calendario (YYYY-MM-DD);
 * quien llama pasa "hoy" ya en America/Mexico_City. Umbrales configurables.
 */
import type { Frequency } from './format'

export type TrafficLightConfig = {
  /** Días después del fin del periodo para publicar (plazo legal, por confirmar con el supervisor). */
  graceDays: number
  /** Días antes del plazo en que se pone amarillo. */
  warningDays: number
  /** Cuántos periodos ya vencidos se revisan hacia atrás (un hueco en ellos = rojo). */
  reviewedPeriods: number
}
export const DEFAULT_TRAFFIC_LIGHT_CONFIG: TrafficLightConfig = {
  graceDays: 30,
  warningDays: 10,
  reviewedPeriods: 3,
}

export type TrafficLightStatus = 'green' | 'yellow' | 'red'
export type Period = { start: string; end: string; label: string; folder: string }
export type PeriodicFrequency = Exclude<Frequency, 'permanent'>

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const parts = (f: string) => f.split('-').map(Number) as [number, number, number]

export function addDays(date: string, days: number): string {
  const [y, m, d] = parts(date)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}
export function daysBetween(a: string, b: string): number {
  const ms = (f: string) => {
    const [y, m, d] = parts(f)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((ms(b) - ms(a)) / 86_400_000)
}

/** Periodo que contiene una fecha, según la periodicidad. */
export function periodOf(frequency: PeriodicFrequency, date: string): Period {
  const [y, m] = parts(date)
  switch (frequency) {
    case 'monthly':
      return {
        start: iso(y, m, 1),
        end: iso(y, m, lastDay(y, m)),
        label: `${capitalize(MONTHS[m - 1]!)} ${y}`,
        folder: `${y}-${String(m).padStart(2, '0')}`,
      }
    case 'quarterly': {
      const t = Math.ceil(m / 3)
      const monthIndex = (t - 1) * 3 + 1
      return {
        start: iso(y, monthIndex, 1),
        end: iso(y, monthIndex + 2, lastDay(y, monthIndex + 2)),
        label: `${['1er', '2do', '3er', '4to'][t - 1]} trimestre ${y}`,
        folder: `${y}-t${t}`,
      }
    }
    case 'semiannual': {
      const s = m <= 6 ? 1 : 2
      const monthIndex = s === 1 ? 1 : 7
      return {
        start: iso(y, monthIndex, 1),
        end: iso(y, monthIndex + 5, lastDay(y, monthIndex + 5)),
        label: `${s === 1 ? '1er' : '2do'} semestre ${y}`,
        folder: `${y}-s${s}`,
      }
    }
    case 'annual':
      return {
        start: iso(y, 1, 1),
        end: iso(y, 12, 31),
        label: `Ejercicio ${y}`,
        folder: String(y),
      }
  }
}

/** El último periodo ya cerrado a la fecha (el que "toca" publicar). */
export function currentPeriod(frequency: PeriodicFrequency, today: string): Period {
  return periodOf(frequency, addDays(periodOf(frequency, today).start, -1))
}

export type TrafficLightInput = {
  frequency: Frequency
  /** Inicios de periodo (YYYY-MM-DD) que ya tienen documento o leyenda publicados. */
  coveredPeriods: string[]
  /** ¿Tiene al menos un documento publicado? */
  hasDocuments: boolean
}

export type TrafficLightResult = {
  status: TrafficLightStatus
  /** Periodo que toca publicar ahora. */
  period: Period | null
  deadline: string | null
  daysToDeadline: number | null
  /** Periodos ya vencidos sin documento ni leyenda. */
  overdue: Period[]
}

export function nodeStatus(
  input: TrafficLightInput,
  today: string,
  config: TrafficLightConfig = DEFAULT_TRAFFIC_LIGHT_CONFIG,
): TrafficLightResult {
  if (input.frequency === 'permanent') {
    return {
      status: input.hasDocuments ? 'green' : 'red',
      period: null,
      deadline: null,
      daysToDeadline: null,
      overdue: [],
    }
  }
  const frequency = input.frequency
  const period = currentPeriod(frequency, today)
  const deadline = addDays(period.end, config.graceDays)
  const days = daysBetween(today, deadline)
  const covered = (p: Period) => input.coveredPeriods.includes(p.start)
  // Los huecos solo cuentan desde que el municipio empezó a publicar en este nodo
  const firstCovered = [...input.coveredPeriods].sort()[0]

  // Periodos cuyo plazo ya pasó, del más reciente al más antiguo
  const overdue: Period[] = []
  let p = period
  for (let i = 0; i < config.reviewedPeriods + 1; i++) {
    const deadlinePassed = daysBetween(today, addDays(p.end, config.graceDays)) < 0
    const beforeFirst = firstCovered !== undefined && p.start < firstCovered
    if (deadlinePassed && !covered(p) && !beforeFirst) overdue.push(p)
    p = periodOf(frequency, addDays(p.start, -1))
  }
  const base = { period, deadline, daysToDeadline: days, overdue }
  if (overdue.length > 0) return { status: 'red', ...base }
  if (covered(period)) return { status: 'green', ...base }
  if (days <= config.warningDays) return { status: 'yellow', ...base }
  return { status: input.hasDocuments ? 'green' : 'red', ...base }
}
