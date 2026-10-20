import { ChevronDownIcon, FolderOpenIcon } from 'lucide-react'
import Link from 'next/link'
import { buildTree, type TreeNode } from '@platform/db/queries/law-index'
import type { PublicDocument, PublicNode } from '../next/data'
import { nodeRoute } from '../routes'
import { PublicDocumentList } from './documents'

type N = TreeNode<PublicNode>

/** Índice completo en acordeón nativo (<details>): funciona sin JavaScript y es accesible. */
export function PublicTree({
  nodes,
  prefix,
  documentsByNode,
  openFirst = false,
}: {
  nodes: PublicNode[]
  prefix: string
  documentsByNode?: Record<string, PublicDocument[]>
  openFirst?: boolean
}) {
  const tree = buildTree(nodes)
  const totals = new Map<string, number>()
  const sum = (n: N): number => {
    const t = n.documents + n.children.reduce((a, h) => a + sum(h), 0)
    totals.set(n.id, t)
    return t
  }
  tree.forEach(sum)

  const Branch = ({ n, level }: { n: N; level: number }) => {
    const href = nodeRoute(prefix, n.key, n.routeSlug)
    const total = totals.get(n.id) ?? 0
    const indent = { paddingLeft: `${1 + level * 1.25}rem` }
    if (n.children.length === 0) {
      return (
        <li className="border-t border-neutral-200">
          <Link
            href={href}
            className="flex items-center gap-3 py-3 pr-4 transition hover:bg-primario-suave/60"
            style={indent}
          >
            <span className="w-14 shrink-0 font-mono text-sm font-semibold text-primario-legible">
              {n.key ?? ''}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-medium text-neutral-900">{n.title}</span>
              <span className="block text-xs text-neutral-500">{n.label}</span>
            </span>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${total > 0 ? 'bg-primario-suave text-primario-legible' : 'bg-neutral-100 text-neutral-500'}`}
            >
              {total}
            </span>
          </Link>
          {documentsByNode && (documentsByNode[n.id]?.length ?? 0) > 0 && (
            <div className="bg-neutral-50/80 pr-2 pb-2" style={indent}>
              <PublicDocumentList documents={documentsByNode[n.id]!} notices={[]} compact />
            </div>
          )}
        </li>
      )
    }
    return (
      <li className="border-t border-neutral-200">
        <details open={openFirst && level === 0} className="group">
          <summary
            className="flex cursor-pointer list-none items-center gap-3 py-3.5 pr-4 transition hover:bg-primario-suave/60 [&::-webkit-details-marker]:hidden"
            style={indent}
          >
            <ChevronDownIcon
              className="size-5 shrink-0 text-neutral-400 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
            <span className="w-14 shrink-0 font-mono text-sm font-semibold text-primario-legible">
              {n.key ?? ''}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block font-medium text-neutral-900 ${level === 0 ? 'font-heading text-lg' : 'text-[0.9375rem]'}`}
              >
                {n.title}
              </span>
              <span className="block text-xs text-neutral-500">{n.label}</span>
            </span>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${total > 0 ? 'bg-primario-suave text-primario-legible' : 'bg-neutral-100 text-neutral-500'}`}
            >
              {total}
            </span>
          </summary>
          <div
            className="pr-4 pb-2 text-sm"
            style={{ paddingLeft: `${1 + level * 1.25 + 2.75}rem` }}
          >
            <Link
              href={href}
              className="inline-flex min-h-11 items-center gap-1 text-primario-legible underline-offset-4 hover:underline"
            >
              <FolderOpenIcon className="size-4" aria-hidden="true" /> Abrir {n.label.toLowerCase()}{' '}
              en su propia página
            </Link>
          </div>
          <ul>
            {n.children.map((h) => (
              <Branch key={h.id} n={h} level={level + 1} />
            ))}
          </ul>
        </details>
      </li>
    )
  }

  return (
    <ul className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm [&>li:first-child]:border-t-0">
      {tree.map((n) => (
        <Branch key={n.id} n={n} level={0} />
      ))}
    </ul>
  )
}
