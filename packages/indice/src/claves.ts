/**
 * Claves cortas: artículo + fracción (arábigo) + inciso [+ subinciso], sin separadores. Ej. 8 / V / a → "85a".
 * La clave se BUSCA en el índice, nunca se parsea; aquí solo se genera y se normaliza lo que escribe la gente.
 */

const ROMANOS: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 }
const ES_ROMANO = /^[ivxlcdm]+$/i

export function romanoAArabigo(valor: string): number {
  const s = valor.toLowerCase()
  if (!ES_ROMANO.test(s)) throw new Error(`"${valor}" no es un número romano`)
  let total = 0
  for (let i = 0; i < s.length; i++) {
    const actual = ROMANOS[s[i]!]!
    const siguiente = ROMANOS[s[i + 1] ?? ''] ?? 0
    total += actual < siguiente ? -actual : actual
  }
  return total
}

export function arabigoARomano(n: number): string {
  if (!Number.isInteger(n) || n <= 0 || n >= 4000)
    throw new Error(`No se puede convertir ${n} a romano`)
  const tabla: [number, string][] = [
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
  for (const [v, s] of tabla)
    while (n >= v) {
      r += s
      n -= v
    }
  return r
}

/** Número de fracción tal como viene del archivo ('V' o '5') → arábigo como texto ('5'). */
export function numeroFraccion(valor: string): string {
  const v = valor.trim()
  if (/^\d+$/.test(v)) return String(Number(v))
  return String(romanoAArabigo(v))
}

export type SegmentosClave = {
  articulo: string
  fraccion?: string | undefined
  inciso?: string | undefined
  subinciso?: string | undefined
}

/** Genera la clave canónica a partir de los segmentos ya normalizados. */
export function generarClave({ articulo, fraccion, inciso, subinciso }: SegmentosClave): string {
  const a = String(Number(articulo))
  if (!/^\d+$/.test(articulo) || a === 'NaN') throw new Error(`Artículo inválido "${articulo}"`)
  let clave = a
  if (fraccion !== undefined) clave += numeroFraccion(fraccion)
  if (inciso !== undefined) {
    if (fraccion === undefined) throw new Error('Un inciso necesita fracción')
    if (!/^[a-zñ]$/i.test(inciso)) throw new Error(`Inciso inválido "${inciso}"`)
    clave += letraInciso(inciso)
  }
  if (subinciso !== undefined) {
    if (inciso === undefined) throw new Error('Un sub-inciso necesita inciso')
    if (!/^\d+$/.test(subinciso)) throw new Error(`Sub-inciso inválido "${subinciso}"`)
    clave += String(Number(subinciso))
  }
  return clave
}

/** La "ñ" (inciso ñ) se escribe "nn" en la clave para que la URL sea ASCII: 8.V.ñ → 85nn */
export function letraInciso(inciso: string): string {
  const l = inciso.toLowerCase()
  return l === 'ñ' ? 'nn' : l
}

export const CLAVE_CANONICA = /^\d+[a-z0-9]*$/

/**
 * Normaliza lo que alguien escribe en la URL a la forma canónica.
 * "85A" → "85a" · "8.5a" → "85a" · "8-5-a" → "85a" · "8.V.a" → "85a" · "8 v a" → "85a".
 * Devuelve null si no parece una clave.
 */
export function normalizarClave(entrada: string): string | null {
  const limpio = entrada.trim().toLowerCase()
  if (!limpio || !/^\d/.test(limpio)) return null
  const partes = limpio.split(/[.\-_\s/]+/).filter(Boolean)
  // Sin separadores: ya es canónica ("85a"); solo se quitan ceros a la izquierda si es puro número
  if (partes.length === 1) {
    const p = partes[0]!
    if (/^\d+$/.test(p)) return String(Number(p))
    if (/^\d+ñ\d*$/.test(p)) return p.replace('ñ', 'nn')
    return /^\d+(?:[a-z]|nn)?\d*$/.test(p) ? p : null
  }
  // Con separadores: cada parte puede traer número y letra pegados ("5a") o un romano ("V")
  const tokens: string[] = []
  for (const parte of partes) {
    const m = /^(\d*)([a-zñ]*)(\d*)$/.exec(parte)
    if (!m) return null
    for (const t of [m[1], m[2], m[3]]) if (t) tokens.push(t)
  }
  const [articulo, fraccion, inciso, subinciso, ...resto] = tokens
  if (!articulo || !/^\d+$/.test(articulo) || resto.length > 0) return null
  try {
    return generarClave({ articulo, fraccion, inciso, subinciso })
  } catch {
    return null
  }
}

/** Carpeta en el bucket para un nodo: art-08/fr-05/inc-a[/sub-01]. */
export function carpetaDeNodo({ articulo, fraccion, inciso, subinciso }: SegmentosClave): string {
  const pad = (n: string) => String(Number(n)).padStart(2, '0')
  const partes = [`art-${pad(articulo)}`]
  partes.push(fraccion !== undefined ? `fr-${pad(numeroFraccion(fraccion))}` : 'sin-fraccion')
  if (fraccion !== undefined)
    partes.push(inciso !== undefined ? `inc-${inciso.toLowerCase()}` : 'sin-inciso')
  if (subinciso !== undefined) partes.push(`sub-${pad(subinciso)}`)
  return partes.join('/')
}

/** Etiqueta legible de una clave para títulos: "85a" + segmentos → "Art. 8, fracc. V, inciso a". */
export function etiquetaDeSegmentos({
  articulo,
  fraccion,
  inciso,
  subinciso,
}: SegmentosClave): string {
  const partes = [`Art. ${Number(articulo)}`]
  if (fraccion !== undefined)
    partes.push(`fracc. ${arabigoARomano(Number(numeroFraccion(fraccion)))}`)
  if (inciso !== undefined) partes.push(`inciso ${inciso.toLowerCase()}`)
  if (subinciso !== undefined) partes.push(`numeral ${Number(subinciso)}`)
  return partes.join(', ')
}

/** Versión con puntos para mostrar ("8.5.a"), más legible que la clave de la URL. */
export function claveConPuntos({ articulo, fraccion, inciso, subinciso }: SegmentosClave): string {
  return [articulo, fraccion && numeroFraccion(fraccion), inciso?.toLowerCase(), subinciso]
    .filter(Boolean)
    .join('.')
}
