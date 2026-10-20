import 'server-only'
import {
  and,
  bitacora,
  conUsuario,
  configuracion,
  eq,
  gte,
  inArray,
  sql,
  user as tablaUser,
  type ContextoUsuario,
} from '@plataforma/db'
import { enviarCorreo } from './correo'
import { env } from './env'

export type UmbralesAlertas = { ventanaMinutos: number; eliminacionesMaximas: number }
export const UMBRALES_DEFAULT: UmbralesAlertas = { ventanaMinutos: 10, eliminacionesMaximas: 20 }

const ACCIONES_SENSIBLES = [
  'papelera',
  'reemplazar',
  'eliminar',
  'ocultar',
  'historico',
  'dar_de_baja',
]

/**
 * Detecta comportamiento anómalo en la bitácora (muchas eliminaciones o reemplazos en poco tiempo, por actor)
 * y avisa a los superadministradores. Evita repetir el mismo aviso guardando la última alerta por actor.
 */
export async function revisarAlertas(ctx: ContextoUsuario): Promise<{ alertas: number }> {
  return conUsuario(ctx, async (tx) => {
    const cfg = await tx.query.configuracion.findFirst({
      where: eq(configuracion.clave, 'alertas.umbrales'),
    })
    const umbrales = {
      ...UMBRALES_DEFAULT,
      ...((cfg?.valor as Partial<UmbralesAlertas> | undefined) ?? {}),
    }
    const desde = new Date(Date.now() - umbrales.ventanaMinutos * 60_000)
    const sospechosos = await tx
      .select({
        actorId: bitacora.actorId,
        municipioId: bitacora.municipioId,
        n: sql<number>`count(*)::int`,
      })
      .from(bitacora)
      .where(and(gte(bitacora.ocurridoEn, desde), inArray(bitacora.accion, ACCIONES_SENSIBLES)))
      .groupBy(bitacora.actorId, bitacora.municipioId)
    const graves = sospechosos.filter(
      (s) => s.n >= umbrales.eliminacionesMaximas && !s.actorId.startsWith('sistema:'),
    )
    if (graves.length === 0) return { alertas: 0 }

    const previas = await tx.query.configuracion.findFirst({
      where: eq(configuracion.clave, 'alertas.enviadas'),
    })
    const enviadas = (previas?.valor as Record<string, string> | undefined) ?? {}
    const nuevas: typeof graves = []
    for (const g of graves) {
      const clave = `${g.actorId}:${g.municipioId ?? '-'}`
      const ultima = enviadas[clave] ? new Date(enviadas[clave]) : null
      if (ultima && Date.now() - ultima.getTime() < umbrales.ventanaMinutos * 60_000 * 3) continue
      enviadas[clave] = new Date().toISOString()
      nuevas.push(g)
    }
    if (nuevas.length === 0) return { alertas: 0 }
    await tx
      .insert(configuracion)
      .values({ clave: 'alertas.enviadas', valor: enviadas })
      .onConflictDoUpdate({
        target: configuracion.clave,
        set: { valor: enviadas, actualizadaEn: new Date() },
      })

    const superadmins = await tx.query.user.findMany({
      where: sql`${tablaUser.role} ILIKE '%superadmin%'`,
      columns: { email: true, name: true },
    })
    const actores = await tx.query.user.findMany({
      where: inArray(
        tablaUser.id,
        nuevas.map((n) => n.actorId),
      ),
      columns: { id: true, email: true, name: true },
    })
    const lineas = nuevas.map((n) => {
      const a = actores.find((x) => x.id === n.actorId)
      return `• ${a ? `${a.name} (${a.email})` : n.actorId}: ${n.n} eliminaciones/reemplazos en ${umbrales.ventanaMinutos} minutos${n.municipioId ? ` · municipio ${n.municipioId}` : ''}`
    })
    for (const s of superadmins) {
      await enviarCorreo({
        para: s.email,
        asunto: `⚠ Actividad inusual en ${env.NEXT_PUBLIC_PLATFORM_NAME}`,
        html: `<p>Se detectó actividad inusual (umbral: ${umbrales.eliminacionesMaximas} en ${umbrales.ventanaMinutos} min):</p><ul>${lineas.map((l) => `<li>${l.slice(2)}</li>`).join('')}</ul><p>Revisa la bitácora del municipio. Si es una cuenta robada, dala de baja desde Usuarios: pierde el acceso al instante y nada se ha borrado de verdad (papelera y versiones).</p>`,
        texto: `Actividad inusual:\n${lineas.join('\n')}\nRevisa la bitácora del municipio.`,
      })
    }
    return { alertas: nuevas.length }
  })
}
