import { withUser } from '@platform/db'
import { coverageByNode, nodeDocuments, nodeNotices } from '@platform/db/queries/documents'
import {
  nodeByKey,
  nodeByRouteSlug,
  nodesOf,
  ancestorPath,
  currentLawVersion,
} from '@platform/db/queries/law-index'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@platform/ui/components/breadcrumb'
import { nodeRoute } from '@platform/transparency/routes'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CopyLink } from '@/components/copy-link'
import { DocumentList } from '@/components/documents/list'
import { Notices } from '@/components/documents/notices'
import { UploadDocuments } from '@/components/documents/upload-dialog'
import { TrafficLight } from '@/components/traffic-light'
import { municipalityContext } from '@/lib/municipality'
import { trafficLightOf } from '@/lib/traffic-light'
import { siteBase, panelSegment } from '@/lib/urls'

type Params = Promise<{ slug: string; prefix: string; key: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { key } = await params
  return { title: key }
}

export default async function NodePage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Promise<{ upload?: string }>
}) {
  const { slug, prefix, key } = await params
  const { upload } = await searchParams
  const c = await municipalityContext(slug)
  const so = c.municipality.obligatedSubjects.find((x) => panelSegment(x) === prefix && x.active)
  if (!so) notFound()

  const data = await withUser(c.ctx, async (tx) => {
    const version = await currentLawVersion(tx, c.municipality.stateId)
    if (!version) return null
    const node =
      (await nodeByKey(tx, version.id, so.subjectTypeId, key)) ??
      (await nodeByRouteSlug(tx, version.id, so.subjectTypeId, key))
    if (!node) return null
    const nodes = await nodesOf(tx, version.id, so.subjectTypeId)
    const children = nodes.filter((n) => n.parentId === node.id)
    const path = ancestorPath(nodes, node.id)
    const [docs, notices, coverage] = await Promise.all([
      nodeDocuments(tx, {
        municipalityId: c.municipality.id,
        obligatedSubjectId: so.id,
        nodeId: node.id,
      }),
      nodeNotices(tx, {
        municipalityId: c.municipality.id,
        obligatedSubjectId: so.id,
        nodeId: node.id,
      }),
      coverageByNode(tx, c.municipality.id, so.id),
    ])
    return { node, children, path, docs, notices, coverage }
  })
  if (!data) notFound()
  const { node, children, path, docs, notices, coverage } = data
  const base = `/m/${slug}/${prefix}`
  const site = siteBase(c.municipality)
  const publicUrl = `${site}${nodeRoute(so.prefix, node.key, node.routeSlug)}`
  const isLeaf = children.length === 0
  const trafficLight = isLeaf ? trafficLightOf(node, coverage.get(node.id)) : null
  const canUpload = c.can('document:upload', {
    obligatedSubjectId: so.id,
    nodePath: path.map((n) => n.id),
  })

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={base} />}>
              {so.prefix ? so.name : 'Ayuntamiento'}
            </BreadcrumbLink>
          </BreadcrumbItem>
          {path.slice(0, -1).map((n) => (
            <span key={n.id} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href={`${base}/${n.key ?? n.routeSlug}`} />}>
                  {n.label}
                </BreadcrumbLink>
              </BreadcrumbItem>
            </span>
          ))}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{node.label}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-sm text-primary">{node.key ?? node.routeSlug}</p>
          <h1 className="text-2xl font-semibold leading-tight">{node.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{path.map((n) => n.label).join(', ')}</span>
            <span>· Periodicidad: {node.frequency}</span>
            {trafficLight && <TrafficLight status={trafficLight.status} withText />}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <CopyLink url={publicUrl} label="Copiar enlace de esta sección" />
          {canUpload && isLeaf && (
            <UploadDocuments
              slug={slug}
              obligatedSubjectId={so.id}
              nodeId={node.id}
              nodeTitle={`${node.key ?? ''} ${node.title}`.trim()}
              frequency={node.frequency}
              openInitially={upload === '1'}
              site={site}
            />
          )}
        </div>
      </header>

      {!isLeaf && (
        <ul className="rounded-xl border bg-card">
          {children.map((h) => {
            const st = trafficLightOf(h, coverage.get(h.id)).status
            return (
              <li key={h.id} className="border-t first:border-t-0">
                <Link
                  href={`${base}/${h.key ?? h.routeSlug}`}
                  className="flex items-center gap-3 px-3 py-3 hover:bg-accent/60"
                >
                  <TrafficLight status={st} />
                  <span className="w-12 shrink-0 font-mono text-sm text-primary">{h.key}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{h.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {h.label} · {coverage.get(h.id)?.total ?? 0} documento
                      {coverage.get(h.id)?.total === 1 ? '' : 's'}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {isLeaf && (
        <>
          <DocumentList
            slug={slug}
            docs={docs}
            site={site}
            obligatedSubjectId={so.id}
            nodeId={node.id}
            canEdit={c.can('document:rename', {
              obligatedSubjectId: so.id,
              nodePath: path.map((n) => n.id),
            })}
          />
          {node.frequency !== 'permanent' && (
            <Notices
              slug={slug}
              obligatedSubjectId={so.id}
              nodeId={node.id}
              frequency={node.frequency}
              notices={notices.map((l) => ({
                id: l.id,
                label: l.periodLabel ?? '',
                text: l.text,
              }))}
              canMark={c.can('notice:mark', {
                obligatedSubjectId: so.id,
                nodePath: path.map((n) => n.id),
              })}
            />
          )}
        </>
      )}
    </div>
  )
}
