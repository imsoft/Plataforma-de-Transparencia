import { crearAuth, ROLES_CON_2FA_OBLIGATORIA } from '@plataforma/auth'
import { symmetricEncrypt } from 'better-auth/crypto'
import { and, comoSistema, eq, type Tx } from '@plataforma/db'
import { dbMigraciones } from '@plataforma/db/cliente'
import * as s from '@plataforma/db/schema'
import { cargarIndice, publicarVersion } from '@plataforma/indice/cargar'
import { ESTADO, MUNICIPIO_DEMO, REDES_DEMO, TIPOS_SUJETO, USUARIOS } from './datos'

const ACTOR = 'sistema:semilla'
/** Mismo valor que e2e/recursos/totp.ts. Solo para desarrollo local. */
const SECRETO_2FA_LOCAL = 'secreto-totp-de-pruebas-locales-32'

export async function sembrar({ indices }: { indices: unknown[] }) {
  // 1. Catálogos e índice
  await comoSistema(
    ACTOR,
    async (tx) => {
      await tx.insert(s.estados).values(ESTADO).onConflictDoNothing()
      await tx.insert(s.tiposSujetoObligado).values(TIPOS_SUJETO).onConflictDoNothing()
      let versionId: string | undefined
      for (const archivo of indices) {
        const r = await cargarIndice(tx, archivo)
        versionId = r.versionId
        console.info(
          `   índice ${(archivo as { tipoSujetoObligado: string }).tipoSujetoObligado}: +${r.creados} ~${r.actualizados} -${r.desactivados}`,
        )
      }
      if (versionId) {
        const v = await tx.query.indiceVersiones.findFirst({
          where: eq(s.indiceVersiones.id, versionId),
        })
        if (v?.estatus === 'borrador') await publicarVersion(tx, versionId)
      }
    },
    'generador',
  )

  // 2. Usuarios (Better Auth crea user + account con la contraseña hasheada)
  const auth = crearAuth({ enviarCorreo: async () => {} })
  const usuariosCreados: {
    id: string
    email: string
    rol: (typeof USUARIOS)[number]['rol']
    password: string
  }[] = []
  for (const u of USUARIOS) {
    const existente = await dbMigraciones().query.user.findFirst({
      where: eq(s.user.email, u.email),
    })
    let id = existente?.id
    if (!id) {
      const r = await auth.api.signUpEmail({
        body: { email: u.email, password: u.password, name: u.name, cargo: u.cargo ?? '' },
      })
      id = r.user.id
    }
    usuariosCreados.push({ id, email: u.email, rol: u.rol, password: u.password })
  }

  // 3. Municipio demo, membresías, redes
  const municipioId = await comoSistema(
    ACTOR,
    async (tx) => {
      const superadmin = usuariosCreados.find((u) => u.rol === 'superadmin')!
      await tx
        .update(s.user)
        .set({ role: 'superadmin', emailVerified: true })
        .where(eq(s.user.id, superadmin.id))
      await tx.update(s.user).set({ emailVerified: true }).where(eq(s.user.emailVerified, false))
      // 2FA ya configurada (secreto conocido, SOLO local) para los roles que la exigen; así las pruebas pueden entrar
      const claveCifrado = process.env.BETTER_AUTH_SECRET ?? ''
      for (const u of usuariosCreados) {
        if (!(ROLES_CON_2FA_OBLIGATORIA as readonly string[]).includes(u.rol)) continue
        const ya = await tx.query.twoFactor.findFirst({ where: eq(s.twoFactor.userId, u.id) })
        if (ya) continue
        await tx.insert(s.twoFactor).values({
          id: `2fa_${u.rol}`,
          userId: u.id,
          secret: await symmetricEncrypt({ key: claveCifrado, data: SECRETO_2FA_LOCAL }),
          backupCodes: await symmetricEncrypt({
            key: claveCifrado,
            data: JSON.stringify(['respaldo-local-1', 'respaldo-local-2']),
          }),
          verified: true,
        })
        await tx.update(s.user).set({ twoFactorEnabled: true }).where(eq(s.user.id, u.id))
      }

      const estado = (await tx.query.estados.findFirst({
        where: eq(s.estados.clave, ESTADO.clave),
      }))!
      const orgId = `org_${MUNICIPIO_DEMO.slug}`
      await tx
        .insert(s.organization)
        .values({
          id: orgId,
          name: MUNICIPIO_DEMO.nombre,
          slug: MUNICIPIO_DEMO.slug,
          createdAt: new Date(),
        })
        .onConflictDoNothing()
      const [m] = await tx
        .insert(s.municipios)
        .values({
          estadoId: estado.id,
          organizationId: orgId,
          slug: MUNICIPIO_DEMO.slug,
          nombre: MUNICIPIO_DEMO.nombre,
          nombreOficial: MUNICIPIO_DEMO.nombreOficial,
          urlRevalidacion: MUNICIPIO_DEMO.urlRevalidacion,
          datosContacto: MUNICIPIO_DEMO.datosContacto,
        })
        .onConflictDoUpdate({ target: s.municipios.slug, set: { nombre: MUNICIPIO_DEMO.nombre } })
        .returning()
      const municipioId = m!.id

      await tx
        .insert(s.municipioDominios)
        .values({ municipioId, host: MUNICIPIO_DEMO.dominio, principal: true })
        .onConflictDoNothing()
      await tx
        .insert(s.municipioDominios)
        .values({ municipioId, host: 'localhost:3001', principal: false })
        .onConflictDoNothing()
      await tx
        .insert(s.municipioTema)
        .values({ municipioId, ...MUNICIPIO_DEMO.tema })
        .onConflictDoNothing()

      for (const so of MUNICIPIO_DEMO.sujetosObligados) {
        const tipo = (await tx.query.tiposSujetoObligado.findFirst({
          where: eq(s.tiposSujetoObligado.slug, so.tipo),
        }))!
        await tx
          .insert(s.sujetosObligados)
          .values({ municipioId, tipoSujetoId: tipo.id, nombre: so.nombre, prefijo: so.prefijo })
          .onConflictDoNothing()
      }

      for (const u of usuariosCreados) {
        if (u.rol === 'superadmin') continue
        const ya = await tx.query.member.findFirst({
          where: and(eq(s.member.userId, u.id), eq(s.member.organizationId, orgId)),
        })
        if (!ya) {
          await tx.insert(s.member).values({
            id: `mem_${u.rol}_${MUNICIPIO_DEMO.slug}`,
            organizationId: orgId,
            userId: u.id,
            role: u.rol,
            createdAt: new Date(),
          })
        }
      }

      const redesExistentes = await tx.query.redesSociales.findMany({
        where: eq(s.redesSociales.municipioId, municipioId),
      })
      if (redesExistentes.length === 0) {
        await tx.insert(s.redesSociales).values(REDES_DEMO.map((r) => ({ municipioId, ...r })))
      }

      await sembrarDocumentosDemo(tx, municipioId)
      return municipioId
    },
    'generador',
  )

  return { municipio: `${MUNICIPIO_DEMO.nombre} (${municipioId})`, usuarios: usuariosCreados }
}

