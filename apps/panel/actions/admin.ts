'use server'
import { requireSuperadmin } from '@platform/auth'
import { dbContext } from '@platform/auth'
import {
  and,
  withUser,
  eq,
  states,
  lawIndexVersions,
  member,
  municipalityDomains,
  municipalityTheme,
  municipalities,
  organization,
  obligatedSubjects,
  obligatedSubjectTypes,
  user as userTable,
} from '@platform/db'
import { loadLawIndex, publishVersion } from '@platform/law-index/load'
import { isReservedRoute } from '@platform/transparency/routes'
import { readFile, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireSession } from '@/lib/session'
import { action, UserFacingError } from './common'

async function superadmin() {
  const s = await requireSession()
  requireSuperadmin(s)
  return { s, ctx: dbContext(s) }
}

const municipalitySchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]{3,40}$/, 'El identificador solo lleva minúsculas, números y guiones.'),
  name: z.string().trim().min(2).max(80),
  officialName: z.string().trim().min(5).max(120),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Escribe el dominio sin https:// (ej. tuxcacuesco.gob.mx)'),
  stateCode: z.string().default('JAL'),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  secondaryColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  accentColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  revalidationUrl: z.string().url().optional().or(z.literal('')),
  subjects: z
    .array(
      z.object({
        typeSlug: z.string(),
        name: z.string().trim().min(2),
        prefix: z.string().regex(/^[a-z0-9-]*$/),
      }),
    )
    .min(1),
})

export async function createMunicipality(input: z.input<typeof municipalitySchema>) {
  return action(async () => {
    const { ctx } = await superadmin()
    const e = municipalitySchema.parse(input)
    for (const so of e.subjects)
      if (so.prefix && isReservedRoute(so.prefix))
        throw new UserFacingError(`El prefijo "${so.prefix}" está reservado por la plataforma.`)
    if (e.subjects.filter((s) => s.prefix === '').length !== 1)
      throw new UserFacingError(
        'Debe haber exactamente un sujeto obligado en la raíz (el Ayuntamiento, sin prefijo).',
      )
    const id = await withUser({ ...ctx, origin: 'generator' }, async (tx) => {
      const status = await tx.query.states.findFirst({ where: eq(states.key, e.stateCode) })
      if (!status) throw new UserFacingError('No existe ese estado.')
      if (await tx.query.municipalities.findFirst({ where: eq(municipalities.slug, e.slug) }))
        throw new UserFacingError('Ya existe un municipio con ese identificador.')
      const orgId = `org_${e.slug}`
      await tx
        .insert(organization)
        .values({ id: orgId, name: e.name, slug: e.slug, createdAt: new Date() })
      const [m] = await tx
        .insert(municipalities)
        .values({
          stateId: status.id,
          organizationId: orgId,
          slug: e.slug,
          name: e.name,
          officialName: e.officialName,
          revalidationUrl: e.revalidationUrl || `https://${e.domain}/api/revalidate`,
        })
        .returning()
      await tx
        .insert(municipalityDomains)
        .values({ municipalityId: m!.id, host: e.domain, isPrimary: true })
      await tx.insert(municipalityTheme).values({
        municipalityId: m!.id,
        primaryColor: e.primaryColor,
        secondaryColor: e.secondaryColor,
        accentColor: e.accentColor,
      })
      for (const [i, so] of e.subjects.entries()) {
        const type = await tx.query.obligatedSubjectTypes.findFirst({
          where: eq(obligatedSubjectTypes.slug, so.typeSlug),
        })
        if (!type)
          throw new UserFacingError(`No existe el tipo de sujeto obligado "${so.typeSlug}".`)
        await tx.insert(obligatedSubjects).values({
          municipalityId: m!.id,
          subjectTypeId: type.id,
          name: so.name,
          prefix: so.prefix,
          order: i,
        })
      }
      return m!.id
    })
    revalidatePath('/admin')
    return { id, slug: e.slug }
  })
}

/** Archivos de índice disponibles en el repo (packages/law-index/data/<carpeta>/<tipo>.json). */
export async function listLawIndexFiles() {
  return action(async () => {
    await superadmin()
    const moduleRequire = createRequire(import.meta.url)
    const base = moduleRequire
      .resolve('@platform/law-index/package.json')
      .replace(/package\.json$/, 'data')
    const folders = await readdir(base, { withFileTypes: true })
    const output: { folder: string; files: string[] }[] = []
    for (const c of folders.filter((d) => d.isDirectory())) {
      const files = (await readdir(`${base}/${c.name}`)).filter((a) => a.endsWith('.json'))
      output.push({ folder: c.name, files })
    }
    return output
  })
}

