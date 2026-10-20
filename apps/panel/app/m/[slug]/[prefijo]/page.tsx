import { conUsuario } from '@plataforma/db'
import { coberturaPorNodo } from '@plataforma/db/consultas/documentos'
import {
  construirArbol,
  nodosDe,
  versionVigente,
  type NodoArbol,
  type NodoIndice,
} from '@plataforma/db/consultas/indice'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@plataforma/ui/components/collapsible'
import { ChevronDownIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CopiarEnlace } from '@/components/copiar-enlace'
import { Semaforo } from '@/components/semaforo'
import { contextoMunicipio } from '@/lib/municipio'
import { semaforoDe } from '@/lib/semaforo'
import { baseSitio, segmentoPanel } from '@/lib/urls'
import { rutaDeNodo, rutaDePortada } from '@plataforma/transparencia/rutas'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; prefijo: string }>
}): Promise<Metadata> {
  const { prefijo } = await params
  return { title: prefijo === 'ayuntamiento' ? 'Ayuntamiento' : prefijo.toUpperCase() }
}

export default async function PaginaArbol({
  params,
}: {
  params: Promise<{ slug: string; prefijo: string }>
}) {
  const { slug, prefijo } = await params
  const c = await contextoMunicipio(slug)
  const so = c.municipio.sujetosObligados.find((x) => segmentoPanel(x) === prefijo && x.activo)
  if (!so) notFound()

  const { nodos, cobertura } = await conUsuario(c.ctx, async (tx) => {
    const version = await versionVigente(tx, c.municipio.estadoId)
    return {
      nodos: version ? await nodosDe(tx, version.id, so.tipoSujetoId) : [],
      cobertura: await coberturaPorNodo(tx, c.municipio.id, so.id),
    }
  })
  const arbol = construirArbol(nodos)
  const base = `/m/${slug}/${prefijo}`
  const sitio = baseSitio(c.municipio)

  /** Total de documentos en el nodo y sus descendientes. */
  const totales = new Map<string, number>()
  const sumar = (n: NodoArbol<NodoIndice>): number => {
    const t = (cobertura.get(n.id)?.total ?? 0) + n.hijos.reduce((acc, h) => acc + sumar(h), 0)
    totales.set(n.id, t)
    return t
  }
  arbol.forEach(sumar)

  const Nodo = ({ n }: { n: NodoArbol<NodoIndice> }) => {
    const hoja = n.hijos.length === 0
    const href = `${base}/${n.clave ?? n.rutaSlug ?? ''}`
    const estado = hoja ? semaforoDe(n, cobertura.get(n.id)).estado : null
    const fila = (
      <div className="flex min-w-0 flex-1 items-center gap-3 py-2.5">
        {hoja ? (
          <Semaforo estado={estado!} />
        ) : (
          <ChevronDownIcon
            className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-0 group-data-[closed]:-rotate-90"
            aria-hidden
          />
        )}
        <span className="w-12 shrink-0 font-mono text-sm text-primary">{n.clave ?? ''}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{n.titulo}</span>
          <span className="block text-xs text-muted-foreground">
            {n.etiqueta} · {totales.get(n.id) ?? 0} documento{totales.get(n.id) === 1 ? '' : 's'}
          </span>
        </span>
      </div>
    )
    if (hoja) {
      return (
        <li
          className="flex items-center gap-2 border-t pl-2 pr-1"
          style={{ marginLeft: `${n.profundidad * 1.25}rem` }}
        >
          <Link href={href} className="min-w-0 flex-1 rounded-md hover:bg-accent/60">
            {fila}
          </Link>
          <CopiarEnlace
            url={`${sitio}${rutaDeNodo(so.prefijo, n.clave, n.rutaSlug)}`}
            soloIcono
            size="icon-sm"
            variant="ghost"
          />
        </li>
      )
    }
    return (
      <li className="border-t" style={{ marginLeft: `${n.profundidad * 1.25}rem` }}>
        <Collapsible defaultOpen={n.profundidad === 0 && arbol.length <= 3}>
          <div className="flex items-center gap-2 pl-2 pr-1">
            <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center rounded-md text-left hover:bg-accent/60">
              {fila}
            </CollapsibleTrigger>
            <Link href={href} className="text-xs text-primary underline-offset-4 hover:underline">
              Ver
            </Link>
            <CopiarEnlace
              url={`${sitio}${rutaDeNodo(so.prefijo, n.clave, n.rutaSlug)}`}
              soloIcono
              size="icon-sm"
              variant="ghost"
            />
          </div>
          <CollapsibleContent>
            <ul>
              {n.hijos.map((h) => (
                <Nodo key={h.id} n={h} />
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{so.prefijo ? so.nombre : 'Ayuntamiento'}</h1>
          <p className="text-sm text-muted-foreground">
            Elige la sección del índice donde va tu documento.
          </p>
        </div>
        <CopiarEnlace
          url={`${sitio}${rutaDePortada(so.prefijo)}`}
          etiqueta="Copiar enlace de la transparencia"
        />
      </div>
      {nodos.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          No hay índice cargado para este sujeto obligado.
        </p>
      ) : (
        <ul className="rounded-xl border bg-card">
          {arbol.map((n) => (
            <Nodo key={n.id} n={n} />
          ))}
        </ul>
      )}
    </div>
  )
}
