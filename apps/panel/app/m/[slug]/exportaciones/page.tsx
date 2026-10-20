import { Badge } from '@plataforma/ui/components/badge'
import { Button } from '@plataforma/ui/components/button'
import { DownloadIcon } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { listarExportaciones } from '@/acciones/exportaciones'
import { BotonExportar } from '@/components/exportaciones/boton'
import { fechaHora } from '@/lib/fechas'
import { contextoMunicipio } from '@/lib/municipio'

export const metadata: Metadata = { title: 'Exportación completa' }

const ESTADO: Record<
  string,
  { texto: string; variante: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pendiente: { texto: 'En espera', variante: 'secondary' },
  generando: { texto: 'Generando…', variante: 'secondary' },
  lista: { texto: 'Lista', variante: 'default' },
  error: { texto: 'Falló', variante: 'destructive' },
}

export default async function PaginaExportaciones({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const c = await contextoMunicipio(slug)
  if (!c.puede('exportacion:ver')) notFound()
  const lista = await listarExportaciones(slug)
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
        {c.puede('exportacion:solicitar') && <BotonExportar slug={slug} />}
      </div>
      {lista.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          Todavía no se ha generado ninguna exportación.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {lista.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  Solicitada el {fechaHora(e.creadaEn)}{' '}
                  <Badge variant={ESTADO[e.estado]?.variante}>{ESTADO[e.estado]?.texto}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {e.terminadaEn
                    ? `Terminó el ${fechaHora(e.terminadaEn)}`
                    : 'Te avisamos por correo cuando esté lista.'}
                  {e.mensajeError ? ` · ${e.mensajeError}` : ''}
                </p>
              </div>
              {e.enlace && (
                <Button variant="outline" nativeButton={false} render={<a href={e.enlace} />}>
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