export async function loadLawIndexFromRepo(folder: string, file: string) {
  return action(async () => {
    const { ctx } = await superadmin()
    const c = z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .parse(folder)
    const a = z
      .string()
      .regex(/^[a-z0-9-]+\.json$/)
      .parse(file)
    const moduleRequire = createRequire(import.meta.url)
    const base = moduleRequire
      .resolve('@platform/law-index/package.json')
      .replace(/package\.json$/, 'data')
    const json = JSON.parse(await readFile(`${base}/${c}/${a}`, 'utf8')) as unknown
    const r = await withUser({ ...ctx, origin: 'generator' }, (tx) => loadLawIndex(tx, json))
    revalidatePath('/admin/indice')
    return r
  })
}

export async function publishLawIndexVersion(versionId: string) {
  return action(async () => {
    const { ctx } = await superadmin()
    await withUser(ctx, (tx) => publishVersion(tx, z.string().uuid().parse(versionId)))
    revalidatePath('/admin/indice')
  })
}

export async function listVersions() {
  const { ctx } = await superadmin()
  return withUser(ctx, async (tx) =>
    tx.query.lawIndexVersions.findMany({
      with: { state: true, nodes: { columns: { id: true, subjectTypeId: true } } },
      orderBy: (v, { desc }) => [desc(v.createdAt)],
    }),
  )
}

export async function assignSupervisor(rawEmail: string, municipalityIds: string[]) {
  return action(async () => {
    const { ctx } = await superadmin()
    const email = z.string().email().parse(rawEmail.trim().toLowerCase())
    const ids = z.array(z.string().uuid()).parse(municipalityIds)
    await withUser(ctx, async (tx) => {
      const u = await tx.query.user.findFirst({ where: eq(userTable.email, email) })
      if (!u)
        throw new UserFacingError(
          'No existe un usuario con ese correo. Primero debe aceptar una invitación en algún municipio (o crea su cuenta invitándolo).',
        )
      const all = await tx.query.municipalities.findMany({
        columns: { id: true, organizationId: true },
      })
      for (const m of all) {
        const exists = await tx.query.member.findFirst({
          where: and(eq(member.userId, u.id), eq(member.organizationId, m.organizationId)),
        })
        if (ids.includes(m.id)) {
          if (!exists)
            await tx.insert(member).values({
              id: `mem_${u.id.slice(0, 8)}_${m.id.slice(0, 8)}`,
              organizationId: m.organizationId,
              userId: u.id,
              role: 'supervisor',
              createdAt: new Date(),
            })
          else if (exists.role !== 'supervisor')
            await tx.update(member).set({ role: 'supervisor' }).where(eq(member.id, exists.id))
        } else if (exists?.role === 'supervisor') {
          await tx.delete(member).where(eq(member.id, exists.id))
        }
      }
    })
    revalidatePath('/admin/supervisores')
  })
}

export async function listSupervisors() {
  const { ctx } = await superadmin()
  return withUser(ctx, async (tx) => {
    const rows = await tx
      .select({
        userId: userTable.id,
        name: userTable.name,
        email: userTable.email,
        municipalityId: municipalities.id,
        municipality: municipalities.name,
      })
      .from(member)
      .innerJoin(userTable, eq(userTable.id, member.userId))
      .innerJoin(municipalities, eq(municipalities.organizationId, member.organizationId))
      .where(eq(member.role, 'supervisor'))
    const byUser = new Map<
      string,
      { name: string; email: string; municipalities: { id: string; name: string }[] }
    >()
    for (const f of rows) {
      const e = byUser.get(f.userId) ?? { name: f.name, email: f.email, municipalities: [] }
      e.municipalities.push({ id: f.municipalityId, name: f.municipality })
      byUser.set(f.userId, e)
    }
    return [...byUser.values()]
  })
}

export async function toggleMunicipalityPanel(municipalityId: string, suspend: boolean) {
  return action(async () => {
    const { ctx } = await superadmin()
    await withUser(ctx, (tx) =>
      tx
        .update(municipalities)
        .set({ status: suspend ? 'panel_suspended' : 'active' })
        .where(eq(municipalities.id, z.string().uuid().parse(municipalityId))),
    )
    revalidatePath('/admin')
  })
}

export const _types = async () => {
  const { ctx } = await superadmin()
  return withUser(ctx, (tx) => tx.query.obligatedSubjectTypes.findMany())
}
void lawIndexVersions
