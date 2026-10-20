/**
 * Lecturas del sitio público. Todas cacheadas con etiquetas (`unstable_cache`) y revalidadas por el panel
 * a través de /api/revalidate. Devuelven objetos planos (serializables) con fechas en ISO.
 */
import 'server-only'
import { and, asc, asPublicBySlug, desc, eq, inArray, isNull, sql } from '@platform/db'
import { municipalityById } from '@platform/db/queries/municipality'
import {
  nodesOf,
  ancestorPath,
  currentLawVersion,
  versionBySlug,
} from '@platform/db/queries/law-index'
import * as s from '@platform/db/schema'
import { unstable_cache } from 'next/cache'
import { MUNICIPALITY_TAG, ALL_TAG, documentTag, nodeTag, subjectTag } from '../tags'
import { siteConfig } from './config'

const ONE_DAY = 60 * 60 * 24

export type PublicSubject = {
  id: string
  prefix: string
  name: string
  typeSlug: string
  subjectTypeId: string
}
export type PublicNetwork = {
  network: string
  otherName: string | null
  url: string
  text: string | null
  obligatedSubjectId: string | null
}
export type PublicMunicipality = {
  id: string
  slug: string
  name: string
  officialName: string
  stateId: string
  contactInfo: { address?: string; phone?: string; email?: string; hours?: string }
  theme: {
    primaryColor: string
    secondaryColor: string
    accentColor: string
    typeface: string
    coatOfArmsPath: string | null
    administrationLogoPath: string | null
    version: number
  } | null
  subjects: PublicSubject[]
  networks: PublicNetwork[]
  version: { id: string; slug: string; name: string; storageFolder: string } | null
}

export type PublicNode = {
  id: string
  parentId: string | null
  level: 'article' | 'fraction' | 'item' | 'subitem'
  number: string
  label: string
  title: string
  description: string | null
  key: string | null
  routeSlug: string | null
  frequency: 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'permanent'
  order: number
  /** Documentos publicados en el nodo (sin descendientes). */
  documents: number
}

export type PublicDocument = {
  id: string
  name: string
  status: 'published' | 'hidden' | 'historical' | 'trash'
  type: 'file' | 'external_video'
  externalUrl: string | null
  periodLabel: string | null
  periodStart: string | null
  publishedAt: string | null
  updatedAt: string
  version: {
    storagePath: string
    fileType: 'pdf' | 'word' | 'excel' | 'powerpoint' | 'zip' | 'video' | 'image'
    size: number
    mime: string
    durationSec: number | null
    thumbnailPath: string | null
  } | null
}

export type PublicNotice = {
  id: string
  periodLabel: string | null
  periodStart: string | null
  text: string
}

const slug = () => siteConfig().municipalitySlug

export const getMunicipality = (): Promise<PublicMunicipality | null> =>
  unstable_cache(
    async () =>
      asPublicBySlug(slug(), async (tx, id) => {
        const m = await municipalityById(tx, id)
        if (!m) return null
        const networks = await tx.query.socialNetworks.findMany({
          where: eq(s.socialNetworks.municipalityId, id),
          orderBy: [asc(s.socialNetworks.order)],
        })
        const version = await currentLawVersion(tx, m.stateId)
        return {
          id: m.id,
          slug: m.slug,
          name: m.name,
          officialName: m.officialName,
          stateId: m.stateId,
          contactInfo: m.contactInfo,
          theme: m.theme
            ? {
                primaryColor: m.theme.primaryColor,
                secondaryColor: m.theme.secondaryColor,
                accentColor: m.theme.accentColor,
                typeface: m.theme.typeface,
                coatOfArmsPath: m.theme.coatOfArmsPath,
                administrationLogoPath: m.theme.administrationLogoPath,
                version: m.theme.version,
              }
            : null,
          subjects: m.obligatedSubjects
            .filter((so) => so.active)
            .map((so) => ({
              id: so.id,
              prefix: so.prefix,
              name: so.name,
              typeSlug: so.type.slug,
              subjectTypeId: so.subjectTypeId,
            })),
          networks: networks.map((r) => ({
            network: r.network,
            otherName: r.otherName,
            url: r.url,
            text: r.text,
            obligatedSubjectId: r.obligatedSubjectId,
          })),
          version: version
            ? {
                id: version.id,
                slug: version.slug,
                name: version.name,
                storageFolder: version.storageFolder,
              }
            : null,
        }
      }),
    ['municipality', slug()],
    { tags: [ALL_TAG, MUNICIPALITY_TAG], revalidate: ONE_DAY },
  )()

