import { conUsuario } from '@plataforma/db'
import { coberturaPorNodo, recientes } from '@plataforma/db/consultas/documentos'
import { nodosDe, versionVigente, type NodoIndice } from '@plataforma/db/consultas/indice'
import { Button } from '@plataforma/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@plataforma/ui/components/card'
import { ChevronRightIcon, UploadIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { BuscadorNodos, type NodoBuscable } from '@/components/buscador-nodos'
import { IconoArchivo } from '@/components/icono-archivo'
import { Semaforo } from '@/components/semaforo'
import { relativo } from '@/lib/fechas'
import { contextoMunicipio } from '@/lib/municipio'
import { semaforoDe } from '@/lib/semaforo'
import { segmentoPanel } from '@/lib/urls'

export const metadata: Metadata = { title: 'Inicio' }

export default async function PaginaInicio({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await contextoMunicipio(slug)
  const base = `/m/${slug}`

  const datos = await conUsuario(c.ctx, async (tx) => {
    const version = await versionVigente(tx, c.municipio.estadoId)
    const porSujeto = await Promise.all(
      c.municipio.sujetosObligados
        .filter((so) => so.activo)
        .map(async (so) => ({
          so,
          nodos: version ? await nodosDe(tx, version.id, so.tipoSujetoId) : [],
          cobertura: await coberturaPorNodo(tx, c.municipio.id, so.id),
        })),
    )
    return { version, porSujeto, recientes: await recientes(tx, c.municipio.id, 8) }
  })

  const buscables: NodoBuscable[] = []
  const pendientes: {
    so: string
    nodo: NodoIndice
    estado: 'rojo' | 'amarillo'
    href: string
    periodo: string | null
  }[] = []
  for (const { so, nodos, cobertura } of datos.porSujeto) {
    const conHijos = new Set(nodos.map((n) => n.padreId).filter(Boolean))
    for (const n of nodos) {
      const href = `${base}/${segmentoPanel(so)}/${n.clave ?? n.rutaSlug ?? ''}`
      buscables.push({
        id: n.id,
        clave: n.clave,
        etiqueta: n.etiqueta,
        titulo: n.titulo,
        sujeto: so.prefijo ? so.nombre : 'Ayuntamiento',
        href,
      })
      if (conHijos.has(n.id)) continue // solo hojas cuentan para el semáforo
      const r = semaforoDe(n, cobertura.get(n.id))
      if (r.estado !== 'verde')
        pendientes.push({
          so: so.prefijo ? so.nombre : 'Ayuntamiento',
          nodo: n,
          estado: r.estado,
          href,
          periodo: r.vencidos[0]?.etiqueta ?? r.periodo?.etiqueta ?? null,
        })
    }
  }
  pendientes.sort((a, b) => (a.estado === b.estado ? 0 : a.estado === 'rojo' ? -1 : 1))

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">¿Qué quieres publicar hoy?</h1>
        <BuscadorNodos nodos={buscables} />
        {!datos.version && (
          <p className="text-sm text-destructive">
            Todavía no hay una versión vigente del índice de la ley. El superadministrador debe
            publicarla.
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Te falta subir</CardTitle>
            <span className="text-sm text-muted-foreground">
              {pendientes.length === 0
                ? 'Todo al día'
                : `${pendientes.length} pendiente${pendientes.length === 1 ? '' : 's'}`}
            </span>
          </CardHeader>
          <CardContent>
            {pendientes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay secciones atrasadas ni por vencer. ¡Buen trabajo!
              </p>
            ) : (
              <ul className="divide-y">
                {pendientes.slice(0, 8).map((p) => (
                  <li key={p.nodo.id} className="flex items-center gap-3 py-2.5">
                    <Semaforo estado={p.estado} />
                    <Link href={p.href} className="min-w-0 flex-1 hover:underline">
                      <span className="block truncate text-sm font-medium">
                        {p.nodo.clave ? `${p.nodo.clave} · ` : ''}
                        {p.nodo.titulo}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {p.so}
                        {p.periodo ? ` · ${p.periodo}` : ''}
                      </span>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`${p.href}?subir=1`} />}
                    >
                      <UploadIcon aria-hidden /> Subir
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {datos.recientes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay documentos. Empieza por buscar dónde va el primero.
              </p>
            ) : (
              <ul className="divide-y">
                {datos.recientes.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-2.5">
                    <IconoArchivo
                      tipo={d.versionActual?.tipoArchivo ?? null}
                      externo={d.tipo === 'video_externo'}
                      className="size-9"
                    />
                    <Link
                      href={`${base}/documentos/${d.id}`}
                      className="min-w-0 flex-1 hover:underline"
                    >
                      <span className="block truncate text-sm font-medium">{d.nombre}</span>
                      <span className="block text-xs text-muted-foreground">
                        {d.nodo.clave ?? d.nodo.rutaSlug} · {relativo(d.actualizadoEn)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Explorar por sujeto obligado</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {datos.porSujeto.map(({ so, nodos }) => (
            <Link
              key={so.id}
              href={`${base}/${segmentoPanel(so)}`}
              className="flex items-center justify-between rounded-xl border bg-card p-4 hover:bg-accent"
            >
              <span>
                <span className="block font-medium">{so.prefijo ? so.nombre : 'Ayuntamiento'}</span>
                <span className="block text-sm text-muted-foreground">
                  {nodos.length} secciones del índice
                </span>
              </span>
              <ChevronRightIcon className="size-5 text-muted-foreground" aria-hidden />
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
