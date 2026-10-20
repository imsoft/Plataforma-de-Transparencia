/** Construcción de URLs públicas (compartidas por panel y sitios) y palabras reservadas. */
import { normalizarClave } from '@plataforma/indice'

export const RUTAS_RESERVADAS = [
  'd',
  'v',
  'og',
  'api',
  'transparencia',
  'sitemap.xml',
  'robots.txt',
  '.well-known',
  'admin',
  'panel',
] as const

/** ¿Un prefijo de sujeto obligado o una página del sitio choca con las rutas del paquete? */
export function esRutaReservada(segmento: string): boolean {
  const s = segmento.toLowerCase()
  return (
    /^\d/.test(s) || /^articulo-/.test(s) || (RUTAS_RESERVADAS as readonly string[]).includes(s)
  )
}

export function rutaDeNodo(prefijo: string, clave: string | null, rutaSlug: string | null): string {
  const base = prefijo ? `/${prefijo}` : ''
  if (clave) return `${base}/${clave}`
  if (rutaSlug) return `${base}/${rutaSlug}`
  return base || '/transparencia'
}

export function rutaDeArticulo(prefijo: string, numero: string): string {
  return `${prefijo ? `/${prefijo}` : ''}/articulo-${numero}`
}

export const rutaDePortada = (prefijo: string) => (prefijo ? `/${prefijo}` : '/transparencia')
export const rutaDeDocumento = (id: string) => `/d/${id}`

export type Resolucion =
  | { tipo: 'portada'; prefijo: string; version: string | null }
  | { tipo: 'articulo'; prefijo: string; numero: string; version: string | null }
  | { tipo: 'clave'; prefijo: string; clave: string; version: string | null }
  | { tipo: 'seccion'; prefijo: string; rutaSlug: string; version: string | null }
  | { tipo: 'redirigir'; destino: string }
  | { tipo: 'no_encontrado'; sugerencia?: string }

/**
 * Resuelve los segmentos de la URL contra los prefijos del municipio. Función pura con pruebas.
 * Ej.: ['dif','85a'] · ['8.5A'] → redirigir a /85a · ['dif','v','ley-anterior','85'] · ['armonizacion-contable']
 */
export function resolverSegmentos(
  segmentos: string[],
  prefijos: string[],
  seccionesSlug: string[] = [],
): Resolucion {
  let resto = [...segmentos]
  let prefijo = ''
  if (resto.length > 0 && prefijos.includes(resto[0]!)) prefijo = resto.shift()!
  let version: string | null = null
  if (resto[0] === 'v') {
    if (resto.length < 2) return { tipo: 'no_encontrado' }
    version = resto[1]!
    resto = resto.slice(2)
  }
  if (resto.length === 0)
    return prefijo ? { tipo: 'portada', prefijo, version } : { tipo: 'no_encontrado' }
  if (resto.length > 1) return { tipo: 'no_encontrado' }
  const seg = resto[0]!
  if (seg === 'transparencia' && !prefijo) return { tipo: 'portada', prefijo: '', version }
  const art = /^articulo-(\d+)$/i.exec(seg)
  if (art) {
    const numero = String(Number(art[1]))
    if (seg !== `articulo-${numero}`)
      return { tipo: 'redirigir', destino: armar(prefijo, version, `articulo-${numero}`) }
    return { tipo: 'articulo', prefijo, numero, version }
  }
  if (seccionesSlug.includes(seg)) return { tipo: 'seccion', prefijo, rutaSlug: seg, version }
  const clave = normalizarClave(seg)
  if (!clave) return { tipo: 'no_encontrado' }
  if (clave !== seg) return { tipo: 'redirigir', destino: armar(prefijo, version, clave) }
  return { tipo: 'clave', prefijo, clave, version }
}

function armar(prefijo: string, version: string | null, ultimo: string): string {
  return `${prefijo ? `/${prefijo}` : ''}${version ? `/v/${version}` : ''}/${ultimo}`
}
