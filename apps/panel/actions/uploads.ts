'use server'
import { require } from '@platform/auth'
import {
  headObject,
  contentDisposition,
  definition,
  detectType,
  objectHash,
  signUpload,
  readHead,
  move,
  newShortId,
  newDocumentId,
  filePath,
  typeByExtension,
  remove,
} from '@platform/files'
import { withUser, documentVersions, documents, eq } from '@platform/db'
import { nodesOf, ancestorPath, currentLawVersion } from '@platform/db/queries/law-index'
import { enqueueRevalidation } from '@platform/db/queries/revalidation'
import { documentTags } from '@platform/transparency/tags'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { municipalityContext } from '@/lib/municipality'
import { processRevalidations } from '@/lib/revalidate'
import { action, UserFacingError } from './common'

const base = z.object({
  slug: z.string(),
  obligatedSubjectId: z.string().uuid(),
  nodeId: z.string().uuid(),
})

const prepareSchema = base.extend({
  fileName: z.string().min(1).max(255),
  size: z.number().int().positive(),
})

/** Paso 1: URL firmada para subir directo al bucket, a una ruta temporal. */
export async function prepareUpload(input: z.infer<typeof prepareSchema>) {
  return action(async () => {
    const e = prepareSchema.parse(input)
    const c = await municipalityContext(e.slug)
    require(c.session, 'document:upload', {
      municipalityId: c.municipality.id,
      obligatedSubjectId: e.obligatedSubjectId,
      nodePath: [e.nodeId],
    })
    const def = typeByExtension(e.fileName)
    if (!def)
      throw new UserFacingError(
        'Ese tipo de archivo no se puede publicar. Sube PDF, Word, Excel, PowerPoint, ZIP, imagen o video.',
      )
    if (e.size > def.maxSize) {
      throw new UserFacingError(
        `Este archivo pesa ${mb(e.size)} y el máximo para ${def.name} es ${mb(def.maxSize)}. Intenta comprimirlo o dividirlo.`,
      )
    }
    if (def.type === 'video')
      throw new UserFacingError(
        'Por ahora los videos se publican con su enlace de YouTube o Facebook. La subida directa de videos llega pronto.',
      )
    const ext = e.fileName.split('.').pop()!.toLowerCase()
    const uploadId = newShortId() + newShortId()
    const tempPath = `${c.municipality.slug}/_subidas/${uploadId}.${ext}`
    const contentType = def.mimes[0]!
    const url = await signUpload(tempPath, e.size, {
      contentType,
      contentDisposition: 'attachment',
    })
    return { uploadId, tempPath, url, contentType }
  })
}

const confirmedFileSchema = z.object({
  tempPath: z.string().regex(/^[a-z0-9-]+\/_subidas\/[a-z0-9]+\.[a-z0-9]+$/),
  originalName: z.string().min(1).max(255),
  name: z.string().trim().min(2, 'El nombre es muy corto.').max(200),
  period: z.object({
    label: z.string().nullable(),
    start: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    end: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    folder: z.string().regex(/^[a-z0-9-]+$/),
  }),
})
const publishSchema = base.extend({ files: z.array(confirmedFileSchema).min(1).max(20) })

