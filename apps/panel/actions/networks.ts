'use server'
import { require } from '@platform/auth'
import { and, withUser, eq, socialNetworks } from '@platform/db'
import { enqueueRevalidation } from '@platform/db/queries/revalidation'
import { NETWORKS, whatsappLink, validateLink } from '@platform/social-networks'
import { municipalityTags } from '@platform/transparency/tags'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { municipalityContext } from '@/lib/municipality'
import { processRevalidations } from '@/lib/revalidate'
import { action, UserFacingError } from './common'

const networkSchema = z.object({
  id: z.string().uuid().optional(),
  obligatedSubjectId: z.string().uuid().nullable(),
  network: z.enum(NETWORKS.map((r) => r.slug) as [string, ...string[]]),
  otherName: z.string().trim().max(40).nullable(),
  url: z.string().trim().max(500),
  whatsapp: z.object({ number: z.string(), message: z.string().max(200).optional() }).optional(),
  text: z.string().trim().max(80).nullable(),
  visible: z.boolean().default(true),
  hideDuringBlackout: z.boolean().default(false),
})

export async function saveNetwork(slug: string, input: z.input<typeof networkSchema>) {
  return action(async () => {
    const c = await municipalityContext(slug)
    require(c.session, 'socialNetworks:edit', { municipalityId: c.municipality.id })
    const e = networkSchema.parse(input)
    let url = e.url
    if (e.network === 'whatsapp' && e.whatsapp) {
      const wa = whatsappLink(e.whatsapp.number, e.whatsapp.message)
      if (!wa) throw new UserFacingError('Escribe el número de WhatsApp a 10 dígitos.')
      url = wa
    }
    const v = validateLink(url, e.network)
    if (!v.ok) throw new UserFacingError(v.error)
    await withUser(c.ctx, async (tx) => {
      if (e.id) {
        await tx
          .update(socialNetworks)
          .set({
            obligatedSubjectId: e.obligatedSubjectId,
            network: e.network,
            otherName: e.otherName,
            url,
            text: e.text,
            visible: e.visible,
            hideDuringBlackout: e.hideDuringBlackout,
            updatedAt: new Date(),
          })
          .where(
            and(eq(socialNetworks.id, e.id), eq(socialNetworks.municipalityId, c.municipality.id)),
          )
      } else {
        const existing = await tx.query.socialNetworks.findMany({
          where: eq(socialNetworks.municipalityId, c.municipality.id),
          columns: { order: true },
        })
        await tx.insert(socialNetworks).values({
          municipalityId: c.municipality.id,
          obligatedSubjectId: e.obligatedSubjectId,
          network: e.network,
          otherName: e.otherName,
          url,
          text: e.text,
          visible: e.visible,
          hideDuringBlackout: e.hideDuringBlackout,
          order: existing.length,
        })
      }
      await enqueueRevalidation(tx, c.municipality.id, municipalityTags())
    })
    revalidatePath(`/m/${slug}/redes-sociales`)
    after(() => processRevalidations(c.ctx, c.municipality))
    return { warning: v.warning }
  })
}

export async function deleteNetwork(slug: string, id: string) {
  return action(async () => {
    const c = await municipalityContext(slug)
    require(c.session, 'socialNetworks:edit', { municipalityId: c.municipality.id })
    await withUser(c.ctx, async (tx) => {
      await tx
        .delete(socialNetworks)
        .where(
          and(
            eq(socialNetworks.id, z.string().uuid().parse(id)),
            eq(socialNetworks.municipalityId, c.municipality.id),
          ),
        )
      await enqueueRevalidation(tx, c.municipality.id, municipalityTags())
    })
    revalidatePath(`/m/${slug}/redes-sociales`)
    after(() => processRevalidations(c.ctx, c.municipality))
  })
}

export async function reorderNetworks(slug: string, orderedIds: string[]) {
  return action(async () => {
    const c = await municipalityContext(slug)
    require(c.session, 'socialNetworks:edit', { municipalityId: c.municipality.id })
    const ids = z.array(z.string().uuid()).parse(orderedIds)
    await withUser(c.ctx, async (tx) => {
      for (const [i, id] of ids.entries())
        await tx
          .update(socialNetworks)
          .set({ order: i })
          .where(
            and(eq(socialNetworks.id, id), eq(socialNetworks.municipalityId, c.municipality.id)),
          )
      await enqueueRevalidation(tx, c.municipality.id, municipalityTags())
    })
    revalidatePath(`/m/${slug}/redes-sociales`)
    after(() => processRevalidations(c.ctx, c.municipality))
  })
}
