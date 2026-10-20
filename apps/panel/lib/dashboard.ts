import 'server-only'
import { dbContext, type Session } from '@platform/auth'
import { withUser, desc, documents, eq } from '@platform/db'
import { coverageByNode } from '@platform/db/queries/documents'
import { nodesOf, currentLawVersion } from '@platform/db/queries/law-index'
import { municipalityById } from '@platform/db/queries/municipality'
import { allMunicipalities } from '@platform/db/queries/session'
import type { TrafficLightStatus } from '@platform/law-index'
import { trafficLightOf } from './traffic-light'
import type { PanelSession } from './session'

export type PendingItem = {
  subject: string
  prefix: string
  key: string | null
  routeSlug: string | null
  title: string
  status: TrafficLightStatus
  period: string | null
  overdue: number
}
export type MunicipalitySummary = {
  id: string
  slug: string
  name: string
  officialName: string
  leaves: number
  greenCount: number
  yellowCount: number
  redCount: number
  /** 0–100 */
  progressPercent: number
  status: TrafficLightStatus
  lastUpdate: Date | null
  pendingItems: PendingItem[]
}

/** Municipios que ve el supervisor (asignados) o el superadmin (todos). */
export async function dashboardMunicipalities(session: PanelSession) {
  if (session.isSuperadmin) return allMunicipalities()
  return session.municipalities
    .filter((m) => m.role === 'supervisor' || m.role === 'municipal_admin')
    .map((m) => m.municipality)
}

export async function municipalitySummary(
  session: Session,
  municipalityId: string,
): Promise<MunicipalitySummary | null> {
  const ctx = dbContext(session, municipalityId)
  return withUser(ctx, async (tx) => {
    const m = await municipalityById(tx, municipalityId)
    if (!m) return null
    const version = await currentLawVersion(tx, m.stateId)
    const pendingItems: PendingItem[] = []
    let leaves = 0
    let greenCount = 0
    let yellowCount = 0
    let redCount = 0
    for (const so of m.obligatedSubjects.filter((s) => s.active)) {
      const nodes = version ? await nodesOf(tx, version.id, so.subjectTypeId) : []
      const coverage = await coverageByNode(tx, m.id, so.id)
      const withChildren = new Set(nodes.map((n) => n.parentId).filter(Boolean))
      for (const n of nodes) {
        if (withChildren.has(n.id)) continue
        leaves++
        const r = trafficLightOf(n, coverage.get(n.id))
        if (r.status === 'green') greenCount++
        else {
          if (r.status === 'yellow') yellowCount++
          else redCount++
          pendingItems.push({
            subject: so.prefix ? so.name : 'Ayuntamiento',
            prefix: so.prefix,
            key: n.key,
            routeSlug: n.routeSlug,
            title: n.title,
            status: r.status,
            period: r.overdue[0]?.label ?? r.period?.label ?? null,
            overdue: r.overdue.length,
          })
        }
      }
    }
    const last = await tx.query.documents.findFirst({
      where: eq(documents.municipalityId, m.id),
      orderBy: [desc(documents.updatedAt)],
      columns: { updatedAt: true },
    })
    const progressPercent = leaves === 0 ? 0 : Math.round((greenCount / leaves) * 100)
    const status: TrafficLightStatus =
      leaves === 0
        ? 'red'
        : redCount === 0 && yellowCount === 0
          ? 'green'
          : redCount === 0 || progressPercent >= 80
            ? 'yellow'
            : 'red'
    pendingItems.sort((a, b) =>
      a.status === b.status ? b.overdue - a.overdue : a.status === 'red' ? -1 : 1,
    )
    return {
      id: m.id,
      slug: m.slug,
      name: m.name,
      officialName: m.officialName,
      leaves,
      greenCount,
      yellowCount,
      redCount,
      progressPercent,
      status,
      lastUpdate: last?.updatedAt ?? null,
      pendingItems,
    }
  })
}

export async function fullDashboard(session: PanelSession): Promise<MunicipalitySummary[]> {
  const list = await dashboardMunicipalities(session)
  const r = await Promise.all(list.map((m) => municipalitySummary(session, m.id)))
  return r
    .filter((x): x is MunicipalitySummary => x !== null)
    .sort((a, b) => a.progressPercent - b.progressPercent)
}
