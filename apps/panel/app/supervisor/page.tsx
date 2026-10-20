import { Badge } from '@platform/ui/components/badge'
import { Button } from '@platform/ui/components/button'
import { Progress } from '@platform/ui/components/progress'
import { ChevronRightIcon, FileSpreadsheetIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { TrafficLight } from '@/components/traffic-light'
import { relative } from '@/lib/dates'
import { requireSession } from '@/lib/session'
import { fullDashboard } from '@/lib/dashboard'

export const metadata: Metadata = { title: 'Tablero de municipios' }

export default async function DashboardPage() {
  const s = await requireSession()
  const rows = await fullDashboard(s)
  const totalPending = rows.reduce((a, f) => a + f.redCount + f.yellowCount, 0)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tablero de municipios</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} municipio{rows.length === 1 ? '' : 's'} · {totalPending} sección
            {totalPending === 1 ? '' : 'es'} pendiente{totalPending === 1 ? '' : 's'}. El avance es
            el porcentaje de secciones al día.
          </p>
        </div>
        <Button variant="outline" nativeButton={false} render={<a href="/supervisor/reporte" />}>
          <FileSpreadsheetIcon aria-hidden /> Descargar reporte en Excel
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          Todavía no tienes municipios asignados. Pide al superadministrador que te asigne.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((m) => (
            <li key={m.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold">
                    <TrafficLight status={m.status} /> {m.officialName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Última actualización: {m.lastUpdate ? relative(m.lastUpdate) : 'sin documentos'}{' '}
                    · {m.leaves} secciones
                  </p>
                </div>
                <span className="text-2xl font-semibold tabular-nums">{m.progressPercent}%</span>
              </div>
              <Progress
                value={m.progressPercent}
                className="mt-3 h-2"
                aria-label={`Avance de ${m.name}`}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary">{m.greenCount} al día</Badge>
                {m.yellowCount > 0 && <Badge variant="outline">{m.yellowCount} por vencer</Badge>}
                {m.redCount > 0 && <Badge variant="destructive">{m.redCount} atrasadas</Badge>}
              </div>
              {m.pendingItems.length > 0 && (
                <ul className="mt-3 divide-y border-t text-sm">
                  {m.pendingItems.slice(0, 4).map((p) => (
                    <li
                      key={`${p.prefix}-${p.key ?? p.routeSlug}`}
                      className="flex items-center gap-2 py-2"
                    >
                      <TrafficLight status={p.status} />
                      <Link
                        href={`/m/${m.slug}/${p.prefix || 'ayuntamiento'}/${p.key ?? p.routeSlug}`}
                        className="min-w-0 flex-1 truncate hover:underline"
                      >
                        {p.key ? `${p.key} · ` : ''}
                        {p.title}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {p.period ?? ''}
                      </span>
                    </li>
                  ))}
                  {m.pendingItems.length > 4 && (
                    <li className="py-2 text-xs text-muted-foreground">
                      y {m.pendingItems.length - 4} más…
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
