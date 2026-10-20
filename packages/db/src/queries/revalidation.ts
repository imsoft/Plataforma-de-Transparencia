import { eq } from 'drizzle-orm'
import type { Tx } from '../client'
import * as s from '../schema'

/** Encola etiquetas de caché a invalidar en la app del municipio (outbox; se procesa tras la transacción). */
export async function enqueueRevalidation(tx: Tx, municipalityId: string, tags: string[]) {
  if (tags.length === 0) return
  await tx.insert(s.pendingRevalidations).values({ municipalityId, tags: [...new Set(tags)] })
}

export async function pendingRevalidationsOf(tx: Tx, municipalityId: string) {
  return tx.query.pendingRevalidations.findMany({
    where: eq(s.pendingRevalidations.municipalityId, municipalityId),
  })
}