/** Paso 3: valida el archivo real, lo mueve a su carpeta definitiva y crea el documento. */
export async function publishDocuments(input: z.infer<typeof publishSchema>) {
  return action(async () => {
    const e = publishSchema.parse(input)
    const c = await municipalityContext(e.slug)
    require(c.session, 'document:upload', {
      municipalityId: c.municipality.id,
      obligatedSubjectId: e.obligatedSubjectId,
      nodePath: [e.nodeId],
    })
    const so = c.municipality.obligatedSubjects.find((x) => x.id === e.obligatedSubjectId)
    if (!so) throw new UserFacingError('El sujeto obligado no existe.')
    for (const a of e.files)
      if (!a.tempPath.startsWith(`${c.municipality.slug}/_subidas/`))
        throw new UserFacingError('Subida inválida.')

    const created: { id: string; name: string }[] = []
    await withUser(c.ctx, async (tx) => {
      const version = await currentLawVersion(tx, c.municipality.stateId)
      if (!version) throw new UserFacingError('No hay una versión vigente del índice.')
      const nodes = await nodesOf(tx, version.id, so.subjectTypeId)
      const node = nodes.find((n) => n.id === e.nodeId)
      if (!node) throw new UserFacingError('La sección del índice no existe.')
      const keyPath = ancestorPath(nodes, node.id).map((n) => n.key ?? n.routeSlug ?? '')
      const lastOrder = (
        await tx.query.documents.findMany({
          where: eq(documents.nodeId, node.id),
          columns: { order: true },
        })
      ).reduce((m, d) => Math.max(m, d.order), -1)

      for (const [i, a] of e.files.entries()) {
        const head = await headObject(a.tempPath)
        if (!head)
          throw new UserFacingError(
            `El archivo "${a.originalName}" no terminó de subir. Inténtalo de nuevo.`,
          )
        const detection = await detectType(await readHead(a.tempPath), a.originalName)
        if (!detection.ok) {
          await remove(a.tempPath)
          throw new UserFacingError(`"${a.originalName}": ${detection.reason}`)
        }
        const def = definition(detection.type.type)
        if (head.size > def.maxSize) {
          await remove(a.tempPath)
          throw new UserFacingError(
            `"${a.originalName}" pesa ${mb(head.size)} y el máximo es ${mb(def.maxSize)}.`,
          )
        }
        const ext = a.originalName.split('.').pop()!.toLowerCase()
        const id = newDocumentId()
        const finalPath = filePath({
          municipalitySlug: c.municipality.slug,
          obligatedSubjectSlug: so.prefix || so.type.slug,
          versionFolder: version.storageFolder,
          nodeFolder: node.storageFolder,
          periodFolder: a.period.folder,
          displayName: a.name,
          shortId: id.slice(0, 6),
          extension: ext,
        })
        await move(a.tempPath, finalPath, {
          contentType: detection.mime,
          contentDisposition: contentDisposition(def.disposition, a.name, ext),
        })
        const hashSha256 = await objectHash(finalPath)

        const [doc] = await tx
          .insert(documents)
          .values({
            id,
            municipalityId: c.municipality.id,
            obligatedSubjectId: so.id,
            nodeId: node.id,
            name: a.name,
            periodLabel: a.period.label,
            periodStart: a.period.start,
            periodEnd: a.period.end,
            periodFolder: a.period.folder,
            order: lastOrder + 1 + i,
            status: 'published',
            type: 'file',
            publishedAt: new Date(),
            createdBy: c.session.userId,
          })
          .returning()
        const [view] = await tx
          .insert(documentVersions)
          .values({
            documentId: id,
            number: 1,
            storagePath: finalPath,
            originalName: a.originalName,
            mime: detection.mime,
            fileType: def.type,
            size: head.size,
            hashSha256,
            uploadedBy: c.session.userId,
          })
          .returning()
        await tx.update(documents).set({ currentVersionId: view!.id }).where(eq(documents.id, id))
        await enqueueRevalidation(
          tx,
          c.municipality.id,
          documentTags(id, { prefix: so.prefix, keyPath }),
        )
        created.push({ id: doc!.id, name: doc!.name })
      }
    })
    revalidatePath(`/m/${e.slug}`, 'layout')
    after(() => processRevalidations(c.ctx, c.municipality))
    return created
  })
}

const externalVideoSchema = base.extend({
  url: z.string().url('Pega un enlace válido (debe empezar con https://).'),
  name: z.string().trim().min(2).max(200),
  period: confirmedFileSchema.shape.period,
})

const VIDEO_PATTERNS = [
  /^https:\/\/(www\.|m\.)?youtube\.com\/(watch\?v=|live\/|shorts\/)[\w-]+/,
  /^https:\/\/youtu\.be\/[\w-]+/,
  /^https:\/\/(www\.|m\.|web\.)?facebook\.com\/.+\/videos\/\d+/,
  /^https:\/\/(www\.)?facebook\.com\/watch\/?\?v=\d+/,
  /^https:\/\/fb\.watch\/[\w-]+/,
]

export async function createExternalVideo(input: z.infer<typeof externalVideoSchema>) {
  return action(async () => {
    const e = externalVideoSchema.parse(input)
    if (!VIDEO_PATTERNS.some((p) => p.test(e.url)))
      throw new UserFacingError('Solo se aceptan enlaces de videos de YouTube o Facebook.')
    const c = await municipalityContext(e.slug)
    require(c.session, 'document:upload', {
      municipalityId: c.municipality.id,
      obligatedSubjectId: e.obligatedSubjectId,
      nodePath: [e.nodeId],
    })
    const so = c.municipality.obligatedSubjects.find((x) => x.id === e.obligatedSubjectId)
    if (!so) throw new UserFacingError('El sujeto obligado no existe.')
    const id = newDocumentId()
    await withUser(c.ctx, async (tx) => {
      const version = await currentLawVersion(tx, c.municipality.stateId)
      const nodes = version ? await nodesOf(tx, version.id, so.subjectTypeId) : []
      const keyPath = ancestorPath(nodes, e.nodeId).map((n) => n.key ?? n.routeSlug ?? '')
      await tx.insert(documents).values({
        id,
        municipalityId: c.municipality.id,
        obligatedSubjectId: so.id,
        nodeId: e.nodeId,
        name: e.name,
        periodLabel: e.period.label,
        periodStart: e.period.start,
        periodEnd: e.period.end,
        periodFolder: e.period.folder,
        status: 'published',
        type: 'external_video',
        externalUrl: e.url,
        publishedAt: new Date(),
        createdBy: c.session.userId,
      })
      await enqueueRevalidation(
        tx,
        c.municipality.id,
        documentTags(id, { prefix: so.prefix, keyPath }),
      )
    })
    revalidatePath(`/m/${e.slug}`, 'layout')
    after(() => processRevalidations(c.ctx, c.municipality))
    return { id, name: e.name }
  })
}

const mb = (b: number) => `${Math.round(b / 1024 / 1024)} MB`
