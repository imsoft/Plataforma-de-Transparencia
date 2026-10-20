/**
 * Página catch-all de transparencia. Las apps la montan en `app/[...segmentos]/page.tsx`:
 *   export { Pagina as default, generateMetadata, revalidate, dynamicParams } from '@plataforma/transparencia/next/pagina'
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { ArbolPublico } from '../componentes/arbol-publico'
import { BotonCompartir } from '../componentes/boton-compartir'
import { ListaDocumentosPublica } from '../componentes/documentos'
import { Migas, type Miga } from '../componentes/migas'
import { resolverSegmentos, rutaDeNodo, rutaDePortada } from '../rutas'
import { configSitio } from './config'
import {
  obtenerDocumentosDeSujeto,
  obtenerMunicipio,
  obtenerNodo,
  obtenerNodos,
  type MunicipioPublico,
} from './datos'
import {
  jsonLdMigas,
  metadatosDeNodo,
  metadatosDePortada,
  nombreSujeto,
  tituloDeRuta,
} from './metadatos'

type Props = { params: Promise<{ segmentos: string[] }> }

async function resolver(segmentos: string[]) {
  const m = await obtenerMunicipio()
  if (!m) return null
  const prefijos = m.sujetos.map((s) => s.prefijo).filter(Boolean)
  const raiz = await obtenerNodos('')
  const secciones = raiz.filter((n) => n.rutaSlug).map((n) => n.rutaSlug!)
  return { m, r: resolverSegmentos(segmentos, prefijos, secciones) }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segmentos } = await params
  const x = await resolver(segmentos)
  if (!x) return {}
  const { m, r } = x
  if (r.tipo === 'portada') return metadatosDePortada(m, r.prefijo, rutaDePortada(r.prefijo))
  if (r.tipo === 'clave' || r.tipo === 'seccion') {
    const datos = await obtenerNodo(r.prefijo, r.tipo === 'clave' ? r.clave : r.rutaSlug, r.version)
    if (!datos) return {}
    return metadatosDeNodo(
      m,
      r.prefijo,
      datos.nodo,
      datos.ruta,
      rutaDeNodo(r.prefijo, datos.nodo.clave, datos.nodo.rutaSlug),
      datos.documentos.length,
    )
  }
  if (r.tipo === 'articulo') {
    const nodos = await obtenerNodos(r.prefijo, r.version)
    const art = nodos.find((n) => n.nivel === 'articulo' && n.numero === r.numero)
    if (!art) return {}
    return metadatosDeNodo(
      m,
      r.prefijo,
      art,
      [art],
      `/${r.prefijo ? `${r.prefijo}/` : ''}articulo-${r.numero}`,
      nodos.filter((n) => n.padreId).length,
    )
  }
  return {}
}

export async function Pagina({ params }: Props) {
  const { segmentos } = await params
  const x = await resolver(segmentos)
  if (!x) notFound()
  const { m, r } = x
  if (r.tipo === 'redirigir') permanentRedirect(r.destino)
  if (r.tipo === 'no_encontrado') notFound()
  const { urlBase } = configSitio()
  const sujeto = nombreSujeto(m, r.prefijo)
  const portada = rutaDePortada(r.prefijo)

  if (r.tipo === 'portada') {
    const [nodos, docs] = await Promise.all([
      obtenerNodos(r.prefijo, r.version),
      obtenerDocumentosDeSujeto(r.prefijo),
    ])
    const redes = m.redes.filter((x) =>
      r.prefijo
        ? x.sujetoObligadoId === m.sujetos.find((s) => s.prefijo === r.prefijo)?.id
        : !x.sujetoObligadoId,
    )
    return (
      <Contenedor
        m={m}
        migas={[
          { href: '/', etiqueta: 'Inicio' },
          { etiqueta: `Transparencia${r.prefijo ? ` · ${sujeto}` : ''}` },
        ]}
      >
        <Encabezado
          titulo="Transparencia"
          subtitulo={`Información fundamental de ${sujeto}${m.version ? ` · ${m.version.nombre}` : ''}`}
          url={`${urlBase}${portada}`}
        />
        {m.sujetos.length > 1 && (
          <nav aria-label="Sujetos obligados" className="mb-6 flex flex-wrap gap-2">
            {m.sujetos.map((s) => (
              <Link
                key={s.id}
                href={rutaDePortada(s.prefijo)}
                aria-current={s.prefijo === r.prefijo ? 'page' : undefined}
                className={`inline-flex h-11 items-center rounded-full border px-5 text-sm font-semibold transition ${s.prefijo === r.prefijo ? 'border-primario-legible bg-primario-legible text-sobre-primario shadow-sm' : 'border-neutral-300 bg-white hover:bg-primario-suave'}`}
              >
                {s.prefijo ? s.nombre : 'Ayuntamiento'}
              </Link>
            ))}
          </nav>
        )}
        {nodos.length === 0 ? (
          <p className="text-neutral-600">Próximamente.</p>
        ) : (
          <ArbolPublico nodos={nodos} prefijo={r.prefijo} documentosPorNodo={docs} abrirPrimero />
        )}
        {redes.length > 0 && (
          <p className="sr-only">Redes sociales de {sujeto} en el pie de página.</p>
        )}
      </Contenedor>
    )
  }

  if (r.tipo === 'articulo') {
    const nodos = await obtenerNodos(r.prefijo, r.version)
    const art = nodos.find((n) => n.nivel === 'articulo' && n.numero === r.numero && n.clave)
    if (!art) notFound()
    const sub = nodos.filter((n) => n.id === art.id || esDescendiente(nodos, n, art.id))
    const docs = await obtenerDocumentosDeSujeto(r.prefijo)
    return (
      <Contenedor
        m={m}
        migas={[
          { href: '/', etiqueta: 'Inicio' },
          { href: portada, etiqueta: 'Transparencia' },
          { etiqueta: art.etiqueta },
        ]}
      >
        <Encabezado
          clave={art.clave}
          titulo={`${art.etiqueta}. ${art.titulo}`}
          subtitulo={sujeto}
          url={`${urlBase}${rutaDeNodo(r.prefijo, art.clave, null)}`}
        />
        <ArbolPublico nodos={sub} prefijo={r.prefijo} documentosPorNodo={docs} abrirPrimero />
      </Contenedor>
    )
  }

  const datos = await obtenerNodo(r.prefijo, r.tipo === 'clave' ? r.clave : r.rutaSlug, r.version)
  if (!datos) notFound()
  const { nodo, ruta, hijos, documentos, leyendas } = datos
  const migas: Miga[] = [
    { href: '/', etiqueta: 'Inicio' },
    { href: portada, etiqueta: 'Transparencia' },
    ...ruta
      .slice(0, -1)
      .map((n) => ({ href: rutaDeNodo(r.prefijo, n.clave, n.rutaSlug), etiqueta: n.etiqueta })),
    { etiqueta: nodo.etiqueta },
  ]
  const jsonLd = jsonLdMigas([
    { nombre: 'Inicio', ruta: '/' },
    { nombre: 'Transparencia', ruta: portada },
    ...ruta.map((n) => ({ nombre: n.etiqueta, ruta: rutaDeNodo(r.prefijo, n.clave, n.rutaSlug) })),
  ])
  const docsHijos = hijos.length > 0 ? await obtenerDocumentosDeSujeto(r.prefijo) : undefined
  return (
    <Contenedor m={m} migas={migas}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Encabezado
        clave={nodo.clave}
        titulo={nodo.titulo}
        subtitulo={`${tituloDeRuta(ruta)} · ${sujeto}${r.version ? ` · versión ${r.version}` : ''}`}
        url={`${urlBase}${rutaDeNodo(r.prefijo, nodo.clave, nodo.rutaSlug)}`}
      />
      {nodo.descripcion && <p className="mb-6 max-w-3xl text-neutral-700">{nodo.descripcion}</p>}
      {hijos.length > 0 ? (
        <ArbolPublico
          nodos={[nodo, ...hijosRecursivos(await obtenerNodos(r.prefijo, r.version), nodo.id)]}
          prefijo={r.prefijo}
          documentosPorNodo={docsHijos}
          abrirPrimero
        />
      ) : (
        <ListaDocumentosPublica documentos={documentos} leyendas={leyendas} />
      )}
    </Contenedor>
  )
}

function esDescendiente(
  nodos: { id: string; padreId: string | null }[],
  n: { padreId: string | null },
  raizId: string,
): boolean {
  let p = n.padreId
  const porId = new Map(nodos.map((x) => [x.id, x]))
  while (p) {
    if (p === raizId) return true
    p = porId.get(p)?.padreId ?? null
  }
  return false
}
function hijosRecursivos<T extends { id: string; padreId: string | null }>(
  nodos: T[],
  raizId: string,
): T[] {
  return nodos.filter((n) => esDescendiente(nodos, n, raizId))
}

function Contenedor({
  m,
  migas,
  children,
}: {
  m: MunicipioPublico
  migas: Miga[]
  children: React.ReactNode
}) {
  void m
  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-10 sm:px-6 md:pt-8">
      <Migas migas={migas} />
      <div className="mt-5">{children}</div>
    </div>
  )
}

function Encabezado({
  clave,
  titulo,
  subtitulo,
  url,
}: {
  clave?: string | null
  titulo: string
  subtitulo: string
  url: string
}) {
  return (
    <header className="relative mb-8 overflow-hidden rounded-3xl bg-primario-legible px-6 py-8 text-sobre-primario sm:px-8 sm:py-10">
      <div
        className="absolute -top-24 -right-24 size-72 rounded-full bg-white/10 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {clave && (
            <p className="font-mono text-sm font-semibold tracking-wider opacity-85">{clave}</p>
          )}
          <h1 className="font-heading mt-1 text-3xl font-bold leading-tight text-balance md:text-4xl">
            {titulo}
          </h1>
          <p className="mt-2 text-sm opacity-85">{subtitulo}</p>
        </div>
        <BotonCompartir url={url} titulo={titulo} className="shrink-0" claro />
      </div>
    </header>
  )
}
