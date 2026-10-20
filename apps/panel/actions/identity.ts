'use server'
import { require } from '@platform/auth'
import {
  remove,
  headObject,
  detectType,
  signUpload,
  readHead,
  move,
  newShortId,
  themePath,
} from '@platform/files'
import { withUser, eq, municipalityTheme, municipalities, sql } from '@platform/db'
import { enqueueRevalidation } from '@platform/db/queries/revalidation'
import { TYPEFACES, themeSchema } from '@platform/theme'
import { municipalityTags } from '@platform/transparency/tags'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { municipalityContext } from '@/lib/municipality'
import { processRevalidations } from '@/lib/revalidate'
import { action, UserFacingError } from './common'

const identitySchema = themeSchema.extend({
  typeface: z.enum(TYPEFACES),
  contactInfo: z.object({
    address: z.string().trim().max(200).optional(),
    phone: z.string().trim().max(30).optional(),
    email: z.string().trim().email().optional().or(z.literal('')),
    hours: z.string().trim().max(120).optional(),
  }),
})

export async function saveIdentity(slug: string, input: z.infer<typeof identitySchema>) {
  return action(async () => {
    const c = await municipalityContext(slug)
    require(c.session, 'identity:edit', { municipalityId: c.municipality.id })
    const e = identitySchema.parse(input)
    await withUser(c.ctx, async (tx) => {
      await tx
        .update(municipalityTheme)
        .set({
          primaryColor: e.primaryColor,
          secondaryColor: e.secondaryColor,
          accentColor: e.accentColor,
          typeface: e.typeface,
          version: sql`${municipalityTheme.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(municipalityTheme.municipalityId, c.municipality.id))
      await tx
        .update(municipalities)
        .set({
          contactInfo: { ...e.contactInfo, email: e.contactInfo.email || undefined },
          updatedAt: new Date(),
        })
        .where(eq(municipalities.id, c.municipality.id))
      await enqueueRevalidation(tx, c.municipality.id, municipalityTags())
    })
    revalidatePath(`/m/${slug}`, 'layout')
    after(() => processRevalidations(c.ctx, c.municipality))
  })
}

const imageSchema = z.object({
  slug: z.string(),
  field: z.enum(['coatOfArms', 'administrationLogo']),
  fileName: z.string().min(1).max(255),
  size: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024, 'La imagen debe pesar menos de 5 MB.'),
})

export async function prepareIdentityImage(input: z.infer<typeof imageSchema>) {
  return action(async () => {
    const e = imageSchema.parse(input)
    const c = await municipalityContext(e.slug)
    require(c.session, 'identity:edit', { municipalityId: c.municipality.id })
    const ext = e.fileName.split('.').pop()?.toLowerCase() ?? ''
    if (!['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext))
      throw new UserFacingError('Sube una imagen PNG, JPG, WebP o SVG.')
    const tempPath = `${c.municipality.slug}/_subidas/${newShortId()}${newShortId()}.${ext}`
    const contentType =
      ext === 'svg'
        ? 'image/svg+xml'
        : ext === 'png'
          ? 'image/png'
          : ext === 'webp'
            ? 'image/webp'
            : 'image/jpeg'
    const url = await signUpload(tempPath, e.size, {
      contentType,
      contentDisposition: 'inline',
    })
    return { tempPath, url, contentType }
  })
}

export async function confirmIdentityImage(
  slug: string,
  field: 'coatOfArms' | 'administrationLogo',
  tempPath: string,
) {
  return action(async () => {
    const c = await municipalityContext(slug)
    require(c.session, 'identity:edit', { municipalityId: c.municipality.id })
    if (!tempPath.startsWith(`${c.municipality.slug}/_subidas/`))
      throw new UserFacingError('Subida inválida.')
    const head = await headObject(tempPath)
    if (!head) throw new UserFacingError('La imagen no terminó de subir.')
    const ext = tempPath.split('.').pop()!
    if (ext !== 'svg') {
      const detection = await detectType(await readHead(tempPath), `imagen.${ext}`)
      if (!detection.ok || detection.type.type !== 'image') {
        await remove(tempPath)
        throw new UserFacingError('El archivo no es una imagen válida.')
      }
    } else {
      const start = new TextDecoder().decode(await readHead(tempPath, 2000)).toLowerCase()
      if (!start.includes('<svg') || start.includes('<script')) {
        await remove(tempPath)
        throw new UserFacingError('El SVG no es válido o contiene scripts.')
      }
    }
    const target = themePath(c.municipality.slug, field, newShortId(), ext)
    await move(tempPath, target, {
      contentType: head.contentType,
      contentDisposition: 'inline',
    })
    await withUser(c.ctx, async (tx) => {
      await tx
        .update(municipalityTheme)
        .set(
          field === 'coatOfArms'
            ? { coatOfArmsPath: target, version: sql`${municipalityTheme.version} + 1` }
            : { administrationLogoPath: target, version: sql`${municipalityTheme.version} + 1` },
        )
        .where(eq(municipalityTheme.municipalityId, c.municipality.id))
      await enqueueRevalidation(tx, c.municipality.id, municipalityTags())
    })
    revalidatePath(`/m/${slug}`, 'layout')
    after(() => processRevalidations(c.ctx, c.municipality))
    return { path: target }
  })
}
