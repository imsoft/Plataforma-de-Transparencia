'use server'
import { require } from '@platform/auth'
import { contentDisposition, definition, move, filePath } from '@platform/files'
import { and, withUser, documentVersions, documents, eq, noInformationNotices } from '@platform/db'
import { documentById } from '@platform/db/queries/documents'
import { nodesOf, ancestorPath, currentLawVersion } from '@platform/db/queries/law-index'
import { enqueueRevalidation } from '@platform/db/queries/revalidation'
import { periodOf } from '@platform/law-index'
import { documentTags, nodeTags } from '@platform/transparency/tags'
import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { municipalityContext } from '@/lib/municipality'
import { processRevalidations } from '@/lib/revalidate'
import { action, UserFacingError } from './common'

const documentIdSchema = z.string().min(6).max(40)
const periodSchema = z.object({
  label: z.string().trim().min(1).max(60).nullable(),
  start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  folder: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .default('permanent'),
})
export type Period = z.infer<typeof periodSchema>

/** Etiquetas de caché del documento + su nodo y ancestros. */
async function tagsOf(
  tx: Parameters<Parameters<typeof withUser>[1]>[0],
  stateId: string,
  doc: {
    id: string
    nodeId: string
    obligatedSubject: { prefix: string }
    node: { subjectTypeId: string }
  },
) {
  const version = await currentLawVersion(tx, stateId)
  const nodes = version ? await nodesOf(tx, version.id, doc.node.subjectTypeId) : []
  const path = ancestorPath(nodes, doc.nodeId).map((n) => n.key ?? n.routeSlug ?? '')
  return documentTags(doc.id, { prefix: doc.obligatedSubject.prefix, keyPath: path })
}

async function load(slug: string, id: string) {
  const c = await municipalityContext(slug)
  const doc = await withUser(c.ctx, (tx) => documentById(tx, id))
  if (!doc || doc.municipalityId !== c.municipality.id)
    throw new UserFacingError('Ese documento ya no existe.')
  return { c, doc }
}

/**
 * Renombrar o cambiar de periodo mueve el archivo a su nueva carpeta/nombre en el bucket (sección 7.5).
 * El enlace /d/<id> no cambia porque apunta al documento, no a la ruta.
 */
async function relocateFile(
  tx: Parameters<Parameters<typeof withUser>[1]>[0],
  c: Awaited<ReturnType<typeof municipalityContext>>,
  docId: string,
) {
  const doc = await documentById(tx, docId)
  if (!doc?.currentVersion || doc.type !== 'file') return
  const so = c.municipality.obligatedSubjects.find((x) => x.id === doc.obligatedSubjectId)
  const version = await currentLawVersion(tx, c.municipality.stateId)
  if (!so || !version) return
  const ext = doc.currentVersion.storagePath.split('.').pop() ?? 'pdf'
  const newOne = filePath({
    municipalitySlug: c.municipality.slug,
    obligatedSubjectSlug: so.prefix || so.type.slug,
    versionFolder: version.storageFolder,
    nodeFolder: doc.node.storageFolder,
    periodFolder: doc.periodFolder,
    displayName: doc.name,
    shortId: doc.id.slice(0, 6),
    extension: ext,
  })
  if (newOne === doc.currentVersion.storagePath) return
  const def = definition(doc.currentVersion.fileType)
  await move(doc.currentVersion.storagePath, newOne, {
    contentType: doc.currentVersion.mime,
    contentDisposition: contentDisposition(def.disposition, doc.name, ext),
  })
  await tx
    .update(documentVersions)
    .set({ storagePath: newOne })
    .where(eq(documentVersions.id, doc.currentVersion.id))
}

function afterWrite(c: Awaited<ReturnType<typeof municipalityContext>>, slug: string) {
  revalidatePath(`/m/${slug}`, 'layout')
  after(() => processRevalidations(c.ctx, c.municipality))
}

export async function renameDocument(slug: string, id: string, name: string) {
  return action(async () => {
    const { c, doc } = await load(slug, documentIdSchema.parse(id))
    const newValue = z
      .string()
      .trim()
      .min(2, 'El nombre es muy corto.')
      .max(200, 'El nombre es muy largo (máximo 200 caracteres).')
      .parse(name)
    require(c.session, 'document:rename', {
      municipalityId: c.municipality.id,
      obligatedSubjectId: doc.obligatedSubjectId,
    })
    await withUser(c.ctx, async (tx) => {
      await tx
        .update(documents)
        .set({ name: newValue, updatedAt: new Date() })
        .where(eq(documents.id, doc.id))
      await relocateFile(tx, c, doc.id)
      await enqueueRevalidation(
        tx,
        c.municipality.id,
        await tagsOf(tx, c.municipality.stateId, doc),
      )
    })
    afterWrite(c, slug)
  })
}

export async function changePeriod(slug: string, id: string, period: Period) {
  return action(async () => {
    const { c, doc } = await load(slug, documentIdSchema.parse(id))
    const p = periodSchema.parse(period)
    require(c.session, 'document:rename', {
      municipalityId: c.municipality.id,
      obligatedSubjectId: doc.obligatedSubjectId,
    })
    await withUser(c.ctx, async (tx) => {
      await tx
        .update(documents)
        .set({
          periodLabel: p.label,
          periodStart: p.start,
          periodEnd: p.end,
          periodFolder: p.folder,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, doc.id))
      await relocateFile(tx, c, doc.id)
      await enqueueRevalidation(
        tx,
        c.municipality.id,
        await tagsOf(tx, c.municipality.stateId, doc),
      )
    })
    afterWrite(c, slug)
  })
}

