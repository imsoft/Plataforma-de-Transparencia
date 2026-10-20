'use server'
import { require } from '@platform/auth'
import {
  abortMultipart,
  remove,
  headObject,
  completeMultipart,
  contentDisposition,
  definition,
  detectType,
  signPart,
  objectHash,
  startMultipart,
  readHead,
  listParts,
  move,
  newShortId,
  newDocumentId,
  filePath,
  thumbnailPathFor,
  uploadFromServer,
  typeByExtension,
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

/** Tamaño de cada parte: 16 MB (mínimo S3 5 MB). Un video de 2 GB son 125 partes. */
const PART_SIZE = 16 * 1024 * 1024

const base = z.object({
  slug: z.string(),
  obligatedSubjectId: z.string().uuid(),
  nodeId: z.string().uuid(),
})
const tempPathSchema = z.string().regex(/^[a-z0-9-]+\/_subidas\/[a-z0-9]+\.[a-z0-9]+$/)

export async function startVideoUpload(
  input: z.infer<typeof base> & { fileName: string; size: number },
) {
  return action(async () => {
    const e = base
      .extend({ fileName: z.string().min(1).max(255), size: z.number().int().positive() })
      .parse(input)
    const c = await municipalityContext(e.slug)
    require(c.session, 'document:upload', {
      municipalityId: c.municipality.id,
      obligatedSubjectId: e.obligatedSubjectId,
      nodePath: [e.nodeId],
    })
    const def = typeByExtension(e.fileName)
    if (!def || def.type !== 'video')
      throw new UserFacingError('Sube un video MP4 (recomendado), WebM o MOV.')
    if (e.size > def.maxSize)
      throw new UserFacingError(
        `El video pesa ${gb(e.size)} y el máximo es ${gb(def.maxSize)}. Comprímelo o súbelo a YouTube y pega el enlace.`,
      )
    const ext = e.fileName.split('.').pop()!.toLowerCase()
    const tempPath = `${c.municipality.slug}/_subidas/${newShortId()}${newShortId()}.${ext}`
    const contentType = def.mimes[['mp4', 'webm', 'mov'].indexOf(ext)] ?? def.mimes[0]!
    const uploadId = await startMultipart(tempPath, {
      contentType,
      contentDisposition: 'inline',
    })
    return {
      tempPath,
      uploadId,
      partSize: PART_SIZE,
      parts: Math.ceil(e.size / PART_SIZE),
    }
  })
}

export async function signVideoPart(
  slug: string,
  tempPath: string,
  uploadId: string,
  number: number,
) {
  return action(async () => {
    const c = await municipalityContext(slug)
    const path = tempPathSchema.parse(tempPath)
    if (!path.startsWith(`${c.municipality.slug}/_subidas/`))
      throw new UserFacingError('Subida inválida.')
    return {
      url: await signPart(
        path,
        z.string().min(1).parse(uploadId),
        z.number().int().min(1).max(10000).parse(number),
      ),
    }
  })
}

/** Para reanudar: qué partes ya están en el bucket. */
export async function uploadedParts(slug: string, tempPath: string, uploadId: string) {
  return action(async () => {
    const c = await municipalityContext(slug)
    const path = tempPathSchema.parse(tempPath)
    if (!path.startsWith(`${c.municipality.slug}/_subidas/`))
      throw new UserFacingError('Subida inválida.')
    try {
      return await listParts(path, uploadId)
    } catch {
      return [] // la subida ya no existe (expiró o se abortó): empezar de nuevo
    }
  })
}

export async function cancelVideoUpload(slug: string, tempPath: string, uploadId: string) {
  return action(async () => {
    const c = await municipalityContext(slug)
    const path = tempPathSchema.parse(tempPath)
    if (!path.startsWith(`${c.municipality.slug}/_subidas/`))
      throw new UserFacingError('Subida inválida.')
    await abortMultipart(path, uploadId).catch(() => {})
  })
}

const publishSchema = base.extend({
  tempPath: tempPathSchema,
  uploadId: z.string().min(1),
  parts: z.array(z.object({ PartNumber: z.number().int().min(1), ETag: z.string().min(1) })).min(1),
  originalName: z.string().min(1).max(255),
  name: z.string().trim().min(2).max(200),
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
  durationSec: z.number().int().nonnegative().nullable(),
  /** JPEG en base64 (sin prefijo data:), generado en el navegador; máx. ~400 KB. */
  thumbnailBase64: z.string().max(600_000).nullable(),
})

export async function publishVideo(input: z.infer<typeof publishSchema>) {
  return action(async () => {
    const e = publishSchema.parse(input)
    const c = await municipalityContext(e.slug)
    require(c.session, 'document:upload', {
      municipalityId: c.municipality.id,
      obligatedSubjectId: e.obligatedSubjectId,
      nodePath: [e.nodeId],
    })
    if (!e.tempPath.startsWith(`${c.municipality.slug}/_subidas/`))
      throw new UserFacingError('Subida inválida.')
    const so = c.municipality.obligatedSubjects.find((x) => x.id === e.obligatedSubjectId)
    if (!so) throw new UserFacingError('El sujeto obligado no existe.')

    await completeMultipart(
      e.tempPath,
      e.uploadId,
      e.parts.sort((a, b) => a.PartNumber - b.PartNumber),
    )
    const head = await headObject(e.tempPath)
    if (!head) throw new UserFacingError('El video no terminó de subir. Inténtalo de nuevo.')
    const detection = await detectType(await readHead(e.tempPath), e.originalName)
    if (!detection.ok || detection.type.type !== 'video') {
      await remove(e.tempPath)
      throw new UserFacingError(detection.ok ? 'El archivo no es un video.' : detection.reason)
    }
    const def = definition('video')
    if (head.size > def.maxSize) {
      await remove(e.tempPath)
      throw new UserFacingError(`El video pesa ${gb(head.size)} y el máximo es ${gb(def.maxSize)}.`)
    }

    const id = newDocumentId()
    await withUser(c.ctx, async (tx) => {
      const version = await currentLawVersion(tx, c.municipality.stateId)
      if (!version) throw new UserFacingError('No hay una versión vigente del índice.')
      const nodes = await nodesOf(tx, version.id, so.subjectTypeId)
      const node = nodes.find((n) => n.id === e.nodeId)
      if (!node) throw new UserFacingError('La sección del índice no existe.')
      const ext = e.originalName.split('.').pop()!.toLowerCase()
      const finalPath = filePath({
        municipalitySlug: c.municipality.slug,
        obligatedSubjectSlug: so.prefix || so.type.slug,
        versionFolder: version.storageFolder,
        nodeFolder: node.storageFolder,
        periodFolder: e.period.folder,
        displayName: e.name,
        shortId: id.slice(0, 6),
        extension: ext,
      })
      await move(e.tempPath, finalPath, {
        contentType: detection.mime,
        contentDisposition: contentDisposition('inline', e.name, ext),
      })
      let thumbnailPath: string | null = null
      if (e.thumbnailBase64) {
        thumbnailPath = thumbnailPathFor(finalPath)
        await uploadFromServer(thumbnailPath, Buffer.from(e.thumbnailBase64, 'base64'), {
          contentType: 'image/jpeg',
          contentDisposition: 'inline',
        })
      }
      const lastOrder = (
        await tx.query.documents.findMany({
          where: eq(documents.nodeId, node.id),
          columns: { order: true },
        })
      ).reduce((m, d) => Math.max(m, d.order), -1)
      await tx.insert(documents).values({
        id,
        municipalityId: c.municipality.id,
        obligatedSubjectId: so.id,
        nodeId: node.id,
        name: e.name,
        periodLabel: e.period.label,
        periodStart: e.period.start,
        periodEnd: e.period.end,
        periodFolder: e.period.folder,
        order: lastOrder + 1,
        status: 'published',
        type: 'file',
        publishedAt: new Date(),
        createdBy: c.session.userId,
      })
      const [view] = await tx
        .insert(documentVersions)
        .values({
          documentId: id,
          number: 1,
          storagePath: finalPath,
          originalName: e.originalName,
          mime: detection.mime,
          fileType: 'video',
          size: head.size,
          durationSec: e.durationSec,
          thumbnailPath,
          uploadedBy: c.session.userId,
        })
        .returning()
      await tx.update(documents).set({ currentVersionId: view!.id }).where(eq(documents.id, id))
      const keyPath = ancestorPath(nodes, node.id).map((n) => n.key ?? n.routeSlug ?? '')
      await enqueueRevalidation(
        tx,
        c.municipality.id,
        documentTags(id, { prefix: so.prefix, keyPath }),
      )
    })
    revalidatePath(`/m/${e.slug}`, 'layout')
    after(async () => {
      await processRevalidations(c.ctx, c.municipality)
      // el hash de un video de varios GB se calcula después de responder
      const v = await withUser(c.ctx, (tx) =>
        tx.query.documentVersions.findFirst({ where: eq(documentVersions.documentId, id) }),
      )
      if (v) {
        const h = await objectHash(v.storagePath).catch(() => null)
        if (h)
          await withUser(c.ctx, (tx) =>
            tx.update(documentVersions).set({ hashSha256: h }).where(eq(documentVersions.id, v.id)),
          )
      }
    })
    return { id, name: e.name }
  })
}

const gb = (b: number) =>
  b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.round(b / 1024 ** 2)} MB`
