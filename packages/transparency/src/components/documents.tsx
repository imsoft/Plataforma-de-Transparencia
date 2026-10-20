import { definition, readableDuration, readableSize } from '@platform/files/types'
import { ArrowUpRightIcon, CalendarIcon } from 'lucide-react'
import type { PublicDocument, PublicNotice } from '../next/data'
import { documentRoute } from '../routes'
import { FileIcon } from './file-icon'

const date = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(iso))
    : ''

export function PublicDocumentList({
  documents,
  notices,
  compact = false,
}: {
  documents: PublicDocument[]
  notices: PublicNotice[]
  compact?: boolean
}) {
  if (documents.length === 0 && notices.length === 0) {
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
      {documents.length > 0 && (
        <ul className={compact ? 'divide-y divide-neutral-200' : 'grid gap-3'}>
          {documents.map((d) => (
            <li key={d.id}>
              <DocumentCard d={d} compact={compact} />
            </li>
          ))}
        </ul>
      )}
      {notices.length > 0 && (
        <ul className="flex flex-col gap-2">
          {notices.map((l) => (
            <li
              key={l.id}
              className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm"
            >
              <p className="font-semibold text-neutral-800">
                {l.periodLabel}: no se generó información
              </p>
              <p className="mt-1 text-neutral-600">{l.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function DocumentCard({ d, compact = false }: { d: PublicDocument; compact?: boolean }) {
  const external = d.type === 'external_video'
  const def = d.version ? definition(d.version.fileType) : null
  const action = external ? 'Ver video' : (def?.action ?? 'Abrir')
  const detail = external
    ? 'Video'
    : d.version
      ? `${def?.name ?? ''} · ${d.version.fileType === 'video' && d.version.durationSec ? readableDuration(d.version.durationSec) : readableSize(d.version.size)}`
      : ''
  return (
    <a
      href={documentRoute(d.id)}
      target={external || def?.disposition === 'inline' ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className={`group flex items-center gap-4 bg-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario-legible ${compact ? 'px-3 py-3 hover:bg-primario-suave/50' : 'rounded-2xl border border-neutral-200 p-4 hover:-translate-y-px hover:border-neutral-300 hover:shadow-md sm:p-5'}`}
    >
      <FileIcon
        type={d.version?.fileType ?? null}
        external={external}
        className={compact ? 'size-10' : 'size-12 rounded-xl'}
      />
      <span className="min-w-0 flex-1">
        <span
          className={`block font-medium text-neutral-900 group-hover:text-primario-legible ${compact ? '' : 'text-[1.0625rem]'}`}
        >
          {d.name}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-600">
          <span>{detail}</span>
          {d.periodLabel && (
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="size-3" aria-hidden="true" /> {d.periodLabel}
            </span>
          )}
          {d.publishedAt && <span>Publicado el {date(d.publishedAt)}</span>}
        </span>
      </span>
      <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-primario-suave px-3 py-1.5 text-sm font-semibold text-primario-legible sm:inline-flex">
        {action} <ArrowUpRightIcon className="size-4" aria-hidden="true" />
      </span>
    </a>
  )
}
