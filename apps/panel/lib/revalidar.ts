import 'server-only'
import {
  conUsuario,
  eq,
  revalidacionesPendientes as tabla,
  type ContextoUsuario,
} from '@plataforma/db'
import { revalidacionesPendientesDe } from '@plataforma/db/consultas/revalidacion'
import { env } from './env'

/**
 * Procesa la cola de revalidación de un municipio: agrupa etiquetas, llama al endpoint protegido de su app
 * y borra las filas que se confirmaron. Si falla, las filas quedan para el reintento del cron.
 */
export async function procesarRevalidaciones(
  ctx: ContextoUsuario,
  municipio: { id: string; slug: string; urlRevalidacion: string | null },
) {
  if (!municipio.urlRevalidacion) return
  const secretos = JSON.parse(env.REVALIDACION_SECRETOS) as Record<string, string>
  const secreto = secretos[municipio.slug]
  if (!secreto) {
    console.warn(`Sin secreto de revalidación para ${municipio.slug}`)
    return
  }
  await conUsuario({ ...ctx, origen: 'cron' }, async (tx) => {
    const pendientes = await revalidacionesPendientesDe(tx, municipio.id)
    if (pendientes.length === 0) return
    const etiquetas = [...new Set(pendientes.flatMap((p) => p.etiquetas))]
    try {
      const r = await fetch(municipio.urlRevalidacion!, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${secreto}` },
        body: JSON.stringify({ etiquetas }),
        signal: AbortSignal.timeout(5000),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      for (const p of pendientes) await tx.delete(tabla).where(eq(tabla.id, p.id))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      for (const p of pendientes)
        await tx
          .update(tabla)
          .set({ intentos: p.intentos + 1, ultimoError: msg })
          .where(eq(tabla.id, p.id))
    }
  })
}
