import { createAuth, ROLES_REQUIRING_2FA } from '@platform/auth'
import { symmetricEncrypt } from 'better-auth/crypto'
import { and, asSystem, eq, type Tx } from '@platform/db'
import { dbMigrator } from '@platform/db/client'
import * as s from '@platform/db/schema'
import { loadLawIndex, publishVersion } from '@platform/law-index/load'
import { STATUS_LABEL, DEMO_MUNICIPALITY, DEMO_NETWORKS, SUBJECT_TYPES, USERS } from './data'

const ACTOR = 'sistema:semilla'
/** Mismo valor que e2e/fixtures/totp.ts. Solo para desarrollo local. */
const LOCAL_2FA_SECRET = 'secreto-totp-de-pruebas-locales-32'

export async function seed({ lawIndexes }: { lawIndexes: unknown[] }) {
  // 1. Catálogos e índice
  await asSystem(
    ACTOR,
    async (tx) => {
      await tx.insert(s.states).values(STATUS_LABEL).onConflictDoNothing()
      await tx.insert(s.obligatedSubjectTypes).values(SUBJECT_TYPES).onConflictDoNothing()
      let versionId: string | undefined
      for (const file of lawIndexes) {
        const r = await loadLawIndex(tx, file)
        versionId = r.versionId
        console.info(
          `   índice ${(file as { obligatedSubjectType: string }).obligatedSubjectType}: +${r.created} ~${r.updated} -${r.deactivated}`,
        )
      }
      if (versionId) {
        const v = await tx.query.lawIndexVersions.findFirst({
          where: eq(s.lawIndexVersions.id, versionId),
        })
        if (v?.status === 'draft') await publishVersion(tx, versionId)
      }
    },
    'generator',
  )

  // 2. Usuarios (Better Auth crea user + account con la contraseña hasheada)
  const auth = createAuth({ sendEmail: async () => {} })
  const createdUsers: {
    id: string
    email: string
    role: (typeof USERS)[number]['role']
    password: string
  }[] = []
  for (const u of USERS) {
    const existing = await dbMigrator().query.user.findFirst({
      where: eq(s.user.email, u.email),
    })
    let id = existing?.id
    if (!id) {
      const r = await auth.api.signUpEmail({
        body: { email: u.email, password: u.password, name: u.name, jobTitle: u.jobTitle ?? '' },
      })
      id = r.user.id
    }
    createdUsers.push({ id, email: u.email, role: u.role, password: u.password })
  }

  // 3. Municipio demo, membresías, redes
  const municipalityId = await asSystem(
    ACTOR,
    async (tx) => {
      const superadmin = createdUsers.find((u) => u.role === 'superadmin')!
      await tx
        .update(s.user)
        .set({ role: 'superadmin', emailVerified: true })
        .where(eq(s.user.id, superadmin.id))
      await tx.update(s.user).set({ emailVerified: true }).where(eq(s.user.emailVerified, false))
      // 2FA ya configurada (secreto conocido, SOLO local) para los roles que la exigen; así las pruebas pueden entrar
      const encryptionKey = process.env.BETTER_AUTH_SECRET ?? ''
      for (const u of createdUsers) {
        if (!(ROLES_REQUIRING_2FA as readonly string[]).includes(u.role)) continue
        const already = await tx.query.twoFactor.findFirst({ where: eq(s.twoFactor.userId, u.id) })
        if (already) continue
        await tx.insert(s.twoFactor).values({
          id: `2fa_${u.role}`,
          userId: u.id,
          secret: await symmetricEncrypt({ key: encryptionKey, data: LOCAL_2FA_SECRET }),
          backupCodes: await symmetricEncrypt({
            key: encryptionKey,
            data: JSON.stringify(['respaldo-local-1', 'respaldo-local-2']),
          }),
          verified: true,
        })
        await tx.update(s.user).set({ twoFactorEnabled: true }).where(eq(s.user.id, u.id))
      }

      const status = (await tx.query.states.findFirst({
        where: eq(s.states.key, STATUS_LABEL.key),
      }))!
      const orgId = `org_${DEMO_MUNICIPALITY.slug}`
      await tx
        .insert(s.organization)
        .values({
          id: orgId,
          name: DEMO_MUNICIPALITY.name,
          slug: DEMO_MUNICIPALITY.slug,
          createdAt: new Date(),
        })
        .onConflictDoNothing()
      const [m] = await tx
        .insert(s.municipalities)
        .values({
          stateId: status.id,
          organizationId: orgId,
          slug: DEMO_MUNICIPALITY.slug,
          name: DEMO_MUNICIPALITY.name,
          officialName: DEMO_MUNICIPALITY.officialName,
          revalidationUrl: DEMO_MUNICIPALITY.revalidationUrl,
          contactInfo: DEMO_MUNICIPALITY.contactInfo,
        })
        .onConflictDoUpdate({
          target: s.municipalities.slug,
          set: { name: DEMO_MUNICIPALITY.name },
        })
        .returning()
      const municipalityId = m!.id

      await tx
        .insert(s.municipalityDomains)
        .values({ municipalityId, host: DEMO_MUNICIPALITY.domain, isPrimary: true })
        .onConflictDoNothing()
      await tx
        .insert(s.municipalityDomains)
        .values({ municipalityId, host: 'localhost:3001', isPrimary: false })
        .onConflictDoNothing()
      await tx
        .insert(s.municipalityTheme)
        .values({ municipalityId, ...DEMO_MUNICIPALITY.theme })
        .onConflictDoNothing()

      for (const so of DEMO_MUNICIPALITY.obligatedSubjects) {
        const type = (await tx.query.obligatedSubjectTypes.findFirst({
          where: eq(s.obligatedSubjectTypes.slug, so.type),
        }))!
        await tx
          .insert(s.obligatedSubjects)
          .values({ municipalityId, subjectTypeId: type.id, name: so.name, prefix: so.prefix })
          .onConflictDoNothing()
      }

      for (const u of createdUsers) {
        if (u.role === 'superadmin') continue
        const already = await tx.query.member.findFirst({
          where: and(eq(s.member.userId, u.id), eq(s.member.organizationId, orgId)),
        })
        if (!already) {
          await tx.insert(s.member).values({
            id: `mem_${u.role}_${DEMO_MUNICIPALITY.slug}`,
            organizationId: orgId,
            userId: u.id,
            role: u.role,
            createdAt: new Date(),
          })
        }
      }

      const existingNetworks = await tx.query.socialNetworks.findMany({
        where: eq(s.socialNetworks.municipalityId, municipalityId),
      })
      if (existingNetworks.length === 0) {
        await tx
          .insert(s.socialNetworks)
          .values(DEMO_NETWORKS.map((r) => ({ municipalityId, ...r })))
      }

      await seedDemoDocuments(tx, municipalityId)
      return municipalityId
    },
    'generator',
  )

  return { municipality: `${DEMO_MUNICIPALITY.name} (${municipalityId})`, users: createdUsers }
}

