import { definicion, duracionLegible, tamanoLegible } from '@plataforma/archivos/tipos'
import { ArrowUpRightIcon, CalendarIcon } from 'lucide-react'
import type { DocumentoPublico, LeyendaPublica } from '../next/datos'
import { rutaDeDocumento } from '../rutas'
import { IconoArchivo } from './icono-archivo'

const fecha = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(iso))
    : ''

export function ListaDocumentosPublica({
  documentos,
  leyendas,
  compacta = false,
}: {
  documentos: DocumentoPublico[]
  leyendas: LeyendaPublica[]
  compacta?: boolean
}) {
  if (documentos.length === 0 && leyendas.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center">
        <p className="font-heading text-lg font-semibold text-neutral-800">
          Todavía no hay documentos en esta sección
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          Cuando el municipio los publique, aparecerán aquí.
        </p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      {documentos.length > 0 && (
        <ul className={compacta ? 'divide-y divide-neutral-200' : 'grid gap-3'}>
          {documentos.map((d) => (
            <li key={d.id}>
              <TarjetaDocumento d={d} compacta={compacta} />
            </li>
          ))}
        </ul>
      )}
      {leyendas.length > 0 && (
        <ul className="flex flex-col gap-2">
          {leyendas.map((l) => (
            <li
              key={l.id}
              className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm"
            >
              <p className="font-semibold text-neutral-800">
                {l.periodoEtiqueta}: no se generó información
              </p>
              <p className="mt-1 text-neutral-600">{l.texto}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function TarjetaDocumento({
  d,
  compacta = false,
}: {
  d: DocumentoPublico
  compacta?: boolean
}) {
  const externo = d.tipo === 'video_externo'
  const def = d.version ? definicion(d.version.tipoArchivo) : null
  const accion = externo ? 'Ver video' : (def?.accion ?? 'Abrir')
  const detalle = externo
    ? 'Video'
    : d.version
      ? `${def?.nombre ?? ''} · ${d.version.tipoArchivo === 'video' && d.version.duracionSeg ? duracionLegible(d.version.duracionSeg) : tamanoLegible(d.version.tamano)}`
      : ''
  return (
    <a
      href={rutaDeDocumento(d.id)}
      target={externo || def?.disposicion === 'inline' ? '_blank' : undefined}
      rel={externo ? 'noopener noreferrer' : undefined}
      className={`group flex items-center gap-4 bg-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario-legible ${compacta ? 'px-3 py-3 hover:bg-primario-suave/50' : 'rounded-2xl border border-neutral-200 p-4 hover:-translate-y-px hover:border-neutral-300 hover:shadow-md sm:p-5'}`}
    >
      <IconoArchivo
        tipo={d.version?.tipoArchivo ?? null}
        externo={externo}
        className={compacta ? 'size-10' : 'size-12 rounded-xl'}
      />
      <span className="min-w-0 flex-1">
        <span
          className={`block font-medium text-neutral-900 group-hover:text-primario-legible ${compacta ? '' : 'text-[1.0625rem]'}`}
        >
          {d.nombre}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-600">
          <span>{detalle}</span>
          {d.periodoEtiqueta && (
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="size-3" aria-hidden="true" /> {d.periodoEtiqueta}
            </span>
          )}
          {d.publicadoEn && <span>Publicado el {fecha(d.publicadoEn)}</span>}
        </span>
      </span>
      <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-primario-suave px-3 py-1.5 text-sm font-semibold text-primario-legible sm:inline-flex">
        {accion} <ArrowUpRightIcon className="size-4" aria-hidden="true" />
      </span>
    </a>
  )
}
