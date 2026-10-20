import { withUser } from '@platform/db'
import { coverageByNode, recent } from '@platform/db/queries/documents'
import { nodesOf, currentLawVersion, type LawIndexNode } from '@platform/db/queries/law-index'
import { Button } from '@platform/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@platform/ui/components/card'
import { ChevronRightIcon, UploadIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { NodeSearch, type SearchableNode } from '@/components/node-search'
import { FileIcon } from '@/components/file-icon'
import { TrafficLight } from '@/components/traffic-light'
import { relative } from '@/lib/dates'
import { municipalityContext } from '@/lib/municipality'
import { trafficLightOf } from '@/lib/traffic-light'
import { panelSegment } from '@/lib/urls'

export const metadata: Metadata = { title: 'Inicio' }

export default async function HomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await municipalityContext(slug)
  const base = `/m/${slug}`

  const data = await withUser(c.ctx, async (tx) => {
    const version = await currentLawVersion(tx, c.municipality.stateId)
    const bySubject = await Promise.all(
      c.municipality.obligatedSubjects
        .filter((so) => so.active)
        .map(async (so) => ({
          so,
          nodes: version ? await nodesOf(tx, version.id, so.subjectTypeId) : [],
          coverage: await coverageByNode(tx, c.municipality.id, so.id),
        })),
    )
    return { version, bySubject, recent: await recent(tx, c.municipality.id, 8) }
  })

  const searchable: SearchableNode[] = []
  const pendingItems: {
    so: string
    node: LawIndexNode
    status: 'red' | 'yellow'
    href: string
    period: string | null
  }[] = []
  for (const { so, nodes, coverage } of data.bySubject) {
    const withChildren = new Set(nodes.map((n) => n.parentId).filter(Boolean))
    for (const n of nodes) {
      const href = `${base}/${panelSegment(so)}/${n.key ?? n.routeSlug ?? ''}`
      searchable.push({
        id: n.id,
        key: n.key,
        label: n.label,
        title: n.title,
        subject: so.prefix ? so.name : 'Ayuntamiento',
        href,
      })
      if (withChildren.has(n.id)) continue // solo hojas cuentan para el semáforo
      const r = trafficLightOf(n, coverage.get(n.id))
      if (r.status !== 'green')
        pendingItems.push({
          so: so.prefix ? so.name : 'Ayuntamiento',
          node: n,
          status: r.status,
          href,
          period: r.overdue[0]?.label ?? r.period?.label ?? null,
        })
    }
  }
  pendingItems.sort((a, b) => (a.status === b.status ? 0 : a.status === 'red' ? -1 : 1))

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">¿Qué quieres publicar hoy?</h1>
        <NodeSearch nodes={searchable} />
        {!data.version && (
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
              {pendingItems.length === 0
                ? 'Todo al día'
                : `${pendingItems.length} pendiente${pendingItems.length === 1 ? '' : 's'}`}
            </span>
          </CardHeader>
          <CardContent>
            {pendingItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay secciones atrasadas ni por vencer. ¡Buen trabajo!
              </p>
            ) : (
              <ul className="divide-y">
                {pendingItems.slice(0, 8).map((p) => (
                  <li key={p.node.id} className="flex items-center gap-3 py-2.5">
                    <TrafficLight status={p.status} />
                    <Link href={p.href} className="min-w-0 flex-1 hover:underline">
                      <span className="block truncate text-sm font-medium">
                        {p.node.key ? `${p.node.key} · ` : ''}
                        {p.node.title}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {p.so}
                        {p.period ? ` · ${p.period}` : ''}
                      </span>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`${p.href}?upload=1`} />}
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
            {data.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay documentos. Empieza por buscar dónde va el primero.
              </p>
            ) : (
              <ul className="divide-y">
                {data.recent.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-2.5">
                    <FileIcon
                      type={d.currentVersion?.fileType ?? null}
                      external={d.type === 'external_video'}
                      className="size-9"
                    />
                    <Link
                      href={`${base}/documentos/${d.id}`}
                      className="min-w-0 flex-1 hover:underline"
                    >
                      <span className="block truncate text-sm font-medium">{d.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {d.node.key ?? d.node.routeSlug} · {relative(d.updatedAt)}
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
          {data.bySubject.map(({ so, nodes }) => (
            <Link
              key={so.id}
              href={`${base}/${panelSegment(so)}`}
              className="flex items-center justify-between rounded-xl border bg-card p-4 hover:bg-accent"
            >
              <span>
                <span className="block font-medium">{so.prefix ? so.name : 'Ayuntamiento'}</span>
                <span className="block text-sm text-muted-foreground">
                  {nodes.length} secciones del índice
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