/** Documentos de muestra que no requieren archivo en el bucket (videos externos y leyenda). */
async function seedDemoDocuments(tx: Tx, municipalityId: string) {
  const cityHallFlat = (await tx.query.obligatedSubjects.findFirst({
    where: and(
      eq(s.obligatedSubjects.municipalityId, municipalityId),
      eq(s.obligatedSubjects.prefix, ''),
    ),
  }))!
  const minutes = await tx.query.lawIndexNodes.findFirst({
    where: and(
      eq(s.lawIndexNodes.key, '1511'),
      eq(s.lawIndexNodes.subjectTypeId, cityHallFlat.subjectTypeId),
    ),
  })
  if (!minutes) return
  const existing = await tx.query.documents.findMany({
    where: eq(s.documents.nodeId, minutes.id),
  })
  if (existing.length > 0) return
  await tx.insert(s.documents).values([
    {
      id: 'demo-sesion-01',
      municipalityId,
      obligatedSubjectId: cityHallFlat.id,
      nodeId: minutes.id,
      name: 'Sesión ordinaria de cabildo · marzo 2026 (video)',
      type: 'external_video',
      externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      periodLabel: 'Marzo 2026',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      periodFolder: '2026-03',
      publishedAt: new Date(),
    },
  ])
  await tx.insert(s.noInformationNotices).values({
    municipalityId,
    obligatedSubjectId: cityHallFlat.id,
    nodeId: minutes.id,
    periodLabel: 'Febrero 2026',
    periodStart: '2026-02-01',
    periodEnd: '2026-02-28',
    text: 'Durante febrero de 2026 no se celebraron sesiones de cabildo, por lo que no se generó información.',
  })
}
