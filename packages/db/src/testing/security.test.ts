import { and, eq, inArray, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asPublic, withUser } from '../with-user'
import * as s from '../schema'
import { close, testClient, failsWith, suffix } from '.'

const migrator = testClient('migrator')
const panel = testClient('app_panel')
const publicDb = testClient('public_reader')

const SUPER = { userId: 'u-super', role: 'superadmin' as const, allowedMunicipalities: [] }

let stateId: string
let typeId: string
let versionId: string
let nodeId: string
let municipalityA: string
let municipalityB: string
let subjectB: string
let docA: string
let docB: string

async function createMunicipality(tx: Parameters<Parameters<typeof withUser>[1]>[0], slug: string) {
  const [org] = await tx
    .insert(s.organization)
    .values({ id: `org-${slug}`, name: slug, slug, createdAt: new Date() })
    .returning()
  const [m] = await tx
    .insert(s.municipalities)
    .values({
      stateId,
      organizationId: org!.id,
      slug,
      name: slug,
      officialName: `H. Ayuntamiento de ${slug}`,
    })
    .returning()
  const [so] = await tx
    .insert(s.obligatedSubjects)
    .values({ municipalityId: m!.id, subjectTypeId: typeId, name: 'Ayuntamiento', prefix: '' })
    .returning()
  const [doc] = await tx
    .insert(s.documents)
    .values({
      id: `doc-${slug}-${suffix()}`,
      municipalityId: m!.id,
      obligatedSubjectId: so!.id,
      nodeId,
      name: `Documento de ${slug}`,
      createdBy: null,
    })
    .returning()
  return { municipalityId: m!.id, subjectId: so!.id, docId: doc!.id }
}

const x = suffix()

beforeAll(async () => {
  await withUser(
    SUPER,
    async (tx) => {
      const [e] = await tx
        .insert(s.states)
        .values({ key: `T${x}`, name: `Estado ${x}` })
        .returning()
      stateId = e!.id
      const [t] = await tx
        .insert(s.obligatedSubjectTypes)
        .values({ slug: `ayto-${x}`, name: 'Ayuntamiento' })
        .returning()
      typeId = t!.id
      const [v] = await tx
        .insert(s.lawIndexVersions)
        .values({
          stateId,
          slug: `v-${x}`,
          name: 'Prueba',
          storageFolder: `v-${x}`,
          status: 'draft',
        })
        .returning()
      versionId = v!.id
      const [n] = await tx
        .insert(s.lawIndexNodes)
        .values({
          versionId,
          subjectTypeId: typeId,
          level: 'article',
          number: '8',
          label: 'Art. 8',
          title: 'Prueba',
          key: '8',
          frequency: 'permanent',
          storageFolder: 'art-08',
        })
        .returning()
      nodeId = n!.id
      const a = await createMunicipality(tx, `a-${x}`)
      const b = await createMunicipality(tx, `b-${x}`)
      municipalityA = a.municipalityId
      municipalityB = b.municipalityId
      subjectB = b.subjectId
      docA = a.docId
      docB = b.docId
    },
    migrator,
  )
})

afterAll(async () => {
  // limpiar los municipios de prueba para no ensuciar el panel local (la bitácora se conserva: es inmutable)
  await withUser(
    SUPER,
    async (tx) => {
      for (const id of [municipalityA, municipalityB]) {
        await tx.delete(s.documents).where(eq(s.documents.municipalityId, id))
        await tx.delete(s.obligatedSubjects).where(eq(s.obligatedSubjects.municipalityId, id))
        await tx.delete(s.municipalities).where(eq(s.municipalities.id, id))
      }
      await tx
        .delete(s.organization)
        .where(inArray(s.organization.id, [`org-a-${x}`, `org-b-${x}`]))
    },
    migrator,
  )
  await Promise.all([close(migrator), close(panel), close(publicDb)])
})