const STATUSES = z.enum(['published', 'hidden', 'historical', 'trash'])
const ACTION_BY_STATUS = {
  published: 'document:restore',
  hidden: 'document:hide',
  historical: 'document:hide',
  trash: 'document:delete',
} as const

export async function changeDocumentStatus(
  slug: string,
  id: string,
  status: z.infer<typeof STATUSES>,
) {
  return action(async () => {
    const { c, doc } = await load(slug, documentIdSchema.parse(id))
    const newValue = STATUSES.parse(status)
    require(c.session, ACTION_BY_STATUS[newValue], {
      municipalityId: c.municipality.id,
      obligatedSubjectId: doc.obligatedSubjectId,
    })
    await withUser(c.ctx, async (tx) => {
      await tx
        .update(documents)
        .set({
          status: newValue,
          deletedAt: newValue === 'trash' ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, doc.id))
      await enqueueRevalidation(
        tx,
        c.municipality.id,
        await tagsOf(tx, c.municipality.stateId, doc),
      )
    })
    afterWrite(c, slug)
    return { previousStatus: doc.status }
  })
}

export async function reorderDocuments(
  slug: string,
  nodeId: string,
  obligatedSubjectId: string,
  orderedIds: string[],
) {
  return action(async () => {
    const c = await municipalityContext(slug)
    const ids = z.array(documentIdSchema).min(1).max(500).parse(orderedIds)
    require(c.session, 'document:reorder', {
      municipalityId: c.municipality.id,
      obligatedSubjectId,
    })
    await withUser(c.ctx, async (tx) => {
      for (const [i, id] of ids.entries()) {
        await tx
          .update(documents)
          .set({ order: i })
          .where(
            and(
              eq(documents.id, id),
              eq(documents.nodeId, nodeId),
              eq(documents.municipalityId, c.municipality.id),
            ),
          )
      }
      const first = await documentById(tx, ids[0]!)
      if (first)
        await enqueueRevalidation(
          tx,
          c.municipality.id,
          await tagsOf(tx, c.municipality.stateId, first),
        )
    })
    afterWrite(c, slug)
  })
}

const noticeSchema = z.object({
  obligatedSubjectId: z.string().uuid(),
  nodeId: z.string().uuid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  frequency: z.enum(['monthly', 'quarterly', 'semiannual', 'annual']),
  text: z
    .string()
    .trim()
    .min(10, 'Explica brevemente por qué no se generó información (mínimo 10 letras).')
    .max(1000),
})

export async function markNotice(slug: string, input: z.infer<typeof noticeSchema>) {
  return action(async () => {
    const c = await municipalityContext(slug)
    const e = noticeSchema.parse(input)
    require(c.session, 'notice:mark', {
      municipalityId: c.municipality.id,
      obligatedSubjectId: e.obligatedSubjectId,
      nodePath: [e.nodeId],
    })
    const period = periodOf(e.frequency, e.periodStart)
    await withUser(c.ctx, async (tx) => {
      await tx.insert(noInformationNotices).values({
        municipalityId: c.municipality.id,
        obligatedSubjectId: e.obligatedSubjectId,
        nodeId: e.nodeId,
        periodLabel: period.label,
        periodStart: period.start,
        periodEnd: period.end,
        text: e.text,
        createdBy: c.session.userId,
      })
      const so = c.municipality.obligatedSubjects.find((x) => x.id === e.obligatedSubjectId)!
      const version = await currentLawVersion(tx, c.municipality.stateId)
      const nodes = version ? await nodesOf(tx, version.id, so.subjectTypeId) : []
      const path = ancestorPath(nodes, e.nodeId).map((n) => n.key ?? n.routeSlug ?? '')
      await enqueueRevalidation(
        tx,
        c.municipality.id,
        nodeTags({ prefix: so.prefix, keyPath: path }),
      )
    })
    afterWrite(c, slug)
  })
}

export async function unmarkNotice(slug: string, noticeId: string) {
  return action(async () => {
    const c = await municipalityContext(slug)
    const id = z.string().uuid().parse(noticeId)
    await withUser(c.ctx, async (tx) => {
      const l = await tx.query.noInformationNotices.findFirst({
        where: eq(noInformationNotices.id, id),
      })
      if (!l) throw new UserFacingError('Esa leyenda ya no existe.')
      require(c.session, 'notice:unmark', {
        municipalityId: c.municipality.id,
        obligatedSubjectId: l.obligatedSubjectId,
        nodePath: [l.nodeId],
      })
      await tx
        .update(noInformationNotices)
        .set({ deletedAt: new Date() })
        .where(eq(noInformationNotices.id, id))
      const so = c.municipality.obligatedSubjects.find((x) => x.id === l.obligatedSubjectId)!
      const version = await currentLawVersion(tx, c.municipality.stateId)
      const nodes = version ? await nodesOf(tx, version.id, so.subjectTypeId) : []
      const path = ancestorPath(nodes, l.nodeId).map((n) => n.key ?? n.routeSlug ?? '')
      await enqueueRevalidation(
        tx,
        c.municipality.id,
        nodeTags({ prefix: so.prefix, keyPath: path }),
      )
    })
    afterWrite(c, slug)
  })
}
