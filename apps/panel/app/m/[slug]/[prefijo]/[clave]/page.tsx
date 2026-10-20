import { conUsuario } from '@plataforma/db'
import {
  coberturaPorNodo,
  documentosDeNodo,
  leyendasDeNodo,
} from '@plataforma/db/consultas/documentos'
import {
  nodoPorClave,
  nodoPorRutaSlug,
  nodosDe,
  rutaDeAncestros,
  versionVigente,
} from '@plataforma/db/consultas/indice'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@plataforma/ui/components/breadcrumb'
import { rutaDeNodo } from '@plataforma/transparencia/rutas'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CopiarEnlace } from '@/components/copiar-enlace'
import { ListaDocumentos } from '@/components/documentos/lista'
import { Leyendas } from '@/components/documentos/leyendas'
import { SubirDocumentos } from '@/components/documentos/subir-dialogo'
import { Semaforo } from '@/components/semaforo'
import { contextoMunicipio } from '@/lib/municipio'
import { semaforoDe } from '@/lib/semaforo'
import { baseSitio, segmentoPanel } from '@/lib/urls'

type Params = Promise<{ slug: string; prefijo: string; clave: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { clave } = await params
  return { title: clave }
}

export default async function PaginaNodo({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Promise<{ subir?: string }>
}) {
  const { slug, prefijo, clave } = await params
  const { subir } = await searchParams
  const c = await contextoMunicipio(slug)
  const so = c.municipio.sujetosObligados.find((x) => segmentoPanel(x) === prefijo && x.activo)
  if (!so) notFound()

  const datos = await conUsuario(c.ctx, async (tx) => {
    const version = await versionVigente(tx, c.municipio.estadoId)
    if (!version) return null
    const nodo =
      (await nodoPorClave(tx, version.id, so.tipoSujetoId, clave)) ??
      (await nodoPorRutaSlug(tx, version.id, so.tipoSujetoId, clave))
    if (!nodo) return null
    const nodos = await nodosDe(tx, version.id, so.tipoSujetoId)
    const hijos = nodos.filter((n) => n.padreId === nodo.id)
    const ruta = rutaDeAncestros(nodos, nodo.id)
    const [docs, leyendas, cobertura] = await Promise.all([
      documentosDeNodo(tx, {
        municipioId: c.municipio.id,
        sujetoObligadoId: so.id,
        nodoId: nodo.id,
      }),
      leyendasDeNodo(tx, { municipioId: c.municipio.id, sujetoObligadoId: so.id, nodoId: nodo.id }),
      coberturaPorNodo(tx, c.municipio.id, so.id),
    ])
    return { nodo, hijos, ruta, docs, leyendas, cobertura }
  })
  if (!datos) notFound()
  const { nodo, hijos, ruta, docs, leyendas, cobertura } = datos
  const base = `/m/${slug}/${prefijo}`
  const sitio = baseSitio(c.municipio)
  const urlPublica = `${sitio}${rutaDeNodo(so.prefijo, nodo.clave, nodo.rutaSlug)}`
  const esHoja = hijos.length === 0
  const semaforo = esHoja ? semaforoDe(nodo, cobertura.get(nodo.id)) : null
  const puedeSubir = c.puede('documento:subir', {
    sujetoObligadoId: so.id,
    nodoRuta: ruta.map((n) => n.id),
  })

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={base} />}>
              {so.prefijo ? so.nombre : 'Ayuntamiento'}
            </BreadcrumbLink>
          </BreadcrumbItem>
          {ruta.slice(0, -1).map((n) => (
            <span key={n.id} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href={`${base}/${n.clave ?? n.rutaSlug}`} />}>
                  {n.etiqueta}
                </BreadcrumbLink>
              </BreadcrumbItem>
            </span>
          ))}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{nodo.etiqueta}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-sm text-primary">{nodo.clave ?? nodo.rutaSlug}</p>
          <h1 className="text-2xl font-semibold leading-tight">{nodo.titulo}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{ruta.map((n) => n.etiqueta).join(', ')}</span>
            <span>· Periodicidad: {nodo.periodicidad}</span>
            {semaforo && <Semaforo estado={semaforo.estado} conTexto />}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <CopiarEnlace url={urlPublica} etiqueta="Copiar enlace de esta sección" />
          {puedeSubir && esHoja && (
            <SubirDocumentos
              slug={slug}
              sujetoObligadoId={so.id}
              nodoId={nodo.id}
              nodoTitulo={`${nodo.clave ?? ''} ${nodo.titulo}`.trim()}
              periodicidad={nodo.periodicidad}
              abrirInicial={subir === '1'}
              sitio={sitio}
            />
          )}
        </div>
      </header>

      {!esHoja && (
        <ul className="rounded-xl border bg-card">
          {hijos.map((h) => {
            const est = semaforoDe(h, cobertura.get(h.id)).estado
            return (
              <li key={h.id} className="border-t first:border-t-0">
                <Link
                  href={`${base}/${h.clave ?? h.rutaSlug}`}
                  className="flex items-center gap-3 px-3 py-3 hover:bg-accent/60"
                >
                  <Semaforo estado={est} />
                  <span className="w-12 shrink-0 font-mono text-sm text-primary">{h.clave}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{h.titulo}</span>
                    <span className="block text-xs text-muted-foreground">
                      {h.etiqueta} · {cobertura.get(h.id)?.total ?? 0} documento
                      {cobertura.get(h.id)?.total === 1 ? '' : 's'}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {esHoja && (
        <>
          <ListaDocumentos
            slug={slug}
            docs={docs}
            sitio={sitio}
            sujetoObligadoId={so.id}
            nodoId={nodo.id}
            puedeEditar={c.puede('documento:renombrar', {
              sujetoObligadoId: so.id,
              nodoRuta: ruta.map((n) => n.id),
            })}
          />
          {nodo.periodicidad !== 'permanente' && (
            <Leyendas
              slug={slug}
              sujetoObligadoId={so.id}
              nodoId={nodo.id}
              periodicidad={nodo.periodicidad}
              leyendas={leyendas.map((l) => ({
                id: l.id,
                etiqueta: l.periodoEtiqueta ?? '',
                texto: l.texto,
              }))}
              puedeMarcar={c.puede('leyenda:marcar', {
                sujetoObligadoId: so.id,
                nodoRuta: ruta.map((n) => n.id),
              })}
            />
          )}
        </>
      )}
    </div>
  )
}
