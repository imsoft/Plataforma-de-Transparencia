import type { FullMunicipality } from '@platform/db/queries/municipality'

/** Base pública del sitio del municipio (dominio principal; en local, el host localhost registrado). */
export function siteBase(m: Pick<FullMunicipality, 'domains' | 'slug'>): string {
  const local = m.domains.find((d) => d.host.startsWith('localhost'))
  if (process.env.NODE_ENV !== 'production' && local) return `http://${local.host}`
  const isPrimary = m.domains.find((d) => d.isPrimary) ?? m.domains[0]
  return isPrimary ? `https://${isPrimary.host}` : `https://${m.slug}.gob.mx`
}

/** Segmento del sujeto obligado en las URLs del panel: el prefijo, o el tipo cuando es la raíz. */
export function panelSegment(so: { prefix: string; type: { slug: string } }): string {
  return so.prefix || so.type.slug
}
