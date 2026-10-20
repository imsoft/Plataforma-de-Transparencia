import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { Tx } from '../client'
import * as s from '../schema'

export type DocumentWithVersion = typeof s.documents.$inferSelect & {
  currentVersion: typeof s.documentVersions.$inferSelect | null
}

/** Documentos de un nodo (todos los estados salvo papelera por defecto), con su versión vigente. */
export async function nodeDocuments(
  tx: Tx,
  {
    municipalityId,
    obligatedSubjectId,
    nodeId,
    states,
  }: {
    municipalityId: string
    obligatedSubjectId: string
    nodeId: string
    states?: (typeof s.documentStatusEnum.enumValues)[number][]
  },
): Promise<DocumentWithVersion[]> {
  return tx.query.documents.findMany({
    where: and(
      eq(s.documents.municipalityId, municipalityId),
      eq(s.documents.obligatedSubjectId, obligatedSubjectId),
      eq(s.documents.nodeId, nodeId),
      inArray(s.documents.status, states ?? ['published', 'hidden', 'historical']),
    ),
    with: { currentVersion: true },
    orderBy: [desc(s.documents.periodStart), asc(s.documents.order), desc(s.documents.createdAt)],
  })
}

export async function documentById(tx: Tx, id: string) {
  return tx.query.documents
    .findMany({
      where: eq(s.documents.id, id),
      with: {
        currentVersion: true,
        versions: { orderBy: [desc(s.documentVersions.number)] },
        node: true,
        obligatedSubject: true,
      },
      limit: 1,
    })
    .then((r) => r[0] ?? null)
}

export async function recent(tx: Tx, municipalityId: string, limit = 8) {
  return tx.query.documents.findMany({
    where: and(
      eq(s.documents.municipalityId, municipalityId),
      inArray(s.documents.status, ['published', 'hidden', 'historical']),
    ),
    with: { currentVersion: true, node: true, obligatedSubject: true },
    orderBy: [desc(s.documents.updatedAt)],
    limit: limit,
  })
}

export async function trash(tx: Tx, municipalityId: string) {
  return tx.query.documents.findMany({
    where: and(eq(s.documents.municipalityId, municipalityId), eq(s.documents.status, 'trash')),
    with: { currentVersion: true, node: true, obligatedSubject: true },
    orderBy: [desc(s.documents.deletedAt)],
  })
}

export type Coverage = { total: number; periods: string[] }

/** Por nodo: cuántos documentos publicados tiene y qué periodos cubre (documentos + leyendas). Para el semáforo. */
export async function coverageByNode(
  tx: Tx,
  municipalityId: string,
  obligatedSubjectId: string,
): Promise<Map<string, Coverage>> {
  const docs = await tx
    .select({
      nodeId: s.documents.nodeId,
      period: s.documents.periodStart,
      n: sql<number>`count(*)::int`,
    })
    .from(s.documents)
    .where(
      and(
        eq(s.documents.municipalityId, municipalityId),
        eq(s.documents.obligatedSubjectId, obligatedSubjectId),
        eq(s.documents.status, 'published'),
      ),
    )
    .groupBy(s.documents.nodeId, s.documents.periodStart)
  const notices = await tx
    .select({
      nodeId: s.noInformationNotices.nodeId,
      period: s.noInformationNotices.periodStart,
    })
    .from(s.noInformationNotices)
    .where(
      and(
        eq(s.noInformationNotices.municipalityId, municipalityId),
        eq(s.noInformationNotices.obligatedSubjectId, obligatedSubjectId),
        isNull(s.noInformationNotices.deletedAt),
      ),
    )
  const map = new Map<string, Coverage>()
  const input = (id: string) =>
    map.get(id) ?? (map.set(id, { total: 0, periods: [] }), map.get(id)!)
  for (const d of docs) {
    const e = input(d.nodeId)
    e.total += d.n
    if (d.period && !e.periods.includes(d.period)) e.periods.push(d.period)
  }
  for (const l of notices) {
    const e = input(l.nodeId)
    if (l.period && !e.periods.includes(l.period)) e.periods.push(l.period)
  }
  return map
}

export async function nodeNotices(
  tx: Tx,
  {
    municipalityId,
    obligatedSubjectId,
    nodeId,
  }: { municipalityId: string; obligatedSubjectId: string; nodeId: string },
) {
  return tx.query.noInformationNotices.findMany({
    where: and(
      eq(s.noInformationNotices.municipalityId, municipalityId),
      eq(s.noInformationNotices.obligatedSubjectId, obligatedSubjectId),
      eq(s.noInformationNotices.nodeId, nodeId),
      isNull(s.noInformationNotices.deletedAt),
    ),
    orderBy: [desc(s.noInformationNotices.periodStart)],
  })
}
