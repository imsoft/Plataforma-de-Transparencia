'use server'
import { require } from '@platform/auth'
import { signLongRead } from '@platform/files'
import { and, withUser, desc, eq, exportJobs } from '@platform/db'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { generateExport } from '@/lib/export'
import { municipalityContext } from '@/lib/municipality'
import { action, UserFacingError } from './common'

export async function requestExport(slug: string) {
  return action(async () => {
    const c = await municipalityContext(slug)
    require(c.session, 'exportJob:request', { municipalityId: c.municipality.id })
    const id = await withUser(c.ctx, async (tx) => {
      const inProgress = await tx.query.exportJobs.findFirst({
        where: and(
          eq(exportJobs.municipalityId, c.municipality.id),
          eq(exportJobs.status, 'generating'),
        ),
      })
      if (inProgress)
        throw new UserFacingError(
          'Ya hay una exportación generándose. Te avisamos por correo cuando termine.',
        )
      const [e] = await tx
        .insert(exportJobs)
        .values({ municipalityId: c.municipality.id, requesterId: c.session.userId })
        .returning()
      return e!.id
    })
    revalidatePath(`/m/${slug}/exportaciones`)
    const { id: municipalityId, slug: mSlug, name, officialName } = c.municipality
    after(() =>
      generateExport(
        c.ctx,
        { id: municipalityId, slug: mSlug, name, officialName },
        id,
        c.session.email,
      ),
    )
    return { id }
  })
}

export async function listExports(slug: string) {
  const c = await municipalityContext(slug)
  require(c.session, 'exportJob:view', { municipalityId: c.municipality.id })
  const rows = await withUser(c.ctx, (tx) =>
    tx.query.exportJobs.findMany({
      where: eq(exportJobs.municipalityId, c.municipality.id),
      orderBy: [desc(exportJobs.createdAt)],
      limit: 20,
    }),
  )
  return Promise.all(
    rows.map(async (f) => ({
      id: f.id,
      status: f.status,
      createdAt: f.createdAt,
      finishedAt: f.finishedAt,
      errorMessage: f.errorMessage,
      link: f.status === 'ready' && f.storagePath ? await signLongRead(f.storagePath) : null,
    })),
  )
}
