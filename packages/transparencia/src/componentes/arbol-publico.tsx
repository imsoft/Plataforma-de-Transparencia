import { ChevronDownIcon, FolderOpenIcon } from 'lucide-react'
import Link from 'next/link'
import { construirArbol, type NodoArbol } from '@plataforma/db/consultas/indice'
import type { DocumentoPublico, NodoPublico } from '../next/datos'
import { rutaDeNodo } from '../rutas'
import { ListaDocumentosPublica } from './documentos'

type N = NodoArbol<NodoPublico>

/** Índice completo en acordeón nativo (<details>): funciona sin JavaScript y es accesible. */
export function ArbolPublico({
  nodos,
  prefijo,
  documentosPorNodo,
  abrirPrimero = false,
}: {
  nodos: NodoPublico[]
  prefijo: string
  documentosPorNodo?: Record<string, DocumentoPublico[]>
  abrirPrimero?: boolean
}) {
  const arbol = construirArbol(nodos)
  const totales = new Map<string, number>()
  const sumar = (n: N): number => {
    const t = n.documentos + n.hijos.reduce((a, h) => a + sumar(h), 0)
    totales.set(n.id, t)
    return t
  }
  arbol.forEach(sumar)

  const Rama = ({ n, nivel }: { n: N; nivel: number }) => {
    const href = rutaDeNodo(prefijo, n.clave, n.rutaSlug)
    const total = totales.get(n.id) ?? 0
    const sangria = { paddingLeft: `${1 + nivel * 1.25}rem` }
    if (n.hijos.length === 0) {
      return (
        <li className="border-t border-neutral-200">
          <Link
            href={href}
            className="flex items-center gap-3 py-3 pr-4 transition hover:bg-primario-suave/60"
            style={sangria}
          >
            <span className="w-14 shrink-0 font-mono text-sm font-semibold text-primario-legible">
              {n.clave ?? ''}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-medium text-neutral-900">
                {n.titulo}
              </span>
              <span className="block text-xs text-neutral-500">{n.etiqueta}</span>
            </span>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${total > 0 ? 'bg-primario-suave text-primario-legible' : 'bg-neutral-100 text-neutral-500'}`}
            >
              {total}
            </span>
          </Link>
          {documentosPorNodo && (documentosPorNodo[n.id]?.length ?? 0) > 0 && (
            <div className="bg-neutral-50/80 pr-2 pb-2" style={sangria}>
              <ListaDocumentosPublica
                documentos={documentosPorNodo[n.id]!}
                leyendas={[]}
                compacta
              />
            </div>
          )}
        </li>
      )
    }
    return (
      <li className="border-t border-neutral-200">
        <details open={abrirPrimero && nivel === 0} className="group">
          <summary
            className="flex cursor-pointer list-none items-center gap-3 py-3.5 pr-4 transition hover:bg-primario-suave/60 [&::-webkit-details-marker]:hidden"
            style={sangria}
          >
            <ChevronDownIcon
              className="size-5 shrink-0 text-neutral-400 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
            <span className="w-14 shrink-0 font-mono text-sm font-semibold text-primario-legible">
              {n.clave ?? ''}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block font-medium text-neutral-900 ${nivel === 0 ? 'font-heading text-lg' : 'text-[0.9375rem]'}`}
              >
                {n.titulo}
              </span>
              <span className="block text-xs text-neutral-500">{n.etiqueta}</span>
            </span>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${total > 0 ? 'bg-primario-suave text-primario-legible' : 'bg-neutral-100 text-neutral-500'}`}
            >
              {total}
            </span>
          </summary>
          <div
            className="pr-4 pb-2 text-sm"
            style={{ paddingLeft: `${1 + nivel * 1.25 + 2.75}rem` }}
          >
            <Link
              href={href}
              className="inline-flex min-h-11 items-center gap-1 text-primario-legible underline-offset-4 hover:underline"
            >
              <FolderOpenIcon className="size-4" aria-hidden="true" /> Abrir{' '}
              {n.etiqueta.toLowerCase()} en su propia página
            </Link>
          </div>
          <ul>
            {n.hijos.map((h) => (
              <Rama key={h.id} n={h} nivel={nivel + 1} />
            ))}
          </ul>
        </details>
      </li>
    )
  }

  return (
    <ul className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm [&>li:first-child]:border-t-0">
      {arbol.map((n) => (
        <Rama key={n.id} n={n} nivel={0} />
      ))}
    </ul>
  )
}
