/** Nombre visible sugerido a partir del nombre del archivo, y periodo detectado si se puede. */

const MONTHS: Record<string, number> = {
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
const ACRONYMS = new Set([
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
const LOWERCASE_WORDS = new Set([
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

export type DetectedPeriod =
  | { type: 'month'; year: number; month: number }
  | { type: 'quarter'; year: number; quarter: number }
  | { type: 'year'; year: number }

export function suggestedName(fileName: string): {
  name: string
  period: DetectedPeriod | null
} {
  const withoutExt = fileName.replace(/\.[a-z0-9]{2,5}$/i, '')
  const clean = withoutExt
    .replace(/[_\-.+]+/g, ' ')
    .replace(/\s*\(\d+\)\s*$/, '') // "archivo (2)"
    .replace(/\b(copia|final|v\d+|ok|listo)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const words = clean.split(' ').filter(Boolean)
  const name = words
    .map((p, i) => {
      const removal = p.toLowerCase()
      if (ACRONYMS.has(removal)) return removal.toUpperCase()
      if (i > 0 && LOWERCASE_WORDS.has(removal)) return removal
      if (/^\d/.test(p)) return p
      return removal.charAt(0).toUpperCase() + removal.slice(1)
    })
    .join(' ')
  return { name: name || 'Documento', period: detectPeriod(clean) }
}

export function detectPeriod(text: string): DetectedPeriod | null {
  const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const yearMatch = /\b(20\d{2})\b/.exec(t)
  const year = yearMatch ? Number(yearMatch[1]) : null
  const trim =
    /\b([1-4])\s*(?:er|do|to|°|º)?\s*trim(?:estre)?\b|\btrim(?:estre)?\s*([1-4])\b|\bt([1-4])\b/.exec(
      t,
    )
  if (trim && year) return { type: 'quarter', year, quarter: Number(trim[1] ?? trim[2] ?? trim[3]) }
  for (const [name, month] of Object.entries(MONTHS)) {
    if (new RegExp(`\\b${name}\\b`).test(t) && year) return { type: 'month', year, month }
  }
  const numeric =
    /\b(20\d{2})[-_/ ]?(0[1-9]|1[0-2])\b/.exec(t) ?? /\b(0[1-9]|1[0-2])[-_/ ](20\d{2})\b/.exec(t)
  if (numeric) {
    const [a, b] = [numeric[1]!, numeric[2]!]
    return a.startsWith('20')
      ? { type: 'month', year: Number(a), month: Number(b) }
      : { type: 'month', year: Number(b), month: Number(a) }
  }
  if (year) return { type: 'year', year }
  return null
}
