import { eq } from 'drizzle-orm'
import type { Tx } from '../cliente'
import * as s from '../schema'

/** Encola etiquetas de caché a invalidar en la app del municipio (outbox; se procesa tras la transacción). */
export async function encolarRevalidacion(tx: Tx, municipioId: string, etiquetas: string[]) {
  if (etiquetas.length === 0) return
  await tx
    .insert(s.revalidacionesPendientes)
    .values({ municipioId, etiquetas: [...new Set(etiquetas)] })
}

export async function revalidacionesPendientesDe(tx: Tx, municipioId: string) {
  return tx.query.revalidacionesPendientes.findMany({
    where: eq(s.revalidacionesPendientes.municipioId, municipioId),
  })
}
