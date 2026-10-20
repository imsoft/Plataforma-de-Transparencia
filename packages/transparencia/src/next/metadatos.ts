import { huellaDeTema, temaSchema } from '@plataforma/tema'
import type { Metadata } from 'next'
import { configSitio } from './config'
import type { DocumentoDetalle, MunicipioPublico, NodoPublico } from './datos'

export function nombreSujeto(m: MunicipioPublico, prefijo: string): string {
  const so = m.sujetos.find((s) => s.prefijo === prefijo)
  return so ? (so.prefijo ? so.nombre : m.nombreOficial) : m.nombreOficial
}

export function tituloDeRuta(ruta: NodoPublico[]): string {
  return ruta
    .map((n) =>
      n.nivel === 'articulo' && !n.clave
        ? n.titulo
        : n.etiqueta.replace('Fracc.', 'fracc.').replace('Inciso', 'inciso'),
    )
    .join(', ')
}

function versionTema(m: MunicipioPublico): string {
  const t = temaSchema.safeParse(m.tema ?? {})
  return `${m.tema?.version ?? 1}-${t.success ? huellaDeTema(t.data) : '0'}`
}

const recortar = (s: string, n = 155) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`)

function base(
  m: MunicipioPublico,
  prefijo: string,
  ruta: string,
  titulo: string,
  descripcion: string,
  imagen: string,
): Metadata {
  const { urlBase } = configSitio()
  const url = `${urlBase}${ruta}`
  const sitio = nombreSujeto(m, prefijo)
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: url },
    openGraph: {
      title: titulo,
      description: descripcion,
      url,
      siteName: sitio,
      locale: 'es_MX',
      type: 'article',
      images: [{ url: imagen, width: 1200, height: 630, alt: `${titulo} · ${sitio}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: titulo,
      description: descripcion,
      images: [imagen],
    },
  }
}

export function metadatosDeNodo(
  m: MunicipioPublico,
  prefijo: string,
  nodo: NodoPublico,
  ruta: NodoPublico[],
  rutaUrl: string,
  totalDocs: number,
): Metadata {
  const { urlBase } = configSitio()
  const titulo =
    `${nodo.clave ? `${tituloDeRuta(ruta)} — ` : ''}${nodo.clave ? 'Transparencia' : nodo.titulo}`.replace(
      /^Art\./,
      'Art.',
    )
  const descripcion = recortar(
    `${nodo.titulo}. ${totalDocs} documento${totalDocs === 1 ? '' : 's'} publicado${totalDocs === 1 ? '' : 's'} por ${nombreSujeto(m, prefijo)}.`,
  )
  const imagen = `${urlBase}/og/nodo/${prefijo || 'raiz'}/${nodo.clave ?? nodo.rutaSlug}-${versionTema(m)}.png`
  return base(m, prefijo, rutaUrl, titulo, descripcion, imagen)
}

export function metadatosDePortada(
  m: MunicipioPublico,
  prefijo: string,
  rutaUrl: string,
): Metadata {
  const { urlBase } = configSitio()
  const titulo = 'Transparencia'
  const descripcion = `Información fundamental publicada por ${nombreSujeto(m, prefijo)} conforme a la ley de transparencia.`
  const imagen = `${urlBase}/og/nodo/${prefijo || 'raiz'}/portada-${versionTema(m)}.png`
  return {
    ...base(m, prefijo, rutaUrl, titulo, descripcion, imagen),
    openGraph: {
      ...base(m, prefijo, rutaUrl, titulo, descripcion, imagen).openGraph,
      type: 'website',
    },
  }
}

export function metadatosDeDocumento(m: MunicipioPublico, d: DocumentoDetalle): Metadata {
  const { urlBase } = configSitio()
  const fecha = d.publicadoEn
    ? new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(d.publicadoEn))
    : ''
  const partes = [
    'Documento de transparencia',
    tituloDeRuta(d.ruta),
    d.periodoEtiqueta,
    fecha ? `Publicado el ${fecha}` : null,
  ].filter(Boolean)
  const imagen = `${urlBase}/og/d/${d.id}-${versionTema(m)}-${Math.abs(hash(d.nombre + (d.periodoEtiqueta ?? '')))}.png`
  return base(m, d.prefijo, `/d/${d.id}`, d.nombre, partes.join(' · '), imagen)
}

export function hash(s: string): number {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0
  return h
}

/** JSON-LD de la organización (portada) y del breadcrumb (páginas de transparencia). */
export function jsonLdOrganizacion(m: MunicipioPublico): Record<string, unknown> {
  const { urlBase, archivosUrlPublica } = configSitio()
  return {
    '@context': 'https://schema.org',
    '@type': 'GovernmentOrganization',
    name: m.nombreOficial,
    url: urlBase,
    ...(m.tema?.escudoRuta ? { logo: `${archivosUrlPublica}/${m.tema.escudoRuta}` } : {}),
    ...(m.datosContacto.telefono ? { telephone: m.datosContacto.telefono } : {}),
    ...(m.datosContacto.direccion
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: m.datosContacto.direccion,
            addressRegion: 'Jalisco',
            addressCountry: 'MX',
          },
        }
      : {}),
    sameAs: m.redes.filter((r) => !r.sujetoObligadoId).map((r) => r.url),
  }
}

export function jsonLdMigas(items: { nombre: string; ruta: string }[]): Record<string, unknown> {
  const { urlBase } = configSitio()
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.nombre,
      item: `${urlBase}${it.ruta}`,
    })),
  }
}
