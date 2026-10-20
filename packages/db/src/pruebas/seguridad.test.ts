import { and, eq, inArray, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { comoPublico, conUsuario } from '../con-usuario'
import * as s from '../schema'
import { cerrar, clienteDePruebas, fallaCon, sufijo } from './index'

const migraciones = clienteDePruebas('migraciones')
const panel = clienteDePruebas('app_panel')
const publico = clienteDePruebas('lector_publico')

const SUPER = { usuarioId: 'u-super', rol: 'superadmin' as const, municipiosPermitidos: [] }

let estadoId: string
let tipoId: string
let versionId: string
let nodoId: string
let muniA: string
let muniB: string
let soB: string
let docA: string
let docB: string

async function crearMunicipio(tx: Parameters<Parameters<typeof conUsuario>[1]>[0], slug: string) {
  const [org] = await tx
    .insert(s.organization)
    .values({ id: `org-${slug}`, name: slug, slug, createdAt: new Date() })
    .returning()
  const [m] = await tx
    .insert(s.municipios)
    .values({
      estadoId,
      organizationId: org!.id,
      slug,
      nombre: slug,
      nombreOficial: `H. Ayuntamiento de ${slug}`,
    })
    .returning()
  const [so] = await tx
    .insert(s.sujetosObligados)
    .values({ municipioId: m!.id, tipoSujetoId: tipoId, nombre: 'Ayuntamiento', prefijo: '' })
    .returning()
  const [doc] = await tx
    .insert(s.documentos)
    .values({
      id: `doc-${slug}-${sufijo()}`,
      municipioId: m!.id,
      sujetoObligadoId: so!.id,
      nodoId,
      nombre: `Documento de ${slug}`,
      creadoPor: null,
    })
    .returning()
  return { municipioId: m!.id, soId: so!.id, docId: doc!.id }
}

const x = sufijo()

beforeAll(async () => {
  await conUsuario(
    SUPER,
    async (tx) => {
      const [e] = await tx
        .insert(s.estados)
        .values({ clave: `T${x}`, nombre: `Estado ${x}` })
        .returning()
      estadoId = e!.id
      const [t] = await tx
        .insert(s.tiposSujetoObligado)
        .values({ slug: `ayto-${x}`, nombre: 'Ayuntamiento' })
        .returning()
      tipoId = t!.id
      const [v] = await tx
        .insert(s.indiceVersiones)
        .values({
          estadoId,
          slug: `v-${x}`,
          nombre: 'Prueba',
          carpetaR2: `v-${x}`,
          estatus: 'borrador',
        })
        .returning()
      versionId = v!.id
      const [n] = await tx
        .insert(s.indiceNodos)
        .values({
          versionId,
          tipoSujetoId: tipoId,
          nivel: 'articulo',
          numero: '8',
          etiqueta: 'Art. 8',
          titulo: 'Prueba',
          clave: '8',
          periodicidad: 'permanente',
          carpetaR2: 'art-08',
        })
        .returning()
      nodoId = n!.id
      const a = await crearMunicipio(tx, `a-${x}`)
      const b = await crearMunicipio(tx, `b-${x}`)
      muniA = a.municipioId
      muniB = b.municipioId
      soB = b.soId
      docA = a.docId
      docB = b.docId
    },
    migraciones,
  )
})

afterAll(async () => {
  // limpiar los municipios de prueba para no ensuciar el panel local (la bitácora se conserva: es inmutable)
  await conUsuario(
    SUPER,
    async (tx) => {
      for (const id of [muniA, muniB]) {
        await tx.delete(s.documentos).where(eq(s.documentos.municipioId, id))
        await tx.delete(s.sujetosObligados).where(eq(s.sujetosObligados.municipioId, id))
        await tx.delete(s.municipios).where(eq(s.municipios.id, id))
      }
      await tx
        .delete(s.organization)
        .where(inArray(s.organization.id, [`org-a-${x}`, `org-b-${x}`]))
    },
    migraciones,
  )
  await Promise.all([cerrar(migraciones), cerrar(panel), cerrar(publico)])
})

describe('bitácora por triggers', () => {
  it('rechaza escrituras sin usuario en la sesión, incluso para el dueño de las tablas', async () => {
    await fallaCon(
      migraciones.transaction(async (tx) => {
        await tx.insert(s.estados).values({ clave: `X${sufijo()}`, nombre: 'sin contexto' })
        // estados no tiene trigger; probamos con una tabla vigilada:
        await tx
          .update(s.documentos)
          .set({ nombre: 'cambio ilegal' })
          .where(eq(s.documentos.id, docA))
      }),
      /sin usuario en la sesión/,
    )
  })

  it('registra quién hizo qué, con antes y después', async () => {
    await conUsuario(
      { usuarioId: 'u-capturista', rol: 'capturista', municipiosPermitidos: [muniA] },
      async (tx) => {
        await tx
          .update(s.documentos)
          .set({ nombre: 'Nombre nuevo' })
          .where(eq(s.documentos.id, docA))
      },
      panel,
    )
    const filas = await migraciones
      .select()
      .from(s.bitacora)
      .where(and(eq(s.bitacora.entidadId, docA), eq(s.bitacora.accion, 'renombrar')))
    expect(filas).toHaveLength(1)
    const f = filas[0]!
    expect(f.actorId).toBe('u-capturista')
    expect(f.actorRol).toBe('capturista')
    expect(f.municipioId).toBe(muniA)
    expect(f.cambios?.nombre?.antes).toMatch(/Documento de/)
    expect(f.cambios?.nombre?.despues).toBe('Nombre nuevo')
  })

  it('deriva la acción semántica (papelera → restaurar)', async () => {
    const ctx = {
      usuarioId: 'u-admin',
      rol: 'admin_municipal' as const,
      municipiosPermitidos: [muniA],
    }
    await conUsuario(
      ctx,
      (tx) => tx.update(s.documentos).set({ estado: 'papelera' }).where(eq(s.documentos.id, docA)),
      panel,
    )
    await conUsuario(
      ctx,
      (tx) => tx.update(s.documentos).set({ estado: 'publicado' }).where(eq(s.documentos.id, docA)),
      panel,
    )
    const acciones = (
      await migraciones
        .select({ accion: s.bitacora.accion })
        .from(s.bitacora)
        .where(eq(s.bitacora.entidadId, docA))
        .orderBy(s.bitacora.id)
    ).map((r) => r.accion)
    expect(acciones).toEqual(['crear', 'renombrar', 'papelera', 'restaurar'])
  })

  it('no registra actualizaciones sin cambios reales', async () => {
    const antes = await migraciones
      .select({ n: sql<number>`count(*)::int` })
      .from(s.bitacora)
      .where(eq(s.bitacora.entidadId, docA))
    await conUsuario(
      SUPER,
      (tx) => tx.update(s.documentos).set({ estado: 'publicado' }).where(eq(s.documentos.id, docA)),
      panel,
    )
    const despues = await migraciones
      .select({ n: sql<number>`count(*)::int` })
      .from(s.bitacora)
      .where(eq(s.bitacora.entidadId, docA))
    expect(despues[0]!.n).toBe(antes[0]!.n)
  })

  it('nadie puede modificar ni borrar la bitácora', async () => {
    await fallaCon(
      migraciones.update(s.bitacora).set({ accion: 'x' }).where(eq(s.bitacora.entidadId, docA)),
      /solo escritura/,
    )
    await fallaCon(
      migraciones.delete(s.bitacora).where(eq(s.bitacora.entidadId, docA)),
      /solo escritura/,
    )
    await fallaCon(migraciones.execute(sql`TRUNCATE bitacora`), /solo escritura/)
    await fallaCon(
      panel.delete(s.bitacora).where(eq(s.bitacora.entidadId, docA)),
      /permission denied|solo escritura/,
    )
    await fallaCon(
      panel
        .insert(s.bitacora)
        .values({ actorId: 'x', entidad: 'documento', entidadId: 'y', accion: 'crear' }),
      /permission denied/,
    )
  })
})

describe('RLS por municipio (rol app_panel)', () => {
  const deA = {
    usuarioId: 'u-a',
    rol: 'admin_municipal' as const,
    municipiosPermitidos: [] as string[],
  }

  it('un usuario del municipio A solo ve documentos de A', async () => {
    const ids = await conUsuario(
      { ...deA, municipiosPermitidos: [muniA] },
      (tx) => tx.select({ id: s.documentos.id }).from(s.documentos),
      panel,
    )
    expect(ids.map((r) => r.id)).toContain(docA)
    expect(ids.map((r) => r.id)).not.toContain(docB)
  })

  it('no puede modificar documentos de B (0 filas afectadas)', async () => {
    const r = await conUsuario(
      { ...deA, municipiosPermitidos: [muniA] },
      (tx) =>
        tx
          .update(s.documentos)
          .set({ nombre: 'hackeado' })
          .where(eq(s.documentos.id, docB))
          .returning({ id: s.documentos.id }),
      panel,
    )
    expect(r).toHaveLength(0)
  })

  it('no puede insertar documentos en B', async () => {
    await fallaCon(
      conUsuario(
        { ...deA, municipiosPermitidos: [muniA] },
        (tx) =>
          tx.insert(s.documentos).values({
            id: `doc-x-${sufijo()}`,
            municipioId: muniB,
            sujetoObligadoId: soB,
            nodoId,
            nombre: 'intruso',
          }),
        panel,
      ),
      /row-level security/,
    )
  })

  it('un supervisor con A y B ve ambos; con solo B no ve A', async () => {
    const ambos = await conUsuario(
      { usuarioId: 'u-sup', rol: 'supervisor', municipiosPermitidos: [muniA, muniB] },
      (tx) => tx.select({ id: s.documentos.id }).from(s.documentos),
      panel,
    )
    expect(ambos.map((r) => r.id)).toEqual(expect.arrayContaining([docA, docB]))
    const soloB = await conUsuario(
      { usuarioId: 'u-sup', rol: 'supervisor', municipiosPermitidos: [muniB] },
      (tx) => tx.select({ id: s.documentos.id }).from(s.documentos),
      panel,
    )
    expect(soloB.map((r) => r.id)).not.toContain(docA)
  })

  it('el superadmin ve todo', async () => {
    const ids = await conUsuario(
      SUPER,
      (tx) => tx.select({ id: s.documentos.id }).from(s.documentos),
      panel,
    )
    expect(ids.map((r) => r.id)).toEqual(expect.arrayContaining([docA, docB]))
  })

  it('sin contexto, app_panel no ve nada', async () => {
    const ids = await panel.select({ id: s.documentos.id }).from(s.documentos)
    expect(ids).toHaveLength(0)
  })

  it('solo el superadmin puede dar de alta municipios', async () => {
    await fallaCon(
      conUsuario(
        { ...deA, municipiosPermitidos: [muniA] },
        async (tx) => {
          const x = sufijo()
          await tx
            .insert(s.organization)
            .values({ id: `org-z-${x}`, name: 'z', slug: `z-${x}`, createdAt: new Date() })
          await tx.insert(s.municipios).values({
            estadoId,
            organizationId: `org-z-${x}`,
            slug: `z-${x}`,
            nombre: 'z',
            nombreOficial: 'z',
          })
        },
        panel,
      ),
      /row-level security/,
    )
  })
})

describe('sitio público (rol lector_publico)', () => {
  it('solo ve lo de su municipio y no lo que no está publicado', async () => {
    await conUsuario(
      SUPER,
      (tx) => tx.update(s.documentos).set({ estado: 'oculto' }).where(eq(s.documentos.id, docB)),
      panel,
    )
    const deA = await comoPublico(
      muniA,
      (tx) => tx.select({ id: s.documentos.id, estado: s.documentos.estado }).from(s.documentos),
      publico,
    )
    expect(deA.map((r) => r.id)).toContain(docA)
    expect(deA.map((r) => r.id)).not.toContain(docB)
    const deB = await comoPublico(
      muniB,
      (tx) => tx.select({ id: s.documentos.id, estado: s.documentos.estado }).from(s.documentos),
      publico,
    )
    // ve la fila (para la página "documento retirado" de /d/<id>) pero sabe que no está publicada
    expect(deB.find((r) => r.id === docB)?.estado).toBe('oculto')
    expect(deB.map((r) => r.id)).not.toContain(docA)
  })

  it('no puede escribir nada', async () => {
    await fallaCon(
      comoPublico(
        muniA,
        (tx) => tx.update(s.documentos).set({ nombre: 'x' }).where(eq(s.documentos.id, docA)),
        publico,
      ),
      /permission denied/,
    )
  })

  it('sin contexto no ve nada', async () => {
    const r = await publico.select({ id: s.documentos.id }).from(s.documentos)
    expect(r).toHaveLength(0)
  })
})
