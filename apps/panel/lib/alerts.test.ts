import '@platform/db/env'
import {
  auditLog,
  asSystem,
  documents,
  eq,
  states,
  municipalities,
  organization,
  obligatedSubjects,
  obligatedSubjectTypes,
  user as userTable,
} from '@platform/db'
import { close, testClient, suffix } from '@platform/db/testing'
import { afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('./email', () => ({ sendEmail: vi.fn(async () => {}) }))
vi.mock('./env', () => ({ env: { NEXT_PUBLIC_PLATFORM_NAME: 'Prueba' } }))
vi.mock('server-only', () => ({}))

const { sendEmail } = await import('./email')
const { checkAlerts } = await import('./alerts')
const migrator = testClient('migrator')
afterAll(() => close(migrator))

describe('alertas de comportamiento anómalo', () => {
  it('avisa al superadmin cuando un actor manda muchos documentos a la papelera en poco tiempo, y no repite el aviso', async () => {
    const x = suffix()
    const actor = `u-sospechoso-${x}`
    const superEmail = `super-${x}@pruebas.test`
    await asSystem('tests', async (tx) => {
      // la prueba no depende de la semilla: crea su propio superadmin que recibirá el aviso
      await tx.insert(userTable).values({
        id: `u-super-${x}`,
        name: 'Super de prueba',
        email: superEmail,
        emailVerified: true,
        role: 'superadmin',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      const [e] = await tx
        .insert(states)
        .values({ key: `A${x}`.slice(0, 5), name: 'Estado' })
        .returning()
      const [t] = await tx
        .insert(obligatedSubjectTypes)
        .values({ slug: `t-${x}`, name: 'T' })
        .returning()
      await tx
        .insert(organization)
        .values({ id: `org-al-${x}`, name: x, slug: `al-${x}`, createdAt: new Date() })
      const [m] = await tx
        .insert(municipalities)
        .values({
          stateId: e!.id,
          organizationId: `org-al-${x}`,
          slug: `al-${x}`,
          name: x,
          officialName: x,
        })
        .returning()
      const [so] = await tx
        .insert(obligatedSubjects)
        .values({ municipalityId: m!.id, subjectTypeId: t!.id, name: 'A', prefix: '' })
        .returning()
      const [v] = await tx
        .insert((await import('@platform/db')).lawIndexVersions)
        .values({ stateId: e!.id, slug: `v-${x}`, name: 'v', storageFolder: `v-${x}` })
        .returning()
      const [n] = await tx
        .insert((await import('@platform/db')).lawIndexNodes)
        .values({
          versionId: v!.id,
          subjectTypeId: t!.id,
          level: 'article',
          number: '8',
          label: 'Art. 8',
          title: 'x',
          key: '8',
          frequency: 'permanent',
          storageFolder: 'art-08',
        })
        .returning()
      for (let i = 0; i < 25; i++)
        await tx.insert(documents).values({
          id: `al${x}${String(i).padStart(4, '0')}`,
          municipalityId: m!.id,
          obligatedSubjectId: so!.id,
          nodeId: n!.id,
          name: `d${i}`,
        })
    })
    // 25 envíos a papelera en segundos, como si fuera una cuenta robada
    await (
      await import('@platform/db')
    ).withUser(
      { userId: actor, role: 'uploader', allowedMunicipalities: [] },
      async (tx) => {
        await tx
          .update(documents)
          .set({ status: 'trash' })
          .where(
            eq(
              documents.municipalityId,
              (await tx.query.municipalities.findFirst({
                where: eq(municipalities.slug, `al-${x}`),
              }))!.id,
            ),
          )
      },
      migrator,
    )
    const rows = await migrator.select().from(auditLog).where(eq(auditLog.actorId, actor))
    expect(rows.length).toBe(25)

    const ctx = {
      userId: 'sistema:cron',
      role: 'superadmin' as const,
      allowedMunicipalities: [],
      origin: 'cron' as const,
    }
    const r1 = await checkAlerts(ctx)
    expect(r1.alerts).toBe(1)
    expect(vi.mocked(sendEmail).mock.calls.some(([c]) => c.to === superEmail)).toBe(true)
    const r2 = await checkAlerts(ctx)
    expect(r2.alerts).toBe(0) // no repite dentro de la ventana
  })
})
