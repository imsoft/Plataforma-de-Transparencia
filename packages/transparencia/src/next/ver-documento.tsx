/** Página con reproductor para videos: montar en `app/d/[id]/ver/page.tsx`. */
import { DownloadIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BotonCompartir } from '../componentes/boton-compartir'
import { Migas } from '../componentes/migas'
import { rutaDeNodo, rutaDePortada } from '../rutas'
import { configSitio } from './config'
import { obtenerDocumento, obtenerMunicipio } from './datos'
import { metadatosDeDocumento, tituloDeRuta } from './metadatos'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const [m, d] = await Promise.all([obtenerMunicipio(), obtenerDocumento(id)])
  if (!m || !d || d.estado !== 'publicado') return { robots: { index: false } }
  return metadatosDeDocumento(m, d)
}

function incrustado(url: string): string | null {
  const yt = /(?:youtube\.com\/(?:watch\?v=|live\/|shorts\/)|youtu\.be\/)([\w-]+)/.exec(url)
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`
  if (/facebook\.com|fb\.watch/.test(url))
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`
  return null
}

export async function PaginaVerDocumento({ params }: Props) {
  const { id } = await params
  const [m, d] = await Promise.all([obtenerMunicipio(), obtenerDocumento(id)])
  if (!m || !d || d.estado !== 'publicado') notFound()
  const { urlBase, archivosUrlPublica } = configSitio()
  const seccion = rutaDeNodo(d.prefijo, d.nodo.clave, d.nodo.rutaSlug)
  const archivo = d.version
    ? `${archivosUrlPublica}/${d.version.rutaR2.split('/').map(encodeURIComponent).join('/')}`
    : null
  const embed = d.urlExterna ? incrustado(d.urlExterna) : null
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-10">
      <Migas
        migas={[
          { href: '/', etiqueta: 'Inicio' },
          { href: rutaDePortada(d.prefijo), etiqueta: 'Transparencia' },
          { href: seccion, etiqueta: d.nodo.etiqueta },
          { etiqueta: d.nombre },
        ]}
      />
      <h1 className="mt-4 text-2xl font-bold text-neutral-900 md:text-3xl">{d.nombre}</h1>
      <p className="mt-1 text-sm text-neutral-600">
        {tituloDeRuta(d.ruta)}
        {d.periodoEtiqueta ? ` · ${d.periodoEtiqueta}` : ''}
      </p>
      <div className="mt-6 overflow-hidden rounded-xl bg-black">
        {embed ? (
          <iframe
            src={embed}
            title={d.nombre}
            className="aspect-video w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : archivo ? (
          <video
            controls
            preload="metadata"
            className="aspect-video w-full"
            poster={
              d.version?.miniaturaRuta
                ? `${archivosUrlPublica}/${d.version.miniaturaRuta}`
                : undefined
            }
          >
            <source src={archivo} type={d.version?.mime} />
            Tu navegador no puede reproducir este video. <a href={archivo}>Descárgalo</a>.
          </video>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <BotonCompartir url={`${urlBase}/d/${d.id}`} titulo={d.nombre} />
        {archivo && (
          <a
            href={archivo}
            download
            className="inline-flex h-11 items-center gap-2 rounded-md bg-primario-legible px-4 text-sm font-medium text-sobre-primario"
          >
            <DownloadIcon className="size-4" aria-hidden="true" /> Descargar
          </a>
        )}
        {d.urlExterna && (
          <a
            href={d.urlExterna}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center rounded-md border px-4 text-sm font-medium"
          >
            Ver en el sitio original
          </a>
        )}
        <Link
          href={seccion}
          className="inline-flex h-11 items-center rounded-md px-4 text-sm font-medium text-primario-legible underline-offset-4 hover:underline"
        >
          Ver la sección completa
        </Link>
      </div>
    </div>
  )
}