/** Nodos activos de un sujeto obligado (versión vigente o la indicada) con conteo de documentos publicados. */
export const getNodes = (
  prefix: string,
  versionSlug: string | null = null,
): Promise<PublicNode[]> =>
  unstable_cache(
    async () => {
      const r = await asPublicBySlug(slug(), async (tx, id) => {
        const m = await municipalityById(tx, id)
        const so = m?.obligatedSubjects.find((x) => x.prefix === prefix && x.active)
        if (!m || !so) return []
        const version = versionSlug
          ? await versionBySlug(tx, m.stateId, versionSlug)
          : await currentLawVersion(tx, m.stateId)
        if (!version) return []
        const nodes = await nodesOf(tx, version.id, so.subjectTypeId)
        const counts = await tx
          .select({ nodeId: s.documents.nodeId, n: sql<number>`count(*)::int` })
          .from(s.documents)
          .where(
            and(
              eq(s.documents.municipalityId, id),
              eq(s.documents.obligatedSubjectId, so.id),
              eq(s.documents.status, 'published'),
            ),
          )
          .groupBy(s.documents.nodeId)
        const byNode = new Map(counts.map((c) => [c.nodeId, c.n]))
        return nodes.map((n) => ({
          id: n.id,
          parentId: n.parentId,
          level: n.level,
          number: n.number,
          label: n.label,
          title: n.title,
          description: n.description,
          key: n.key,
          routeSlug: n.routeSlug,
          frequency: n.frequency,
          order: n.order,
          documents: byNode.get(n.id) ?? 0,
        }))
      })
      return r ?? []
    },
    ['nodes', slug(), prefix, versionSlug ?? 'current'],
    { tags: [ALL_TAG, subjectTag(prefix)], revalidate: ONE_DAY },
  )()

export type NodeWithDocuments = {
  node: PublicNode
  path: PublicNode[]
  children: PublicNode[]
  documents: PublicDocument[]
  notices: PublicNotice[]
}

/** Un nodo (por clave o rutaSlug) con sus documentos publicados y leyendas. */
export async function getNode(
  prefix: string,
  keyOrSlug: string,
  versionSlug: string | null = null,
): Promise<NodeWithDocuments | null> {
  const nodes = await getNodes(prefix, versionSlug)
  const node = nodes.find((n) => n.key === keyOrSlug || n.routeSlug === keyOrSlug)
  if (!node) return null
  const path = ancestorPath(nodes, node.id)
  const children = nodes.filter((n) => n.parentId === node.id)
  const tags = [
    ALL_TAG,
    subjectTag(prefix),
    ...path.map((n) => nodeTag(prefix, n.key ?? n.routeSlug ?? '')),
  ]
  const { documents, notices } = await unstable_cache(
    async () => {
      const r = await asPublicBySlug(slug(), async (tx, id) => {
        const so = (await municipalityById(tx, id))?.obligatedSubjects.find(
          (x) => x.prefix === prefix,
        )
        if (!so) return { documents: [], notices: [] }
        const docs = await tx.query.documents.findMany({
          where: and(
            eq(s.documents.municipalityId, id),
            eq(s.documents.obligatedSubjectId, so.id),
            eq(s.documents.nodeId, node.id),
            eq(s.documents.status, 'published'),
          ),
          with: { currentVersion: true },
          orderBy: [
            desc(s.documents.periodStart),
            asc(s.documents.order),
            desc(s.documents.publishedAt),
          ],
        })
        const law = await tx.query.noInformationNotices.findMany({
          where: and(
            eq(s.noInformationNotices.municipalityId, id),
            eq(s.noInformationNotices.obligatedSubjectId, so.id),
            eq(s.noInformationNotices.nodeId, node.id),
            isNull(s.noInformationNotices.deletedAt),
          ),
          orderBy: [desc(s.noInformationNotices.periodStart)],
        })
        return {
          documents: docs.map(toPublicDocument),
          notices: law.map((l) => ({
            id: l.id,
            periodLabel: l.periodLabel,
            periodStart: l.periodStart,
            text: l.text,
          })),
        }
      })
      return r ?? { documents: [], notices: [] }
    },
    ['nodo-docs', slug(), prefix, node.id],
    { tags: tags, revalidate: ONE_DAY },
  )()
  return { node, path, children, documents, notices }
}

