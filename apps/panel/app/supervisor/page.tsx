import { Badge } from '@plataforma/ui/components/badge'
import { Button } from '@plataforma/ui/components/button'
import { Progress } from '@plataforma/ui/components/progress'
import { ChevronRightIcon, FileSpreadsheetIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Semaforo } from '@/components/semaforo'
import { relativo } from '@/lib/fechas'
import { exigirSesion } from '@/lib/sesion'
import { tableroCompleto } from '@/lib/tablero'

export const metadata: Metadata = { title: 'Tablero de municipios' }

export default async function PaginaTablero() {
  const s = await exigirSesion()
  const filas = await tableroCompleto(s)
  const totalPendientes = filas.reduce((a, f) => a + f.rojos + f.amarillos, 0)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tablero de municipios</h1>
          <p className="text-sm text-muted-foreground">
            {filas.length} municipio{filas.length === 1 ? '' : 's'} · {totalPendientes} sección
            {totalPendientes === 1 ? '' : 'es'} pendiente{totalPendientes === 1 ? '' : 's'}. El
            avance es el porcentaje de secciones al día.
          </p>
        </div>
        <Button variant="outline" nativeButton={false} render={<a href="/supervisor/reporte" />}>
          <FileSpreadsheetIcon aria-hidden /> Descargar reporte en Excel
        </Button>
      </div>

      {filas.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          Todavía no tienes municipios asignados. Pide al superadministrador que te asigne.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filas.map((m) => (
            <li key={m.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold">
                    <Semaforo estado={m.estado} /> {m.nombreOficial}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Última actualización:{' '}
                    {m.ultimaActualizacion ? relativo(m.ultimaActualizacion) : 'sin documentos'} ·{' '}
                    {m.hojas} secciones
                  </p>
                </div>
                <span className="text-2xl font-semibold tabular-nums">{m.avance}%</span>
              </div>
              <Progress
                value={m.avance}
                className="mt-3 h-2"
                aria-label={`Avance de ${m.nombre}`}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary">{m.verdes} al día</Badge>
                {m.amarillos > 0 && <Badge variant="outline">{m.amarillos} por vencer</Badge>}
                {m.rojos > 0 && <Badge variant="destructive">{m.rojos} atrasadas</Badge>}
              </div>
              {m.pendientes.length > 0 && (
                <ul className="mt-3 divide-y border-t text-sm">
                  {m.pendientes.slice(0, 4).map((p) => (
                    <li
                      key={`${p.prefijo}-${p.clave ?? p.rutaSlug}`}
                      className="flex items-center gap-2 py-2"
                    >
                      <Semaforo estado={p.estado} />
                      <Link
                        href={`/m/${m.slug}/${p.prefijo || 'ayuntamiento'}/${p.clave ?? p.rutaSlug}`}
                        className="min-w-0 flex-1 truncate hover:underline"
                      >
                        {p.clave ? `${p.clave} · ` : ''}
                        {p.titulo}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {p.periodo ?? ''}
                      </span>
                    </li>
                  ))}
                  {m.pendientes.length > 4 && (
                    <li className="py-2 text-xs text-muted-foreground">
                      y {m.pendientes.length - 4} más…
                    </li>
                  )}
                </ul>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full justify-between"
                nativeButton={false}
                render={<Link href={`/m/${m.slug}`} />}
              >
                Abrir el municipio <ChevronRightIcon aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
