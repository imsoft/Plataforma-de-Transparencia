import { Badge } from '@platform/ui/components/badge'
import { Button } from '@platform/ui/components/button'
import { DownloadIcon } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { listExports } from '@/actions/exports'
import { ExportButton } from '@/components/exports/button'
import { dateTime } from '@/lib/dates'
import { municipalityContext } from '@/lib/municipality'

export const metadata: Metadata = { title: 'Exportación completa' }

const STATUS_LABEL: Record<
  string,
  { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { text: 'En espera', variant: 'secondary' },
  generating: { text: 'Generando…', variant: 'secondary' },
  list: { text: 'Lista', variant: 'default' },
  error: { text: 'Falló', variant: 'destructive' },
}

export default async function ExportsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await municipalityContext(slug)
  if (!c.can('exportJob:view')) notFound()
  const list = await listExports(slug)
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Exportación completa</h1>
          <p className="text-sm text-muted-foreground">
            Un ZIP con todos los archivos del municipio ordenados por sujeto obligado y sección, más
            los metadatos y la bitácora. Es tu respaldo y el kit de entrega-recepción para el cambio
            de administración.
          </p>
        </div>
        {c.can('exportJob:request') && <ExportButton slug={slug} />}
      </div>
      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          Todavía no se ha generado ninguna exportación.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {list.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  Solicitada el {dateTime(e.createdAt)}{' '}
                  <Badge variant={STATUS_LABEL[e.status]?.variant}>
                    {STATUS_LABEL[e.status]?.text}
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {e.finishedAt
                    ? `Terminó el ${dateTime(e.finishedAt)}`
                    : 'Te avisamos por correo cuando esté lista.'}
                  {e.errorMessage ? ` · ${e.errorMessage}` : ''}
                </p>
              </div>
              {e.link && (
                <Button variant="outline" nativeButton={false} render={<a href={e.link} />}>
                  <DownloadIcon aria-hidden /> Descargar ZIP
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
