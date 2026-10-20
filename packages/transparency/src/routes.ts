/** Construcción de URLs públicas (compartidas por panel y sitios) y palabras reservadas. */
import { normalizeKey } from '@platform/law-index'

export const RESERVED_ROUTES = [
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
export function isReservedRoute(segment: string): boolean {
  const s = segment.toLowerCase()
  return /^\d/.test(s) || /^articulo-/.test(s) || (RESERVED_ROUTES as readonly string[]).includes(s)
}

export function nodeRoute(prefix: string, key: string | null, routeSlug: string | null): string {
  const base = prefix ? `/${prefix}` : ''
  if (key) return `${base}/${key}`
  if (routeSlug) return `${base}/${routeSlug}`
  return base || '/transparencia'
}

export function articleRoute(prefix: string, number: string): string {
  return `${prefix ? `/${prefix}` : ''}/articulo-${number}`
}

export const homeRoute = (prefix: string) => (prefix ? `/${prefix}` : '/transparencia')
export const documentRoute = (id: string) => `/d/${id}`

export type Resolution =
  | { type: 'home'; prefix: string; version: string | null }
  | { type: 'article'; prefix: string; number: string; version: string | null }
  | { type: 'key'; prefix: string; key: string; version: string | null }
  | { type: 'section'; prefix: string; routeSlug: string; version: string | null }
  | { type: 'redirect'; target: string }
  | { type: 'not_found'; suggestion?: string }

/**
 * Resuelve los segmentos de la URL contra los prefijos del municipio. Función pura con pruebas.
 * Ej.: ['dif','85a'] · ['8.5A'] → redirigir a /85a · ['dif','v','ley-anterior','85'] · ['armonizacion-contable']
 */
export function resolveSegments(
  segments: string[],
  prefixes: string[],
  sectionSlugs: string[] = [],
): Resolution {
  let rest = [...segments]
  let prefix = ''
  if (rest.length > 0 && prefixes.includes(rest[0]!)) prefix = rest.shift()!
  let version: string | null = null
  if (rest[0] === 'v') {
    if (rest.length < 2) return { type: 'not_found' }
    version = rest[1]!
    rest = rest.slice(2)
  }
  if (rest.length === 0) return prefix ? { type: 'home', prefix, version } : { type: 'not_found' }
  if (rest.length > 1) return { type: 'not_found' }
  const seg = rest[0]!
  if (seg === 'transparencia' && !prefix) return { type: 'home', prefix: '', version }
  const art = /^articulo-(\d+)$/i.exec(seg)
  if (art) {
    const number = String(Number(art[1]))
    if (seg !== `articulo-${number}`)
      return { type: 'redirect', target: build(prefix, version, `articulo-${number}`) }
    return { type: 'article', prefix, number, version }
  }
  if (sectionSlugs.includes(seg)) return { type: 'section', prefix, routeSlug: seg, version }
  const key = normalizeKey(seg)
  if (!key) return { type: 'not_found' }
  if (key !== seg) return { type: 'redirect', target: build(prefix, version, key) }
  return { type: 'key', prefix, key, version }
}

function build(prefix: string, version: string | null, last: string): string {
  return `${prefix ? `/${prefix}` : ''}${version ? `/v/${version}` : ''}/${last}`
}
