import { and, asc, eq } from 'drizzle-orm'
import type { Tx } from '../client'
import * as s from '../schema'

export type LawIndexNode = typeof s.lawIndexNodes.$inferSelect

export async function currentLawVersion(tx: Tx, stateId: string) {
  return tx.query.lawIndexVersions.findFirst({
    where: and(eq(s.lawIndexVersions.stateId, stateId), eq(s.lawIndexVersions.status, 'current')),
  })
}

export async function versionBySlug(tx: Tx, stateId: string, slug: string) {
  return tx.query.lawIndexVersions.findFirst({
    where: and(eq(s.lawIndexVersions.stateId, stateId), eq(s.lawIndexVersions.slug, slug)),
  })
}

/** Todos los nodos activos de una versión × tipo de sujeto, en orden de árbol (padres antes que hijos). */
export async function nodesOf(
  tx: Tx,
  versionId: string,
  subjectTypeId: string,
): Promise<LawIndexNode[]> {
  const rows = await tx.query.lawIndexNodes.findMany({
    where: and(
      eq(s.lawIndexNodes.versionId, versionId),
      eq(s.lawIndexNodes.subjectTypeId, subjectTypeId),
      eq(s.lawIndexNodes.active, true),
    ),
    orderBy: [asc(s.lawIndexNodes.order)],
  })
  return sortAsTree(rows)
}

export async function nodeByKey(tx: Tx, versionId: string, subjectTypeId: string, key: string) {
  return tx.query.lawIndexNodes.findFirst({
    where: and(
      eq(s.lawIndexNodes.versionId, versionId),
      eq(s.lawIndexNodes.subjectTypeId, subjectTypeId),
      eq(s.lawIndexNodes.key, key),
      eq(s.lawIndexNodes.active, true),
    ),
  })
}

export async function nodeByRouteSlug(
  tx: Tx,
  versionId: string,
  subjectTypeId: string,
  routeSlug: string,
) {
  return tx.query.lawIndexNodes.findFirst({
    where: and(
      eq(s.lawIndexNodes.versionId, versionId),
      eq(s.lawIndexNodes.subjectTypeId, subjectTypeId),
      eq(s.lawIndexNodes.routeSlug, routeSlug),
      eq(s.lawIndexNodes.active, true),
    ),
  })
}

// ── Helpers puros sobre la lista ─────────────────────────────────────────────

export type TreeNode<N extends { id: string; parentId: string | null }> = N & {
  children: TreeNode<N>[]
  depth: number
}

/** Lista plana → árbol. */
export function buildTree<N extends { id: string; parentId: string | null; order: number }>(
  nodes: N[],
): TreeNode<N>[] {
  const byId = new Map<string, TreeNode<N>>()
  for (const n of nodes) byId.set(n.id, { ...n, children: [], depth: 0 })
  const roots: TreeNode<N>[] = []
  for (const n of byId.values()) {
    const parent = n.parentId ? byId.get(n.parentId) : undefined
    if (parent) {
      n.depth = parent.depth + 1
      parent.children.push(n)
    } else roots.push(n)
  }
  const sort = (list: TreeNode<N>[]) => {
    list.sort((a, b) => a.order - b.order)
    list.forEach((x) => sort(x.children))
  }
  sort(roots)
  return roots
}

/** Reordena una lista plana en orden de recorrido del árbol (DFS). */
export function sortAsTree<N extends { id: string; parentId: string | null; order: number }>(
  nodes: N[],
): N[] {
  const output: N[] = []
  const visit = (n: TreeNode<N>) => {
    const { children, depth: _p, ...rest } = n
    output.push(rest as unknown as N)
    children.forEach(visit)
  }
  buildTree(nodes).forEach(visit)
  return output
}

/** Ids del nodo y sus ancestros, de la raíz al nodo. */
export function ancestorPath<N extends { id: string; parentId: string | null }>(
  nodes: N[],
  nodeId: string,
): N[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const path: N[] = []
  let current = byId.get(nodeId)
  while (current) {
    path.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return path
}

/** Ids de un nodo y todos sus descendientes. */
export function idsWithDescendants<N extends { id: string; parentId: string | null }>(
  nodes: N[],
  nodeId: string,
): string[] {
  const childrenOf = new Map<string | null, N[]>()
  for (const n of nodes) childrenOf.set(n.parentId, [...(childrenOf.get(n.parentId) ?? []), n])
  const output: string[] = []
  const visit = (id: string) => {
    output.push(id)
    for (const h of childrenOf.get(id) ?? []) visit(h.id)
  }
  visit(nodeId)
  return output
}
