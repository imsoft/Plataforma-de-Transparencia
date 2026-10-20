import '@plataforma/db/env'
import {
  bitacora,
  comoSistema,
  documentos,
  eq,
  estados,
  municipios,
  organization,
  sujetosObligados,
  tiposSujetoObligado,
} from '@plataforma/db'
import { cerrar, clienteDePruebas, sufijo } from '@plataforma/db/pruebas'
import { afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('./correo', () => ({ enviarCorreo: vi.fn(async () => {}) }))
vi.mock('./env', () => ({ env: { NEXT_PUBLIC_PLATFORM_NAME: 'Prueba' } }))
vi.mock('server-only', () => ({}))

const { enviarCorreo } = await import('./correo')
const { revisarAlertas } = await import('./alertas')
const migraciones = clienteDePruebas('migraciones')
afterAll(() => cerrar(migraciones))

describe('alertas de comportamiento anómalo', () => {
  it('avisa al superadmin cuando un actor manda muchos documentos a la papelera en poco tiempo, y no repite el aviso', async () => {
    const x = sufijo()
    const actor = `u-sospechoso-${x}`
    const correoSuper = `super-${x}@pruebas.test`
    await comoSistema('pruebas', async (tx) => {
      // la prueba no depende de la semilla: crea su propio superadmin que recibirá el aviso
      await tx
        .insert(tablaUser)
        .values({
          id: `u-super-${x}`,
          name: 'Super de prueba',
          email: correoSuper,
          emailVerified: true,
          role: 'superadmin',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      const [e] = await tx
        .insert(estados)
        .values({ clave: `A${x}`.slice(0, 5), nombre: 'Estado' })
        .returning()
      const [t] = await tx
        .insert(tiposSujetoObligado)
        .values({ slug: `t-${x}`, nombre: 'T' })
        .returning()
      await tx
        .insert(organization)
        .values({ id: `org-al-${x}`, name: x, slug: `al-${x}`, createdAt: new Date() })
      const [m] = await tx
        .insert(municipios)
        .values({
          estadoId: e!.id,
          organizationId: `org-al-${x}`,
          slug: `al-${x}`,
          nombre: x,
          nombreOficial: x,
        })
        .returning()
      const [so] = await tx
        .insert(sujetosObligados)
        .values({ municipioId: m!.id, tipoSujetoId: t!.id, nombre: 'A', prefijo: '' })
        .returning()
      const [v] = await tx
        .insert((await import('@plataforma/db')).indiceVersiones)
        .values({ estadoId: e!.id, slug: `v-${x}`, nombre: 'v', carpetaR2: `v-${x}` })
        .returning()
      const [n] = await tx
        .insert((await import('@plataforma/db')).indiceNodos)
        .values({
          versionId: v!.id,
          tipoSujetoId: t!.id,
          nivel: 'articulo',
          numero: '8',
          etiqueta: 'Art. 8',
          titulo: 'x',
          clave: '8',
          periodicidad: 'permanente',
          carpetaR2: 'art-08',
        })
        .returning()
      for (let i = 0; i < 25; i++)
        await tx.insert(documentos).values({
          id: `al${x}${String(i).padStart(4, '0')}`,
          municipioId: m!.id,
          sujetoObligadoId: so!.id,
          nodoId: n!.id,
          nombre: `d${i}`,
        })
    })
    // 25 envíos a papelera en segundos, como si fuera una cuenta robada
    await (
      await import('@plataforma/db')
    ).conUsuario(
      { usuarioId: actor, rol: 'capturista', municipiosPermitidos: [] },
      async (tx) => {
        await tx
          .update(documentos)
          .set({ estado: 'papelera' })
          .where(
            eq(
              documentos.municipioId,
              (await tx.query.municipios.findFirst({ where: eq(municipios.slug, `al-${x}`) }))!.id,
            ),
          )
      },
      migraciones,
    )
    const filas = await migraciones.select().from(bitacora).where(eq(bitacora.actorId, actor))
    expect(filas.length).toBe(25)

    const ctx = {
      usuarioId: 'sistema:cron',
      rol: 'superadmin' as const,
      municipiosPermitidos: [],
      origen: 'cron' as const,
    }
    const r1 = await revisarAlertas(ctx)
    expect(r1.alertas).toBe(1)
    expect(vi.mocked(enviarCorreo).mock.calls.some(([c]) => c.para === correoSuper)).toBe(true)
    const r2 = await revisarAlertas(ctx)
    expect(r2.alertas).toBe(0) // no repite dentro de la ventana
  })
})
