/**
 * Cliente de base de datos. NO lo importes desde las apps: usa `withUser` / `asPublic` (./index.ts).
 * Local: postgres.js contra Docker. Producción: driver de Neon (Pool por WebSocket, necesario para SET LOCAL).
 */
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless'
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core'
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

export type Driver = 'postgres' | 'neon'
export type Schema = typeof schema
/** Tipo común a ambos drivers (postgres.js y Neon). */
export type Db = PgDatabase<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>
export type Tx = PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>

export type ClientOptions = {
  url: string
  driver?: Driver
  /** Conexiones máximas del pool (serverless: pocas). */
  max?: number
}

export function createClient({ url, driver = 'postgres', max = 10 }: ClientOptions): Db {
  if (driver === 'neon') {
    // import dinámico evitado a propósito: Next necesita resolverlo estáticamente
    return drizzleNeon({ connection: { connectionString: url, max }, schema, casing: 'snake_case' })
  }
  return drizzlePostgres({
    connection: { url, max, onnotice: () => {} },
    schema,
    casing: 'snake_case',
  })
}

function readDriver(): Driver {
  const d = process.env.DATABASE_DRIVER
  return d === 'neon' ? 'neon' : 'postgres'
}

let _panel: Db | undefined
let _public: Db | undefined
let _migrator: Db | undefined

/** Rol `app_panel`: lectura y escritura sujeta a RLS. */
export function dbPanel(): Db {
  _panel ??= createClient({ url: requireEnv('DATABASE_URL'), driver: readDriver() })
  return _panel
}

/** Rol `public_reader`: solo lectura de datos publicados. */
export function dbPublic(): Db {
  _public ??= createClient({ url: requireEnv('DATABASE_URL_PUBLIC'), driver: readDriver(), max: 3 })
  return _public
}

/** Rol `migraciones`: solo scripts (seed, migración de Tuxcacuesco, pruebas). */
export function dbMigrator(): Db {
  _migrator ??= createClient({
    url: requireEnv('DATABASE_URL_MIGRATIONS'),
    driver: 'postgres',
    max: 4,
  })
  return _migrator
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Falta la variable de entorno ${name}`)
  return v
}
