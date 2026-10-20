import 'server-only'
import { withUser, eq, pendingRevalidations as table, type UserContext } from '@platform/db'
import { pendingRevalidationsOf } from '@platform/db/queries/revalidation'
import { env } from './env'

/**
 * Procesa la cola de revalidación de un municipio: agrupa etiquetas, llama al endpoint protegido de su app
 * y borra las filas que se confirmaron. Si falla, las filas quedan para el reintento del cron.
 */
export async function processRevalidations(
  ctx: UserContext,
  municipality: { id: string; slug: string; revalidationUrl: string | null },
) {
  if (!municipality.revalidationUrl) return
  const secrets = JSON.parse(env.REVALIDATION_SECRETS) as Record<string, string>
  const secret = secrets[municipality.slug]
  if (!secret) {
    console.warn(`Sin secreto de revalidación para ${municipality.slug}`)
    return
  }
  await withUser({ ...ctx, origin: 'cron' }, async (tx) => {
    const pendingItems = await pendingRevalidationsOf(tx, municipality.id)
    if (pendingItems.length === 0) return
    const tags = [...new Set(pendingItems.flatMap((p) => p.tags))]
    try {
      const r = await fetch(municipality.revalidationUrl!, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
        body: JSON.stringify({ tags }),
        signal: AbortSignal.timeout(5000),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      for (const p of pendingItems) await tx.delete(table).where(eq(table.id, p.id))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      for (const p of pendingItems)
        await tx
          .update(table)
          .set({ attempts: p.attempts + 1, lastError: msg })
          .where(eq(table.id, p.id))
    }
  })
}
