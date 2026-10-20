import { withUser } from '@platform/db'
import { coverageByNode } from '@platform/db/queries/documents'
import {
  buildTree,
  nodesOf,
  currentLawVersion,
  type TreeNode,
  type LawIndexNode,
} from '@platform/db/queries/law-index'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@platform/ui/components/collapsible'
import { ChevronDownIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CopyLink } from '@/components/copy-link'
import { TrafficLight } from '@/components/traffic-light'
import { municipalityContext } from '@/lib/municipality'
import { trafficLightOf } from '@/lib/traffic-light'
import { siteBase, panelSegment } from '@/lib/urls'
import { nodeRoute, homeRoute } from '@platform/transparency/routes'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; prefix: string }>
}): Promise<Metadata> {
  const { prefix } = await params
  return { title: prefix === 'ayuntamiento' ? 'Ayuntamiento' : prefix.toUpperCase() }
}

export default async function TreePage({
  params,
}: {
  params: Promise<{ slug: string; prefix: string }>
}) {
  const { slug, prefix } = await params
  const c = await municipalityContext(slug)
  const so = c.municipality.obligatedSubjects.find((x) => panelSegment(x) === prefix && x.active)
  if (!so) notFound()

  const { nodes, coverage } = await withUser(c.ctx, async (tx) => {
    const version = await currentLawVersion(tx, c.municipality.stateId)
    return {
      nodes: version ? await nodesOf(tx, version.id, so.subjectTypeId) : [],
      coverage: await coverageByNode(tx, c.municipality.id, so.id),
    }
  })
  const tree = buildTree(nodes)
  const base = `/m/${slug}/${prefix}`
  const site = siteBase(c.municipality)

  /** Total de documentos en el nodo y sus descendientes. */
  const totals = new Map<string, number>()
  const sum = (n: TreeNode<LawIndexNode>): number => {
    const t = (coverage.get(n.id)?.total ?? 0) + n.children.reduce((acc, h) => acc + sum(h), 0)
    totals.set(n.id, t)
    return t
  }
  tree.forEach(sum)

  const Node = ({ n }: { n: TreeNode<LawIndexNode> }) => {
    const leaf = n.children.length === 0
    const href = `${base}/${n.key ?? n.routeSlug ?? ''}`
    const status = leaf ? trafficLightOf(n, coverage.get(n.id)).status : null
    const row = (
      <div className="flex min-w-0 flex-1 items-center gap-3 py-2.5">
        {leaf ? (
          <TrafficLight status={status!} />
        ) : (
          <ChevronDownIcon
            className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-0 group-data-[closed]:-rotate-90"
            aria-hidden
          />
        )}
        <span className="w-12 shrink-0 font-mono text-sm text-primary">{n.key ?? ''}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{n.title}</span>
          <span className="block text-xs text-muted-foreground">
            {n.label} · {totals.get(n.id) ?? 0} documento{totals.get(n.id) === 1 ? '' : 's'}
          </span>
        </span>
      </div>
    )
    if (leaf) {
      return (
        <li
          className="flex items-center gap-2 border-t pl-2 pr-1"
          style={{ marginLeft: `${n.depth * 1.25}rem` }}
        >
          <Link href={href} className="min-w-0 flex-1 rounded-md hover:bg-accent/60">
            {row}
          </Link>
          <CopyLink
            url={`${site}${nodeRoute(so.prefix, n.key, n.routeSlug)}`}
            iconOnly
            size="icon-sm"
            variant="ghost"
          />
        </li>
      )
    }
    return (
      <li className="border-t" style={{ marginLeft: `${n.depth * 1.25}rem` }}>
        <Collapsible defaultOpen={n.depth === 0 && tree.length <= 3}>
          <div className="flex items-center gap-2 pl-2 pr-1">
            <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center rounded-md text-left hover:bg-accent/60">
              {row}
            </CollapsibleTrigger>
            <Link href={href} className="text-xs text-primary underline-offset-4 hover:underline">
              Ver
            </Link>
            <CopyLink
              url={`${site}${nodeRoute(so.prefix, n.key, n.routeSlug)}`}
              iconOnly
              size="icon-sm"
              variant="ghost"
            />
          </div>
          <CollapsibleContent>
            <ul>
              {n.children.map((h) => (
                <Node key={h.id} n={h} />
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{so.prefix ? so.name : 'Ayuntamiento'}</h1>
          <p className="text-sm text-muted-foreground">
            Elige la sección del índice donde va tu documento.
          </p>
        </div>
        <CopyLink
          url={`${site}${homeRoute(so.prefix)}`}
          label="Copiar enlace de la transparencia"
        />
      </div>
      {nodes.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          No hay índice cargado para este sujeto obligado.
        </p>
      ) : (
        <ul className="rounded-xl border bg-card">
          {tree.map((n) => (
            <Node key={n.id} n={n} />
          ))}
        </ul>
      )}
    </div>
  )
}
