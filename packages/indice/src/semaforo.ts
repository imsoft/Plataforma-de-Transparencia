/**
 * Semáforo de cumplimiento (sección 5.2). Funciones puras sobre fechas de calendario (YYYY-MM-DD);
 * quien llama pasa "hoy" ya en America/Mexico_City. Umbrales configurables.
 */
import type { Periodicidad } from './formato'

export type ConfigSemaforo = {
  /** Días después del fin del periodo para publicar (plazo legal, por confirmar con el supervisor). */
  diasGracia: number
  /** Días antes del plazo en que se pone amarillo. */
  diasAviso: number
  /** Cuántos periodos ya vencidos se revisan hacia atrás (un hueco en ellos = rojo). */
  periodosRevisados: number
}
export const CONFIG_SEMAFORO_DEFAULT: ConfigSemaforo = {
  diasGracia: 30,
  diasAviso: 10,
  periodosRevisados: 3,
}

export type Estado = 'verde' | 'amarillo' | 'rojo'
export type Periodo = { inicio: string; fin: string; etiqueta: string; carpeta: string }
export type PeriodicidadConPeriodo = Exclude<Periodicidad, 'permanente'>

const MESES = [
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
const ultimoDia = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const partes = (f: string) => f.split('-').map(Number) as [number, number, number]

export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = partes(fecha)
  const t = new Date(Date.UTC(y, m - 1, d + dias))
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}
export function diasEntre(a: string, b: string): number {
  const ms = (f: string) => {
    const [y, m, d] = partes(f)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((ms(b) - ms(a)) / 86_400_000)
}

/** Periodo que contiene una fecha, según la periodicidad. */
export function periodoDe(periodicidad: PeriodicidadConPeriodo, fecha: string): Periodo {
  const [y, m] = partes(fecha)
  switch (periodicidad) {
    case 'mensual':
      return {
        inicio: iso(y, m, 1),
        fin: iso(y, m, ultimoDia(y, m)),
        etiqueta: `${capitalizar(MESES[m - 1]!)} ${y}`,
        carpeta: `${y}-${String(m).padStart(2, '0')}`,
      }
    case 'trimestral': {
      const t = Math.ceil(m / 3)
      const mi = (t - 1) * 3 + 1
      return {
        inicio: iso(y, mi, 1),
        fin: iso(y, mi + 2, ultimoDia(y, mi + 2)),
        etiqueta: `${['1er', '2do', '3er', '4to'][t - 1]} trimestre ${y}`,
        carpeta: `${y}-t${t}`,
      }
    }
    case 'semestral': {
      const s = m <= 6 ? 1 : 2
      const mi = s === 1 ? 1 : 7
      return {
        inicio: iso(y, mi, 1),
        fin: iso(y, mi + 5, ultimoDia(y, mi + 5)),
        etiqueta: `${s === 1 ? '1er' : '2do'} semestre ${y}`,
        carpeta: `${y}-s${s}`,
      }
    }
    case 'anual':
      return {
        inicio: iso(y, 1, 1),
        fin: iso(y, 12, 31),
        etiqueta: `Ejercicio ${y}`,
        carpeta: String(y),
      }
  }
}

/** El último periodo ya cerrado a la fecha (el que "toca" publicar). */
export function periodoVigente(periodicidad: PeriodicidadConPeriodo, hoy: string): Periodo {
  return periodoDe(periodicidad, sumarDias(periodoDe(periodicidad, hoy).inicio, -1))
}

export type EntradaSemaforo = {
  periodicidad: Periodicidad
  /** Inicios de periodo (YYYY-MM-DD) que ya tienen documento o leyenda publicados. */
  periodosCubiertos: string[]
  /** ¿Tiene al menos un documento publicado? */
  tieneDocumentos: boolean
}

export type ResultadoSemaforo = {
  estado: Estado
  /** Periodo que toca publicar ahora. */
  periodo: Periodo | null
  plazo: string | null
  diasParaPlazo: number | null
  /** Periodos ya vencidos sin documento ni leyenda. */
  vencidos: Periodo[]
}

export function estadoNodo(
  entrada: EntradaSemaforo,
  hoy: string,
  config: ConfigSemaforo = CONFIG_SEMAFORO_DEFAULT,
): ResultadoSemaforo {
  if (entrada.periodicidad === 'permanente') {
    return {
      estado: entrada.tieneDocumentos ? 'verde' : 'rojo',
      periodo: null,
      plazo: null,
      diasParaPlazo: null,
      vencidos: [],
    }
  }
  const periodicidad = entrada.periodicidad
  const periodo = periodoVigente(periodicidad, hoy)
  const plazo = sumarDias(periodo.fin, config.diasGracia)
  const dias = diasEntre(hoy, plazo)
  const cubierto = (p: Periodo) => entrada.periodosCubiertos.includes(p.inicio)
  // Los huecos solo cuentan desde que el municipio empezó a publicar en este nodo
  const primerCubierto = [...entrada.periodosCubiertos].sort()[0]

  // Periodos cuyo plazo ya pasó, del más reciente al más antiguo
  const vencidos: Periodo[] = []
  let p = periodo
  for (let i = 0; i < config.periodosRevisados + 1; i++) {
    const plazoPasado = diasEntre(hoy, sumarDias(p.fin, config.diasGracia)) < 0
    const anteriorAlInicio = primerCubierto !== undefined && p.inicio < primerCubierto
    if (plazoPasado && !cubierto(p) && !anteriorAlInicio) vencidos.push(p)
    p = periodoDe(periodicidad, sumarDias(p.inicio, -1))
  }
  const base = { periodo, plazo, diasParaPlazo: dias, vencidos }
  if (vencidos.length > 0) return { estado: 'rojo', ...base }
  if (cubierto(periodo)) return { estado: 'verde', ...base }
  if (dias <= config.diasAviso) return { estado: 'amarillo', ...base }
  return { estado: entrada.tieneDocumentos ? 'verde' : 'rojo', ...base }
}
