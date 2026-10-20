import { firmarLectura, tamanoLegible } from '@plataforma/archivos'
import { conUsuario, bitacora as tablaBitacora, desc, eq, and } from '@plataforma/db'
import { documentoPorId } from '@plataforma/db/consultas/documentos'
import { Badge } from '@plataforma/ui/components/badge'
import { Button } from '@plataforma/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@plataforma/ui/components/card'
import { ExternalLinkIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CopiarEnlace } from '@/components/copiar-enlace'
import { IconoArchivo } from '@/components/icono-archivo'
import { Reemplazar } from '@/components/documentos/reemplazar'
import { fechaHora } from '@/lib/fechas'
import { contextoMunicipio } from '@/lib/municipio'
import { baseSitio, segmentoPanel } from '@/lib/urls'

export const metadata: Metadata = { title: 'Documento' }

const ACCION: Record<string, string> = {
  crear: 'Se publicó',
  renombrar: 'Se renombró',
  reemplazar: 'Se reemplazó el archivo',
  reordenar: 'Se reordenó',
  cambiar_periodo: 'Se cambió el periodo',
  ocultar: 'Se ocultó del sitio',
  historico: 'Se mandó a histórico',
  papelera: 'Se mandó a la papelera',
  restaurar: 'Se restauró',
  publicar: 'Se publicó de nuevo',
  actualizar: 'Se actualizó',
}

export default async function PaginaDocumento({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const c = await contextoMunicipio(slug)
  const datos = await conUsuario(c.ctx, async (tx) => {
    const doc = await documentoPorId(tx, id)
    if (!doc || doc.municipioId !== c.municipio.id) return null
    const historial = await tx
      .select()
      .from(tablaBitacora)
      .where(and(eq(tablaBitacora.entidad, 'documento'), eq(tablaBitacora.entidadId, id)))
      .orderBy(desc(tablaBitacora.ocurridoEn))
      .limit(100)
    return { doc, historial }
  })
  if (!datos) notFound()
  const { doc, historial } = datos
  const so = c.municipio.sujetosObligados.find((x) => x.id === doc.sujetoObligadoId)!
  const sitio = baseSitio(c.municipio)
  const puedeEditar = c.puede('documento:reemplazar', {
    sujetoObligadoId: so.id,
    nodoRuta: [doc.nodoId],
  })
  const urlArchivo = doc.versionActual
    ? await firmarLectura(doc.versionActual.rutaR2)
    : doc.urlExterna

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <IconoArchivo
            tipo={doc.versionActual?.tipoArchivo ?? null}
            externo={doc.tipo === 'video_externo'}
            className="size-12"
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold leading-tight">{doc.nombre}</h1>
            <p className="text-sm text-muted-foreground">
              <Link
                href={`/m/${slug}/${segmentoPanel(so)}/${doc.nodo.clave ?? doc.nodo.rutaSlug}`}
                className="hover:underline"
              >
                {doc.nodo.clave ?? doc.nodo.rutaSlug} · {doc.nodo.titulo}
              </Link>
              {doc.periodoEtiqueta && ` · ${doc.periodoEtiqueta}`}
            </p>
            <p className="mt-1 flex flex-wrap gap-1">
              <Badge variant={doc.estado === 'publicado' ? 'default' : 'secondary'}>
                {doc.estado}
              </Badge>
              {doc.versionActual && (
                <Badge variant="outline">
                  {doc.versionActual.tipoArchivo.toUpperCase()} ·{' '}
                  {tamanoLegible(doc.versionActual.tamano)}
                </Badge>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <CopiarEnlace url={`${sitio}/d/${doc.id}`} etiqueta="Copiar enlace permanente" />
          {urlArchivo && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={urlArchivo} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLinkIcon aria-hidden /> Abrir archivo
            </Button>
          )}
          {puedeEditar && doc.tipo === 'archivo' && (
            <Reemplazar
              slug={slug}
              documentoId={doc.id}
              nombreActual={doc.versionActual?.nombreOriginal ?? ''}
            />
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Versiones del archivo</CardTitle>
          </CardHeader>
          <CardContent>
            {doc.versiones.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este documento es un enlace externo: {doc.urlExterna}
              </p>
            ) : (
              <ul className="divide-y">
                {doc.versiones.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        Versión {v.numero} {v.vigente && <Badge variant="secondary">vigente</Badge>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {v.nombreOriginal} · {tamanoLegible(v.tamano)} · {fechaHora(v.creadoEn)}
                      </p>
                    </div>
                    <VerVersion ruta={v.rutaR2} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {historial.map((h) => (
                <li key={h.id} className="py-2 text-sm">
                  <p className="font-medium">{ACCION[h.accion] ?? h.accion}</p>
                  <p className="text-xs text-muted-foreground">
                    {fechaHora(h.ocurridoEn)} · {h.actorId} ({h.actorRol ?? 'sistema'})
                  </p>
                  {h.cambios && h.accion !== 'crear' && (
                    <ul className="mt-1 text-xs text-muted-foreground">
                      {Object.entries(h.cambios)
                        .filter(([k]) =>
                          ['nombre', 'estado', 'periodo_etiqueta', 'orden'].includes(k),
                        )
                        .map(([k, v]) => (
                          <li key={k}>
                            {k}: {mostrar(v.antes)} → {mostrar(v.despues)}
                          </li>
                        ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const mostrar = (v: unknown): string => {
  if (v == null) return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

async function VerVersion({ ruta }: { ruta: string }) {
  const url = await firmarLectura(ruta)
  return (
    <Button
      variant="ghost"
      size="sm"
      nativeButton={false}
      render={<a href={url} target="_blank" rel="noopener noreferrer" />}
    >
      Ver
    </Button>
  )
}
