'use server'
import { require } from '@platform/auth'
import {
  remove,
  headObject,
  contentDisposition,
  definition,
  detectType,
  objectHash,
  signUpload,
  readHead,
  move,
  newShortId,
  previousVersionPath,
  typeByExtension,
} from '@platform/files'
import { withUser, documentVersions, documents, eq } from '@platform/db'
import { documentById } from '@platform/db/queries/documents'
import { nodesOf, ancestorPath, currentLawVersion } from '@platform/db/queries/law-index'
import { enqueueRevalidation } from '@platform/db/queries/revalidation'
import { documentTags } from '@platform/transparency/tags'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { municipalityContext } from '@/lib/municipality'
import { processRevalidations } from '@/lib/revalidate'
import { action, UserFacingError } from './common'

const prepareSchema = z.object({
  slug: z.string(),
  documentId: z.string().min(6),
  fileName: z.string().min(1).max(255),
  size: z.number().int().positive(),
})

export async function prepareReplacement(input: z.infer<typeof prepareSchema>) {
  return action(async () => {
    const e = prepareSchema.parse(input)
    const c = await municipalityContext(e.slug)
    const doc = await withUser(c.ctx, (tx) => documentById(tx, e.documentId))
    if (!doc || doc.municipalityId !== c.municipality.id || !doc.currentVersion)
      throw new UserFacingError('Ese documento no existe o no tiene archivo.')
    require(c.session, 'document:replace', {
      municipalityId: c.municipality.id,
      obligatedSubjectId: doc.obligatedSubjectId,
      nodePath: [doc.nodeId],
    })
    const def = typeByExtension(e.fileName)
    if (!def || def.type === 'video')
      throw new UserFacingError('Ese tipo de archivo no se puede publicar.')
    if (e.size > def.maxSize)
      throw new UserFacingError(
        `Pesa ${Math.round(e.size / 1048576)} MB y el máximo es ${Math.round(def.maxSize / 1048576)} MB.`,
      )
    const ext = e.fileName.split('.').pop()!.toLowerCase()
    const tempPath = `${c.municipality.slug}/_subidas/${newShortId()}${newShortId()}.${ext}`
    const url = await signUpload(tempPath, e.size, {
      contentType: def.mimes[0]!,
      contentDisposition: 'attachment',
    })
    return { tempPath, url, contentType: def.mimes[0]! }
  })
}

const replaceSchema = z.object({
  slug: z.string(),
  documentId: z.string().min(6),
  tempPath: z.string().regex(/^[a-z0-9-]+\/_subidas\/[a-z0-9]+\.[a-z0-9]+$/),
  originalName: z.string().min(1).max(255),
})

export async function replaceFile(input: z.infer<typeof replaceSchema>) {
  return action(async () => {
    const e = replaceSchema.parse(input)
    const c = await municipalityContext(e.slug)
    if (!e.tempPath.startsWith(`${c.municipality.slug}/_subidas/`))
      throw new UserFacingError('Subida inválida.')
    await withUser(c.ctx, async (tx) => {
      const doc = await documentById(tx, e.documentId)
      if (!doc || doc.municipalityId !== c.municipality.id || !doc.currentVersion)
        throw new UserFacingError('Ese documento no existe o no tiene archivo.')
      require(c.session, 'document:replace', {
        municipalityId: c.municipality.id,
        obligatedSubjectId: doc.obligatedSubjectId,
        nodePath: [doc.nodeId],
      })
      const head = await headObject(e.tempPath)
      if (!head) throw new UserFacingError('El archivo no terminó de subir. Inténtalo de nuevo.')
      const detection = await detectType(await readHead(e.tempPath), e.originalName)
      if (!detection.ok) {
        await remove(e.tempPath)
        throw new UserFacingError(detection.reason)
      }
      const def = definition(detection.type.type)
      const previous = doc.currentVersion
      const number = previous.number + 1
      // 1. la versión vigente se va a _versiones/ con sufijo __vN
      const previousPath = previousVersionPath(previous.storagePath, previous.number)
      await move(previous.storagePath, previousPath)
      // 2. el archivo nuevo toma la ruta vigente (misma carpeta y nombre, nueva extensión si cambió)
      const ext = e.originalName.split('.').pop()!.toLowerCase()
      const newPath = previous.storagePath.replace(/\.[^.]+$/, `.${ext}`)
      await move(e.tempPath, newPath, {
        contentType: detection.mime,
        contentDisposition: contentDisposition(def.disposition, doc.name, ext),
      })
      const hashSha256 = await objectHash(newPath)
      await tx
        .update(documentVersions)
        .set({ isCurrent: false, storagePath: previousPath })
        .where(eq(documentVersions.id, previous.id))
      const [v] = await tx
        .insert(documentVersions)
        .values({
          documentId: doc.id,
          number,
          storagePath: newPath,
          originalName: e.originalName,
          mime: detection.mime,
          fileType: def.type,
          size: head.size,
          hashSha256,
          uploadedBy: c.session.userId,
        })
        .returning()
      await tx
        .update(documents)
        .set({ currentVersionId: v!.id, updatedAt: new Date() })
        .where(eq(documents.id, doc.id))
      const version = await currentLawVersion(tx, c.municipality.stateId)
      const nodes = version ? await nodesOf(tx, version.id, doc.node.subjectTypeId) : []
      const path = ancestorPath(nodes, doc.nodeId).map((n) => n.key ?? n.routeSlug ?? '')
      await enqueueRevalidation(
        tx,
        c.municipality.id,
        documentTags(doc.id, { prefix: doc.obligatedSubject.prefix, keyPath: path }),
      )
    })
    revalidatePath(`/m/${e.slug}`, 'layout')
    after(() => processRevalidations(c.ctx, c.municipality))
  })
}
