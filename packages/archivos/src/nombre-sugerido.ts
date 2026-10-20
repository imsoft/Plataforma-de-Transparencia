/** Nombre visible sugerido a partir del nombre del archivo, y periodo detectado si se puede. */

const MESES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
  ene: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dic: 12,
}
const SIGLAS = new Set([
  'dif',
  'pdf',
  'cfdi',
  'rfc',
  'curp',
  'imss',
  'issste',
  'sat',
  'pnt',
  'lgcg',
  'conac',
  'poa',
  'pbr',
  'sed',
  'cuis',
  'ine',
  'iepc',
])
const MINUSCULAS = new Set([
  'de',
  'del',
  'la',
  'las',
  'los',
  'el',
  'y',
  'e',
  'o',
  'u',
  'a',
  'en',
  'por',
  'para',
  'con',
  'al',
  'sin',
])

export type PeriodoDetectado =
  | { tipo: 'mes'; anio: number; mes: number }
  | { tipo: 'trimestre'; anio: number; trimestre: number }
  | { tipo: 'anio'; anio: number }

export function nombreSugerido(nombreArchivo: string): {
  nombre: string
  periodo: PeriodoDetectado | null
} {
  const sinExt = nombreArchivo.replace(/\.[a-z0-9]{2,5}$/i, '')
  const limpio = sinExt
    .replace(/[_\-.+]+/g, ' ')
    .replace(/\s*\(\d+\)\s*$/, '') // "archivo (2)"
    .replace(/\b(copia|final|v\d+|ok|listo)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const palabras = limpio.split(' ').filter(Boolean)
  const nombre = palabras
    .map((p, i) => {
      const baja = p.toLowerCase()
      if (SIGLAS.has(baja)) return baja.toUpperCase()
      if (i > 0 && MINUSCULAS.has(baja)) return baja
      if (/^\d/.test(p)) return p
      return baja.charAt(0).toUpperCase() + baja.slice(1)
    })
    .join(' ')
  return { nombre: nombre || 'Documento', periodo: detectarPeriodo(limpio) }
}

export function detectarPeriodo(texto: string): PeriodoDetectado | null {
  const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const anioM = /\b(20\d{2})\b/.exec(t)
  const anio = anioM ? Number(anioM[1]) : null
  const trim =
    /\b([1-4])\s*(?:er|do|to|°|º)?\s*trim(?:estre)?\b|\btrim(?:estre)?\s*([1-4])\b|\bt([1-4])\b/.exec(
      t,
    )
  if (trim && anio)
    return { tipo: 'trimestre', anio, trimestre: Number(trim[1] ?? trim[2] ?? trim[3]) }
  for (const [nombre, mes] of Object.entries(MESES)) {
    if (new RegExp(`\\b${nombre}\\b`).test(t) && anio) return { tipo: 'mes', anio, mes }
  }
  const numerico =
    /\b(20\d{2})[-_/ ]?(0[1-9]|1[0-2])\b/.exec(t) ?? /\b(0[1-9]|1[0-2])[-_/ ](20\d{2})\b/.exec(t)
  if (numerico) {
    const [a, b] = [numerico[1]!, numerico[2]!]
    return a.startsWith('20')
      ? { tipo: 'mes', anio: Number(a), mes: Number(b) }
      : { tipo: 'mes', anio: Number(b), mes: Number(a) }
  }
  if (anio) return { tipo: 'anio', anio }
  return null
}
