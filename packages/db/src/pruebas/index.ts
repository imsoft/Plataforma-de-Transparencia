/** Utilidades para pruebas contra el Postgres de Docker (o una rama de Neon en CI). */
import '../env'
import type { sql } from 'drizzle-orm'
import { crearCliente, type Db } from '../cliente'

export function clienteDePruebas(rol: 'migraciones' | 'app_panel' | 'lector_publico'): Db {
  const url =
    rol === 'migraciones'
      ? process.env.DATABASE_URL_MIGRACIONES
      : rol === 'app_panel'
        ? process.env.DATABASE_URL
        : process.env.DATABASE_URL_PUBLICO
  if (!url) throw new Error(`Falta la URL de base de datos para el rol ${rol}`)
  return crearCliente({ url, driver: 'postgres', max: 2 })
}

export async function cerrar(db: Db) {
  const c = (db as { $client?: { end?: () => Promise<void> } }).$client
  await c?.end?.()
}

export const sufijo = () => Math.random().toString(36).slice(2, 8)

/** Ejecuta SQL crudo en una transacción sin contexto de usuario (para probar que falla). */
export async function sinContexto<T>(db: Db, consulta: ReturnType<typeof sql>): Promise<T> {
  return db.transaction(async (tx) => (await tx.execute(consulta)) as T)
}

/** Mensaje real del error de Postgres (Drizzle lo envuelve en "Failed query: …" con el original en `cause`). */
export function mensajeDeError(e: unknown): string {
  const err = e as { message?: string; cause?: { message?: string } }
  return [err?.message, err?.cause?.message].filter(Boolean).join(' | ')
}

/** Espera que la promesa falle con un mensaje de Postgres que cumpla el patrón. */
export async function fallaCon(p: Promise<unknown>, patron: RegExp): Promise<void> {
  try {
    await p
  } catch (e) {
    const m = mensajeDeError(e)
    if (!patron.test(m)) throw new Error(`Falló, pero con otro mensaje: ${m}`, { cause: e })
    return
  }
  throw new Error(`Se esperaba un error que cumpliera ${patron}`)
}