describe('bitácora por triggers', () => {
  it('rechaza escrituras sin usuario en la sesión, incluso para el dueño de las tablas', async () => {
    await failsWith(
      migrator.transaction(async (tx) => {
        await tx.insert(s.states).values({ key: `X${suffix()}`, name: 'sin contexto' })
        // estados no tiene trigger; probamos con una tabla vigilada:
        await tx.update(s.documents).set({ name: 'cambio ilegal' }).where(eq(s.documents.id, docA))
      }),
      /sin usuario en la sesión/,
    )
  })

  it('registra quién hizo qué, con antes y después', async () => {
    await withUser(
      { userId: 'u-capturista', role: 'uploader', allowedMunicipalities: [municipalityA] },
      async (tx) => {
        await tx.update(s.documents).set({ name: 'Nombre nuevo' }).where(eq(s.documents.id, docA))
      },
      panel,
    )
    const rows = await migrator
      .select()
      .from(s.auditLog)
      .where(and(eq(s.auditLog.entityId, docA), eq(s.auditLog.action, 'rename')))
    expect(rows).toHaveLength(1)
    const f = rows[0]!
    expect(f.actorId).toBe('u-capturista')
    expect(f.actorRole).toBe('uploader')
    expect(f.municipalityId).toBe(municipalityA)
    expect(f.changes?.name?.before).toMatch(/Documento de/)
    expect(f.changes?.name?.after).toBe('Nombre nuevo')
  })

  it('deriva la acción semántica (papelera → restaurar)', async () => {
    const ctx = {
      userId: 'u-admin',
      role: 'municipal_admin' as const,
      allowedMunicipalities: [municipalityA],
    }
    await withUser(
      ctx,
      (tx) => tx.update(s.documents).set({ status: 'trash' }).where(eq(s.documents.id, docA)),
      panel,
    )
    await withUser(
      ctx,
      (tx) => tx.update(s.documents).set({ status: 'published' }).where(eq(s.documents.id, docA)),
      panel,
    )
    const actions = (
      await migrator
        .select({ action: s.auditLog.action })
        .from(s.auditLog)
        .where(eq(s.auditLog.entityId, docA))
        .orderBy(s.auditLog.id)
    ).map((r) => r.action)
    expect(actions).toEqual(['create', 'rename', 'trash', 'restore'])
  })

  it('no registra actualizaciones sin cambios reales', async () => {
    const before = await migrator
      .select({ n: sql<number>`count(*)::int` })
      .from(s.auditLog)
      .where(eq(s.auditLog.entityId, docA))
    await withUser(
      SUPER,
      (tx) => tx.update(s.documents).set({ status: 'published' }).where(eq(s.documents.id, docA)),
      panel,
    )
    const after = await migrator
      .select({ n: sql<number>`count(*)::int` })
      .from(s.auditLog)
      .where(eq(s.auditLog.entityId, docA))
    expect(after[0]!.n).toBe(before[0]!.n)
  })

  it('nadie puede modificar ni borrar la bitácora', async () => {
    await failsWith(
      migrator.update(s.auditLog).set({ action: 'x' }).where(eq(s.auditLog.entityId, docA)),
      /solo escritura/,
    )
    await failsWith(
      migrator.delete(s.auditLog).where(eq(s.auditLog.entityId, docA)),
      /solo escritura/,
    )
    await failsWith(migrator.execute(sql`TRUNCATE audit_log`), /solo escritura/)
    await failsWith(
      panel.delete(s.auditLog).where(eq(s.auditLog.entityId, docA)),
      /permission denied|solo escritura/,
    )
    await failsWith(
      panel
        .insert(s.auditLog)
        .values({ actorId: 'x', entity: 'document', entityId: 'y', action: 'create' }),
      /permission denied/,
    )
  })
})