/** Documentos de muestra que no requieren archivo en el bucket (videos externos y leyenda). */
async function sembrarDocumentosDemo(tx: Tx, municipioId: string) {
  const ayto = (await tx.query.sujetosObligados.findFirst({
    where: and(eq(s.sujetosObligados.municipioId, municipioId), eq(s.sujetosObligados.prefijo, '')),
  }))!
  const actas = await tx.query.indiceNodos.findFirst({
    where: and(eq(s.indiceNodos.clave, '1511'), eq(s.indiceNodos.tipoSujetoId, ayto.tipoSujetoId)),
  })
  if (!actas) return
  const existentes = await tx.query.documentos.findMany({
    where: eq(s.documentos.nodoId, actas.id),
  })
  if (existentes.length > 0) return
  await tx.insert(s.documentos).values([
    {
      id: 'demo-sesion-01',
      municipioId,
      sujetoObligadoId: ayto.id,
      nodoId: actas.id,
      nombre: 'Sesión ordinaria de cabildo · marzo 2026 (video)',
      tipo: 'video_externo',
      urlExterna: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      periodoEtiqueta: 'Marzo 2026',
      periodoInicio: '2026-03-01',
      periodoFin: '2026-03-31',
      carpetaPeriodo: '2026-03',
      publicadoEn: new Date(),
    },
  ])
  await tx.insert(s.leyendasSinInformacion).values({
    municipioId,
    sujetoObligadoId: ayto.id,
    nodoId: actas.id,
    periodoEtiqueta: 'Febrero 2026',
    periodoInicio: '2026-02-01',
    periodoFin: '2026-02-28',
    texto:
      'Durante febrero de 2026 no se celebraron sesiones de cabildo, por lo que no se generó información.',
  })
}