export type DocumentDetail = PublicDocument & {
  node: PublicNode
  prefix: string
  subjectName: string
  path: PublicNode[]
}

/** Documento por id, en cualquier estado (para /d/<id>: redirigir, mostrar "retirado", etc.). */
export const getDocument = (id: string): Promise<DocumentDetail | null> =>
  unstable_cache(
    async () =>
      asPublicBySlug(slug(), async (tx, municipalityId) => {
        const d = await tx.query.documents.findFirst({
          where: and(eq(s.documents.id, id), eq(s.documents.municipalityId, municipalityId)),
          with: { currentVersion: true, node: true, obligatedSubject: true },
        })
        if (!d) return null
        const nodes = await getNodes(d.obligatedSubject.prefix)
        const node = nodes.find((n) => n.id === d.nodeId)
        const path = node ? ancestorPath(nodes, node.id) : []
        return {
          ...toPublicDocument(d),
          prefix: d.obligatedSubject.prefix,
          subjectName: d.obligatedSubject.name,
          node: node ?? {
            id: d.node.id,
            parentId: d.node.parentId,
            level: d.node.level,
            number: d.node.number,
            label: d.node.label,
            title: d.node.title,
            description: d.node.description,
            key: d.node.key,
            routeSlug: d.node.routeSlug,
            frequency: d.node.frequency,
            order: d.node.order,
            documents: 0,
          },
          path,
        }
      }),
    ['document', slug(), id],
    { tags: [ALL_TAG, documentTag(id)], revalidate: ONE_DAY },
  )()

/** Para el sitemap: todas las claves públicas con su última actualización. */
export const getSitemapRoutes = (): Promise<{ path: string; updated: string }[]> =>
  unstable_cache(
    async () => {
      const r = await asPublicBySlug(slug(), async (tx, id) => {
        const m = await municipalityById(tx, id)
        if (!m) return []
        const version = await currentLawVersion(tx, m.stateId)
        if (!version) return []
        const output: { path: string; updated: string }[] = []
        for (const so of m.obligatedSubjects.filter((x) => x.active)) {
          const nodes = await nodesOf(tx, version.id, so.subjectTypeId)
          const latest = await tx
            .select({
              nodeId: s.documents.nodeId,
              date: sql<string>`max(${s.documents.updatedAt})`,
            })
            .from(s.documents)
            .where(
              and(
                eq(s.documents.municipalityId, id),
                eq(s.documents.obligatedSubjectId, so.id),
                eq(s.documents.status, 'published'),
              ),
            )
            .groupBy(s.documents.nodeId)
          const byNode = new Map(latest.map((u) => [u.nodeId, u.date]))
          const base = so.prefix ? `/${so.prefix}` : ''
          output.push({ path: base || '/transparencia', updated: new Date().toISOString() })
          for (const n of nodes) {
            const seg = n.key ?? n.routeSlug
            if (!seg) continue
            output.push({
              path: `${base}/${seg}`,
              updated: byNode.get(n.id)
                ? new Date(byNode.get(n.id)!).toISOString()
                : (version.publishedAt?.toISOString() ?? new Date().toISOString()),
            })
          }
        }
        return output
      })
      return r ?? []
    },
    ['sitemap', slug()],
    { tags: [ALL_TAG, 'sitemap'], revalidate: ONE_DAY },
  )()

