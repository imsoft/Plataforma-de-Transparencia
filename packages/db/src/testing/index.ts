/** Utilidades para pruebas contra el Postgres de Docker (o una rama de Neon en CI). */
import '../env'
import type { sql } from 'drizzle-orm'
import { createClient, type Db } from '../client'

export function testClient(role: 'migrator' | 'app_panel' | 'public_reader'): Db {
  const url =
    role === 'migrator'
      ? process.env.DATABASE_URL_MIGRATIONS
      : role === 'app_panel'
        ? process.env.DATABASE_URL
        : process.env.DATABASE_URL_PUBLIC
  if (!url) throw new Error(`Falta la URL de base de datos para el rol ${role}`)
  return createClient({ url, driver: 'postgres', max: 2 })
}

export async function close(db: Db) {
  const c = (db as { $client?: { end?: () => Promise<void> } }).$client
  await c?.end?.()
}

export const suffix = () => Math.random().toString(36).slice(2, 8)

/** Ejecuta SQL crudo en una transacción sin contexto de usuario (para probar que falla). */
export async function withoutContext<T>(db: Db, query: ReturnType<typeof sql>): Promise<T> {
  return db.transaction(async (tx) => (await tx.execute(query)) as T)
}

/** Mensaje real del error de Postgres (Drizzle lo envuelve en "Failed query: …" con el original en `cause`). */
export function errorMessage(e: unknown): string {
  const err = e as { message?: string; cause?: { message?: string } }
  return [err?.message, err?.cause?.message].filter(Boolean).join(' | ')
}

/** Espera que la promesa falle con un mensaje de Postgres que cumpla el patrón. */
export async function failsWith(p: Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await p
  } catch (e) {
    const m = errorMessage(e)
    if (!pattern.test(m)) throw new Error(`Falló, pero con otro mensaje: ${m}`, { cause: e })
    return
  }
  throw new Error(`Se esperaba un error que cumpliera ${pattern}`)
}
