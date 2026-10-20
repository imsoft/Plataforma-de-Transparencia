import { themeFingerprint, themeSchema } from '@platform/theme'
import type { Metadata } from 'next'
import { siteConfig } from './config'
import type { DocumentDetail, PublicMunicipality, PublicNode } from './data'

export function subjectName(m: PublicMunicipality, prefix: string): string {
  const so = m.subjects.find((s) => s.prefix === prefix)
  return so ? (so.prefix ? so.name : m.officialName) : m.officialName
}

export function pathTitle(path: PublicNode[]): string {
  return path
    .map((n) =>
      n.level === 'article' && !n.key
        ? n.title
        : n.label.replace('Fracc.', 'fracc.').replace('Inciso', 'item'),
    )
    .join(', ')
}

function themeVersion(m: PublicMunicipality): string {
  const t = themeSchema.safeParse(m.theme ?? {})
  return `${m.theme?.version ?? 1}-${t.success ? themeFingerprint(t.data) : '0'}`
}

const truncate = (s: string, n = 155) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`)

function base(
  m: PublicMunicipality,
  prefix: string,
  path: string,
  title: string,
  description: string,
  image: string,
): Metadata {
  const { baseUrl } = siteConfig()
  const url = `${baseUrl}${path}`
  const site = subjectName(m, prefix)
  return {
    title: title,
    description: description,
    alternates: { canonical: url },
    openGraph: {
      title: title,
      description: description,
      url,
      siteName: site,
      locale: 'es_MX',
      type: 'article',
      images: [{ url: image, width: 1200, height: 630, alt: `${title} · ${site}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      images: [image],
    },
  }
}

export function nodeMetadata(
  m: PublicMunicipality,
  prefix: string,
  node: PublicNode,
  path: PublicNode[],
  routeUrl: string,
  totalDocs: number,
): Metadata {
  const { baseUrl } = siteConfig()
  const title =
    `${node.key ? `${pathTitle(path)} — ` : ''}${node.key ? 'Transparencia' : node.title}`.replace(
      /^Art\./,
      'Art.',
    )
  const description = truncate(
    `${node.title}. ${totalDocs} documento${totalDocs === 1 ? '' : 's'} publicado${totalDocs === 1 ? '' : 's'} por ${subjectName(m, prefix)}.`,
  )
  const image = `${baseUrl}/og/nodo/${prefix || 'raiz'}/${node.key ?? node.routeSlug}-${themeVersion(m)}.png`
  return base(m, prefix, routeUrl, title, description, image)
}

export function homeMetadata(m: PublicMunicipality, prefix: string, routeUrl: string): Metadata {
  const { baseUrl } = siteConfig()
  const title = 'Transparencia'
  const description = `Información fundamental publicada por ${subjectName(m, prefix)} conforme a la ley de transparencia.`
  const image = `${baseUrl}/og/nodo/${prefix || 'raiz'}/portada-${themeVersion(m)}.png`
  return {
    ...base(m, prefix, routeUrl, title, description, image),
    openGraph: {
      ...base(m, prefix, routeUrl, title, description, image).openGraph,
      type: 'website',
    },
  }
}

export function documentMetadata(m: PublicMunicipality, d: DocumentDetail): Metadata {
  const { baseUrl } = siteConfig()
  const date = d.publishedAt
    ? new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(d.publishedAt))
    : ''
  const parts = [
    'Documento de transparencia',
    pathTitle(d.path),
    d.periodLabel,
    date ? `Publicado el ${date}` : null,
  ].filter(Boolean)
  const image = `${baseUrl}/og/d/${d.id}-${themeVersion(m)}-${Math.abs(hash(d.name + (d.periodLabel ?? '')))}.png`
  return base(m, d.prefix, `/d/${d.id}`, d.name, parts.join(' · '), image)
}

export function hash(s: string): number {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0
  return h
}

/** JSON-LD de la organización (portada) y del breadcrumb (páginas de transparencia). */
export function organizationJsonLd(m: PublicMunicipality): Record<string, unknown> {
  const { baseUrl, filesPublicUrl } = siteConfig()
  return {
    '@context': 'https://schema.org',
    '@type': 'GovernmentOrganization',
    name: m.officialName,
    url: baseUrl,
    ...(m.theme?.coatOfArmsPath ? { logo: `${filesPublicUrl}/${m.theme.coatOfArmsPath}` } : {}),
    ...(m.contactInfo.phone ? { telephone: m.contactInfo.phone } : {}),
    ...(m.contactInfo.address
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: m.contactInfo.address,
            addressRegion: 'Jalisco',
            addressCountry: 'MX',
          },
        }
      : {}),
    sameAs: m.networks.filter((r) => !r.obligatedSubjectId).map((r) => r.url),
  }
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
  const { baseUrl } = siteConfig()
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${baseUrl}${it.path}`,
    })),
  }
}
