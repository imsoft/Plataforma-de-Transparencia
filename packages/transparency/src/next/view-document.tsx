/** Página con reproductor para videos: montar en `app/d/[id]/ver/page.tsx`. */
import { DownloadIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ShareButton } from '../components/share-button'
import { Breadcrumbs } from '../components/breadcrumbs'
import { nodeRoute, homeRoute } from '../routes'
import { siteConfig } from './config'
import { getDocument, getMunicipality } from './data'
import { documentMetadata, pathTitle } from './metadata'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const [m, d] = await Promise.all([getMunicipality(), getDocument(id)])
  if (!m || !d || d.status !== 'published') return { robots: { index: false } }
  return documentMetadata(m, d)
}

function embedUrl(url: string): string | null {
  const yt = /(?:youtube\.com\/(?:watch\?v=|live\/|shorts\/)|youtu\.be\/)([\w-]+)/.exec(url)
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`
  if (/facebook\.com|fb\.watch/.test(url))
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`
  return null
}

export async function ViewDocumentPage({ params }: Props) {
  const { id } = await params
  const [m, d] = await Promise.all([getMunicipality(), getDocument(id)])
  if (!m || !d || d.status !== 'published') notFound()
  const { baseUrl, filesPublicUrl } = siteConfig()
  const section = nodeRoute(d.prefix, d.node.key, d.node.routeSlug)
  const file = d.version
    ? `${filesPublicUrl}/${d.version.storagePath.split('/').map(encodeURIComponent).join('/')}`
    : null
  const embed = d.externalUrl ? embedUrl(d.externalUrl) : null
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-10">
      <Breadcrumbs
        crumbs={[
          { href: '/', label: 'Inicio' },
          { href: homeRoute(d.prefix), label: 'Transparencia' },
          { href: section, label: d.node.label },
          { label: d.name },
        ]}
      />
      <h1 className="mt-4 text-2xl font-bold text-neutral-900 md:text-3xl">{d.name}</h1>
      <p className="mt-1 text-sm text-neutral-600">
        {pathTitle(d.path)}
        {d.periodLabel ? ` · ${d.periodLabel}` : ''}
      </p>
      <div className="mt-6 overflow-hidden rounded-xl bg-black">
        {embed ? (
          <iframe
            src={embed}
            title={d.name}
            className="aspect-video w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : file ? (
          <video
            controls
            preload="metadata"
            className="aspect-video w-full"
            poster={
              d.version?.thumbnailPath ? `${filesPublicUrl}/${d.version.thumbnailPath}` : undefined
            }
          >
            <source src={file} type={d.version?.mime} />
            Tu navegador no puede reproducir este video. <a href={file}>Descárgalo</a>.
          </video>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <ShareButton url={`${baseUrl}/d/${d.id}`} title={d.name} />
        {file && (
          <a
            href={file}
            download
            className="inline-flex h-11 items-center gap-2 rounded-md bg-primario-legible px-4 text-sm font-medium text-sobre-primario"
          >
            <DownloadIcon className="size-4" aria-hidden="true" /> Descargar
          </a>
        )}
        {d.externalUrl && (
          <a
            href={d.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center rounded-md border px-4 text-sm font-medium"
          >
            Ver en el sitio original
          </a>
        )}
        <Link
          href={section}
          className="inline-flex h-11 items-center rounded-md px-4 text-sm font-medium text-primario-legible underline-offset-4 hover:underline"
        >
          Ver la sección completa
        </Link>
      </div>
    </div>
  )
}