describe('RLS por municipio (rol app_panel)', () => {
  const ofA = {
    userId: 'u-a',
    role: 'municipal_admin' as const,
    allowedMunicipalities: [] as string[],
  }

  it('un usuario del municipio A solo ve documentos de A', async () => {
    const ids = await withUser(
      { ...ofA, allowedMunicipalities: [municipalityA] },
      (tx) => tx.select({ id: s.documents.id }).from(s.documents),
      panel,
    )
    expect(ids.map((r) => r.id)).toContain(docA)
    expect(ids.map((r) => r.id)).not.toContain(docB)
  })

  it('no puede modificar documentos de B (0 filas afectadas)', async () => {
    const r = await withUser(
      { ...ofA, allowedMunicipalities: [municipalityA] },
      (tx) =>
        tx
          .update(s.documents)
          .set({ name: 'hackeado' })
          .where(eq(s.documents.id, docB))
          .returning({ id: s.documents.id }),
      panel,
    )
    expect(r).toHaveLength(0)
  })

  it('no puede insertar documentos en B', async () => {
    await failsWith(
      withUser(
        { ...ofA, allowedMunicipalities: [municipalityA] },
        (tx) =>
          tx.insert(s.documents).values({
            id: `doc-x-${suffix()}`,
            municipalityId: municipalityB,
            obligatedSubjectId: subjectB,
            nodeId,
            name: 'intruso',
          }),
        panel,
      ),
      /row-level security/,
    )
  })

  it('un supervisor con A y B ve ambos; con solo B no ve A', async () => {
    const both = await withUser(
      {
        userId: 'u-sup',
        role: 'supervisor',
        allowedMunicipalities: [municipalityA, municipalityB],
      },
      (tx) => tx.select({ id: s.documents.id }).from(s.documents),
      panel,
    )
    expect(both.map((r) => r.id)).toEqual(expect.arrayContaining([docA, docB]))
    const onlyB = await withUser(
      { userId: 'u-sup', role: 'supervisor', allowedMunicipalities: [municipalityB] },
      (tx) => tx.select({ id: s.documents.id }).from(s.documents),
      panel,
    )
    expect(onlyB.map((r) => r.id)).not.toContain(docA)
  })

  it('el superadmin ve todo', async () => {
    const ids = await withUser(
      SUPER,
      (tx) => tx.select({ id: s.documents.id }).from(s.documents),
      panel,
    )
    expect(ids.map((r) => r.id)).toEqual(expect.arrayContaining([docA, docB]))
  })

  it('sin contexto, app_panel no ve nada', async () => {
    const ids = await panel.select({ id: s.documents.id }).from(s.documents)
    expect(ids).toHaveLength(0)
  })

  it('solo el superadmin puede dar de alta municipios', async () => {
    await failsWith(
      withUser(
        { ...ofA, allowedMunicipalities: [municipalityA] },
        async (tx) => {
          const x = suffix()
          await tx
            .insert(s.organization)
            .values({ id: `org-z-${x}`, name: 'z', slug: `z-${x}`, createdAt: new Date() })
          await tx.insert(s.municipalities).values({
            stateId,
            organizationId: `org-z-${x}`,
            slug: `z-${x}`,
            name: 'z',
            officialName: 'z',
          })
        },
        panel,
      ),
      /row-level security/,
    )
  })
})

describe('sitio público (rol public_reader)', () => {
  it('solo ve lo de su municipio y no lo que no está publicado', async () => {
    await withUser(
      SUPER,
      (tx) => tx.update(s.documents).set({ status: 'hidden' }).where(eq(s.documents.id, docB)),
      panel,
    )
    const ofA = await asPublic(
      municipalityA,
      (tx) => tx.select({ id: s.documents.id, status: s.documents.status }).from(s.documents),
      publicDb,
    )
    expect(ofA.map((r) => r.id)).toContain(docA)
    expect(ofA.map((r) => r.id)).not.toContain(docB)
    const ofB = await asPublic(
      municipalityB,
      (tx) => tx.select({ id: s.documents.id, status: s.documents.status }).from(s.documents),
      publicDb,
    )
    // ve la fila (para la página "documento retirado" de /d/<id>) pero sabe que no está publicada
    expect(ofB.find((r) => r.id === docB)?.status).toBe('hidden')
    expect(ofB.map((r) => r.id)).not.toContain(docA)
  })

  it('no puede escribir nada', async () => {
    await failsWith(
      asPublic(
        municipalityA,
        (tx) => tx.update(s.documents).set({ name: 'x' }).where(eq(s.documents.id, docA)),
        publicDb,
      ),
      /permission denied/,
    )
  })

  it('sin contexto no ve nada', async () => {
    const r = await publicDb.select({ id: s.documents.id }).from(s.documents)
    expect(r).toHaveLength(0)
  })
})
