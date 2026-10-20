import type { MunicipioCompleto } from '@plataforma/db/consultas/municipio'

/** Base pública del sitio del municipio (dominio principal; en local, el host localhost registrado). */
export function baseSitio(m: Pick<MunicipioCompleto, 'dominios' | 'slug'>): string {
  const local = m.dominios.find((d) => d.host.startsWith('localhost'))
  if (process.env.NODE_ENV !== 'production' && local) return `http://${local.host}`
  const principal = m.dominios.find((d) => d.principal) ?? m.dominios[0]
  return principal ? `https://${principal.host}` : `https://${m.slug}.gob.mx`
}

/** Segmento del sujeto obligado en las URLs del panel: el prefijo, o el tipo cuando es la raíz. */
export function segmentoPanel(so: { prefijo: string; tipo: { slug: string } }): string {
  return so.prefijo || so.tipo.slug
}
