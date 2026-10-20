import 'server-only'
import { configSitio } from '@plataforma/transparencia/next/config'
import { obtenerMunicipio, type MunicipioPublico } from '@plataforma/transparencia/next/datos'
import type { IdentidadSitio, RedSocialSitio } from '@plataforma/ui-sitio/tipos'

export async function municipioOFallback(): Promise<MunicipioPublico> {
  const m = await obtenerMunicipio()
  if (m) return m
  // Fallback si la base no responde: el sitio sigue sirviendo su shell
  return {
    id: '',
    slug: '__SLUG__',
    nombre: '__NOMBRE__',
    nombreOficial: 'H. Ayuntamiento de __NOMBRE__',
    estadoId: '',
    datosContacto: {},
    tema: null,
    sujetos: [],
    redes: [],
    version: null,
  }
}

export function identidadDe(m: MunicipioPublico): IdentidadSitio {
  const { archivosUrlPublica, nombrePlataforma, urlPlataforma } = configSitio()
  const url = (r: string | null | undefined) => (r ? `${archivosUrlPublica}/${r}` : null)
  return {
    nombre: m.nombre,
    nombreOficial: m.nombreOficial,
    escudoUrl: url(m.tema?.escudoRuta),
    logoAdministracionUrl: url(m.tema?.logoAdministracionRuta),
    contacto: m.datosContacto,
    nombrePlataforma,
    urlPlataforma,
  }
}

export function redesDelAyuntamiento(m: MunicipioPublico): RedSocialSitio[] {
  return m.redes
    .filter((r) => !r.sujetoObligadoId)
    .map((r) => ({ red: r.red, nombreOtra: r.nombreOtra, url: r.url, texto: r.texto }))
}
