/**
 * Página catch-all de transparencia. Las apps la montan en `app/[...segmentos]/page.tsx`:
 *   export { Pagina as default, generateMetadata, revalidate, dynamicParams } from '@platform/transparency/next/page'
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { PublicTree } from '../components/public-tree'
import { ShareButton } from '../components/share-button'
import { PublicDocumentList } from '../components/documents'
import { Breadcrumbs, type Crumb } from '../components/breadcrumbs'
import { resolveSegments, nodeRoute, homeRoute } from '../routes'
import { siteConfig } from './config'
import {
  getSubjectDocuments,
  getMunicipality,
  getNode,
  getNodes,
  type PublicMunicipality,
} from './data'
import { breadcrumbJsonLd, nodeMetadata, homeMetadata, subjectName, pathTitle } from './metadata'

type Props = { params: Promise<{ segments: string[] }> }

async function resolve(segments: string[]) {
  const m = await getMunicipality()
  if (!m) return null
  const prefixes = m.subjects.map((s) => s.prefix).filter(Boolean)
  const root = await getNodes('')
  const sections = root.filter((n) => n.routeSlug).map((n) => n.routeSlug!)
  return { m, r: resolveSegments(segments, prefixes, sections) }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segments } = await params
  const x = await resolve(segments)
  if (!x) return {}
  const { m, r } = x
  if (r.type === 'home') return homeMetadata(m, r.prefix, homeRoute(r.prefix))
  if (r.type === 'key' || r.type === 'section') {
    const data = await getNode(r.prefix, r.type === 'key' ? r.key : r.routeSlug, r.version)
    if (!data) return {}
    return nodeMetadata(
      m,
      r.prefix,
      data.node,
      data.path,
      nodeRoute(r.prefix, data.node.key, data.node.routeSlug),
      data.documents.length,
    )
  }
  if (r.type === 'article') {
    const nodes = await getNodes(r.prefix, r.version)
    const art = nodes.find((n) => n.level === 'article' && n.number === r.number)
    if (!art) return {}
    return nodeMetadata(
      m,
      r.prefix,
      art,
      [art],
      `/${r.prefix ? `${r.prefix}/` : ''}articulo-${r.number}`,
      nodes.filter((n) => n.parentId).length,
    )
  }
  return {}
}

export async function Page({ params }: Props) {
  const { segments } = await params
  const x = await resolve(segments)
  if (!x) notFound()
  const { m, r } = x
  if (r.type === 'redirect') permanentRedirect(r.target)
  if (r.type === 'not_found') notFound()
  const { baseUrl } = siteConfig()
  const subject = subjectName(m, r.prefix)
  const home = homeRoute(r.prefix)

  if (r.type === 'home') {
    const [nodes, docs] = await Promise.all([
      getNodes(r.prefix, r.version),
      getSubjectDocuments(r.prefix),
    ])
    const networks = m.networks.filter((x) =>
      r.prefix
        ? x.obligatedSubjectId === m.subjects.find((s) => s.prefix === r.prefix)?.id
        : !x.obligatedSubjectId,
    )
    return (
      <Container
        m={m}
        crumbs={[
          { href: '/', label: 'Inicio' },
          { label: `Transparencia${r.prefix ? ` · ${subject}` : ''}` },
        ]}
      >
        <Header
          title="Transparencia"
          subtitle={`Información fundamental de ${subject}${m.version ? ` · ${m.version.name}` : ''}`}
          url={`${baseUrl}${home}`}
        />
        {m.subjects.length > 1 && (
          <nav aria-label="Sujetos obligados" className="mb-6 flex flex-wrap gap-2">
            {m.subjects.map((s) => (
              <Link
                key={s.id}
                href={homeRoute(s.prefix)}
                aria-current={s.prefix === r.prefix ? 'page' : undefined}
                className={`inline-flex h-11 items-center rounded-full border px-5 text-sm font-semibold transition ${s.prefix === r.prefix ? 'border-primario-legible bg-primario-legible text-sobre-primario shadow-sm' : 'border-neutral-300 bg-white hover:bg-primario-suave'}`}
              >
                {s.prefix ? s.name : 'Ayuntamiento'}
              </Link>
            ))}
          </nav>
        )}
        {nodes.length === 0 ? (
          <p className="text-neutral-600">Próximamente.</p>
        ) : (
          <PublicTree nodes={nodes} prefix={r.prefix} documentsByNode={docs} openFirst />
        )}
        {networks.length > 0 && (
          <p className="sr-only">Redes sociales de {subject} en el pie de página.</p>
        )}
      </Container>
    )
  }

  if (r.type === 'article') {
    const nodes = await getNodes(r.prefix, r.version)
    const art = nodes.find((n) => n.level === 'article' && n.number === r.number && n.key)
    if (!art) notFound()
    const sub = nodes.filter((n) => n.id === art.id || isDescendant(nodes, n, art.id))
    const docs = await getSubjectDocuments(r.prefix)
    return (
      <Container
        m={m}
        crumbs={[
          { href: '/', label: 'Inicio' },
          { href: home, label: 'Transparencia' },
          { label: art.label },
        ]}
      >
        <Header
          key={art.key}
          title={`${art.label}. ${art.title}`}
          subtitle={subject}
          url={`${baseUrl}${nodeRoute(r.prefix, art.key, null)}`}
        />
        <PublicTree nodes={sub} prefix={r.prefix} documentsByNode={docs} openFirst />
      </Container>
    )
  }

  const data = await getNode(r.prefix, r.type === 'key' ? r.key : r.routeSlug, r.version)
  if (!data) notFound()
  const { node, path, children, documents, notices } = data
  const crumbs: Crumb[] = [
    { href: '/', label: 'Inicio' },
    { href: home, label: 'Transparencia' },
    ...path
      .slice(0, -1)
      .map((n) => ({ href: nodeRoute(r.prefix, n.key, n.routeSlug), label: n.label })),
    { label: node.label },
  ]
  const jsonLd = breadcrumbJsonLd([
    { name: 'Inicio', path: '/' },
    { name: 'Transparencia', path: home },
    ...path.map((n) => ({ name: n.label, path: nodeRoute(r.prefix, n.key, n.routeSlug) })),
  ])
  const childrenDocs = children.length > 0 ? await getSubjectDocuments(r.prefix) : undefined
  return (
    <Container m={m} crumbs={crumbs}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header
        nodeKey={node.key}
        title={node.title}
        subtitle={`${pathTitle(path)} · ${subject}${r.version ? ` · versión ${r.version}` : ''}`}
        url={`${baseUrl}${nodeRoute(r.prefix, node.key, node.routeSlug)}`}
      />
      {node.description && <p className="mb-6 max-w-3xl text-neutral-700">{node.description}</p>}
      {children.length > 0 ? (
        <PublicTree
          nodes={[node, ...descendants(await getNodes(r.prefix, r.version), node.id)]}
          prefix={r.prefix}
          documentsByNode={childrenDocs}
          openFirst
        />
      ) : (
        <PublicDocumentList documents={documents} notices={notices} />
      )}
    </Container>
  )
}

function isDescendant(
  nodes: { id: string; parentId: string | null }[],
  n: { parentId: string | null },
  rootId: string,
): boolean {
  let p = n.parentId
  const byId = new Map(nodes.map((x) => [x.id, x]))
  while (p) {
    if (p === rootId) return true
    p = byId.get(p)?.parentId ?? null
  }
  return false
}
function descendants<T extends { id: string; parentId: string | null }>(
  nodes: T[],
  rootId: string,
): T[] {
  return nodes.filter((n) => isDescendant(nodes, n, rootId))
}

function Container({
  m,
  crumbs,
  children,
}: {
  m: PublicMunicipality
  crumbs: Crumb[]
  children: React.ReactNode
}) {
  void m
  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-10 sm:px-6 md:pt-8">
      <Breadcrumbs crumbs={crumbs} />
      <div className="mt-5">{children}</div>
    </div>
  )
}

function Header({
  nodeKey,
  title,
  subtitle,
  url,
}: {
  nodeKey?: string | null
  title: string
  subtitle: string
  url: string
}) {
  return (
    <header className="relative mb-8 overflow-hidden rounded-3xl bg-primario-legible px-6 py-8 text-sobre-primario sm:px-8 sm:py-10">
      <div
        className="absolute -top-24 -right-24 size-72 rounded-full bg-white/10 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {nodeKey && (
            <p className="font-mono text-sm font-semibold tracking-wider opacity-85">{nodeKey}</p>
          )}
          <h1 className="font-heading mt-1 text-3xl font-bold leading-tight text-balance md:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-sm opacity-85">{subtitle}</p>
        </div>
        <ShareButton url={url} title={title} className="shrink-0" light />
      </div>
    </header>
  )
}