/** Documentos publicados de todos los nodos de un sujeto (para la portada en acordeón). */
export const getSubjectDocuments = (prefix: string): Promise<Record<string, PublicDocument[]>> =>
  unstable_cache(
    async () => {
      const r = await asPublicBySlug(slug(), async (tx, id) => {
        const so = (await municipalityById(tx, id))?.obligatedSubjects.find(
          (x) => x.prefix === prefix,
        )
        if (!so) return {}
        const docs = await tx.query.documents.findMany({
          where: and(
            eq(s.documents.municipalityId, id),
            eq(s.documents.obligatedSubjectId, so.id),
            inArray(s.documents.status, ['published']),
          ),
          with: { currentVersion: true },
          orderBy: [desc(s.documents.periodStart), asc(s.documents.order)],
        })
        const byNode: Record<string, PublicDocument[]> = {}
        for (const d of docs) (byNode[d.nodeId] ??= []).push(toPublicDocument(d))
        return byNode
      })
      return r ?? {}
    },
    ['docs-sujeto', slug(), prefix],
    { tags: [ALL_TAG, subjectTag(prefix)], revalidate: ONE_DAY },
  )()

function toPublicDocument(
  d: typeof s.documents.$inferSelect & {
    currentVersion: typeof s.documentVersions.$inferSelect | null
  },
): PublicDocument {
  return {
    id: d.id,
    name: d.name,
    status: d.status,
    type: d.type,
    externalUrl: d.externalUrl,
    periodLabel: d.periodLabel,
    periodStart: d.periodStart,
    publishedAt: d.publishedAt?.toISOString() ?? null,
    updatedAt: d.updatedAt.toISOString(),
    version: d.currentVersion
      ? {
          storagePath: d.currentVersion.storagePath,
          fileType: d.currentVersion.fileType,
          size: d.currentVersion.size,
          mime: d.currentVersion.mime,
          durationSec: d.currentVersion.durationSec,
          thumbnailPath: d.currentVersion.thumbnailPath,
        }
      : null,
  }
}

export type PublicSummary = {
  totalDocuments: number
  lastUpdate: string | null
  /** Secciones (hojas) con más documentos, para destacar en la portada. */
  featured: {
    prefix: string
    key: string | null
    routeSlug: string | null
    title: string
    label: string
    documents: number
  }[]
}

/** Cifras para la portada del sitio: total publicado, última actualización y secciones más nutridas. */
export const getSummary = (): Promise<PublicSummary> =>
  unstable_cache(
    async () => {
      const r = await asPublicBySlug(slug(), async (tx, id) => {
        const m = await municipalityById(tx, id)
        if (!m) return null
        const [totals] = await tx
          .select({
            n: sql<number>`count(*)::int`,
            last: sql<string | null>`max(${s.documents.publishedAt})`,
          })
          .from(s.documents)
          .where(and(eq(s.documents.municipalityId, id), eq(s.documents.status, 'published')))
        const version = await currentLawVersion(tx, m.stateId)
        const featured: PublicSummary['featured'] = []
        if (version) {
          const byNode = await tx
            .select({
              nodeId: s.documents.nodeId,
              subjectId: s.documents.obligatedSubjectId,
              n: sql<number>`count(*)::int`,
            })
            .from(s.documents)
            .where(and(eq(s.documents.municipalityId, id), eq(s.documents.status, 'published')))
            .groupBy(s.documents.nodeId, s.documents.obligatedSubjectId)
          const top = byNode.sort((a, b) => b.n - a.n).slice(0, 6)
          if (top.length > 0) {
            const nodes = await tx.query.lawIndexNodes.findMany({
              where: inArray(
                s.lawIndexNodes.id,
                top.map((t) => t.nodeId),
              ),
            })
            for (const t of top) {
              const n = nodes.find((x) => x.id === t.nodeId)
              const so = m.obligatedSubjects.find((x) => x.id === t.subjectId)
              if (n && so)
                featured.push({
                  prefix: so.prefix,
                  key: n.key,
                  routeSlug: n.routeSlug,
                  title: n.title,
                  label: n.label,
                  documents: t.n,
                })
            }
          }
        }
        return {
          totalDocuments: totals?.n ?? 0,
          lastUpdate: totals?.last ? new Date(totals.last).toISOString() : null,
          featured,
        }
      })
      return r ?? { totalDocuments: 0, lastUpdate: null, featured: [] }
    },
    ['summary', slug()],
    { tags: [ALL_TAG, 'sitemap'], revalidate: ONE_DAY },
  )()
