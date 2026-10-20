/**
 * Claves cortas: artículo + fracción (arábigo) + inciso [+ subinciso], sin separadores. Ej. 8 / V / a → "85a".
 * La clave se BUSCA en el índice, nunca se parsea; aquí solo se genera y se normaliza lo que escribe la gente.
 */

const ROMAN_VALUES: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 }
const IS_ROMAN = /^[ivxlcdm]+$/i

export function romanToArabic(value: string): number {
  const s = value.toLowerCase()
  if (!IS_ROMAN.test(s)) throw new Error(`"${value}" no es un número romano`)
  let total = 0
  for (let i = 0; i < s.length; i++) {
    const current = ROMAN_VALUES[s[i]!]!
    const next = ROMAN_VALUES[s[i + 1] ?? ''] ?? 0
    total += current < next ? -current : current
  }
  return total
}

export function arabicToRoman(n: number): string {
  if (!Number.isInteger(n) || n <= 0 || n >= 4000)
    throw new Error(`No se puede convertir ${n} a romano`)
  const table: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let r = ''
  for (const [v, s] of table)
    while (n >= v) {
      r += s
      n -= v
    }
  return r
}

/** Número de fracción tal como viene del archivo ('V' o '5') → arábigo como texto ('5'). */
export function fractionNumber(value: string): string {
  const v = value.trim()
  if (/^\d+$/.test(v)) return String(Number(v))
  return String(romanToArabic(v))
}

export type KeySegments = {
  article: string
  fraction?: string | undefined
  item?: string | undefined
  subitem?: string | undefined
}

/** Genera la clave canónica a partir de los segmentos ya normalizados. */
export function buildKey({ article, fraction, item, subitem }: KeySegments): string {
  const a = String(Number(article))
  if (!/^\d+$/.test(article) || a === 'NaN') throw new Error(`Artículo inválido "${article}"`)
  let key = a
  if (fraction !== undefined) key += fractionNumber(fraction)
  if (item !== undefined) {
    if (fraction === undefined) throw new Error('Un inciso necesita fracción')
    if (!/^[a-zñ]$/i.test(item)) throw new Error(`Inciso inválido "${item}"`)
    key += itemLetter(item)
  }
  if (subitem !== undefined) {
    if (item === undefined) throw new Error('Un sub-inciso necesita inciso')
    if (!/^\d+$/.test(subitem)) throw new Error(`Sub-inciso inválido "${subitem}"`)
    key += String(Number(subitem))
  }
  return key
}

/** La "ñ" (inciso ñ) se escribe "nn" en la clave para que la URL sea ASCII: 8.V.ñ → 85nn */
export function itemLetter(item: string): string {
  const l = item.toLowerCase()
  return l === 'ñ' ? 'nn' : l
}

export const CANONICAL_KEY = /^\d+[a-z0-9]*$/

/**
 * Normaliza lo que alguien escribe en la URL a la forma canónica.
 * "85A" → "85a" · "8.5a" → "85a" · "8-5-a" → "85a" · "8.V.a" → "85a" · "8 v a" → "85a".
 * Devuelve null si no parece una clave.
 */
export function normalizeKey(input: string): string | null {
  const clean = input.trim().toLowerCase()
  if (!clean || !/^\d/.test(clean)) return null
  const parts = clean.split(/[.\-_\s/]+/).filter(Boolean)
  // Sin separadores: ya es canónica ("85a"); solo se quitan ceros a la izquierda si es puro número
  if (parts.length === 1) {
    const p = parts[0]!
    if (/^\d+$/.test(p)) return String(Number(p))
    if (/^\d+ñ\d*$/.test(p)) return p.replace('ñ', 'nn')
    return /^\d+(?:[a-z]|nn)?\d*$/.test(p) ? p : null
  }
  // Con separadores: cada parte puede traer número y letra pegados ("5a") o un romano ("V")
  const tokens: string[] = []
  for (const part of parts) {
    const m = /^(\d*)([a-zñ]*)(\d*)$/.exec(part)
    if (!m) return null
    for (const t of [m[1], m[2], m[3]]) if (t) tokens.push(t)
  }
  const [article, fraction, item, subitem, ...rest] = tokens
  if (!article || !/^\d+$/.test(article) || rest.length > 0) return null
  try {
    return buildKey({ article, fraction, item, subitem })
  } catch {
    return null
  }
}

/** Carpeta en el bucket para un nodo: art-08/fr-05/inc-a[/sub-01]. */
export function nodeFolder({ article, fraction, item, subitem }: KeySegments): string {
  const pad = (n: string) => String(Number(n)).padStart(2, '0')
  const parts = [`art-${pad(article)}`]
  parts.push(fraction !== undefined ? `fr-${pad(fractionNumber(fraction))}` : 'sin-fraccion')
  if (fraction !== undefined)
    parts.push(item !== undefined ? `inc-${item.toLowerCase()}` : 'sin-inciso')
  if (subitem !== undefined) parts.push(`sub-${pad(subitem)}`)
  return parts.join('/')
}

/** Etiqueta legible de una clave para títulos: "85a" + segmentos → "Art. 8, fracc. V, inciso a". */
export function segmentsLabel({ article, fraction, item, subitem }: KeySegments): string {
  const parts = [`Art. ${Number(article)}`]
  if (fraction !== undefined)
    parts.push(`fracc. ${arabicToRoman(Number(fractionNumber(fraction)))}`)
  if (item !== undefined) parts.push(`inciso ${item.toLowerCase()}`)
  if (subitem !== undefined) parts.push(`numeral ${Number(subitem)}`)
  return parts.join(', ')
}

/** Versión con puntos para mostrar ("8.5.a"), más legible que la clave de la URL. */
export function dottedKey({ article, fraction, item, subitem }: KeySegments): string {
  return [article, fraction && fractionNumber(fraction), item?.toLowerCase(), subitem]
    .filter(Boolean)
    .join('.')
}
