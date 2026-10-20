/**
 * Cliente de base de datos. NO lo importes desde las apps: usa `conUsuario` / `comoPublico` (./index.ts).
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

export type OpcionesCliente = {
  url: string
  driver?: Driver
  /** Conexiones máximas del pool (serverless: pocas). */
  max?: number
}

export function crearCliente({ url, driver = 'postgres', max = 10 }: OpcionesCliente): Db {
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

function leerDriver(): Driver {
  const d = process.env.DATABASE_DRIVER
  return d === 'neon' ? 'neon' : 'postgres'
}

let _panel: Db | undefined
let _publico: Db | undefined
let _migraciones: Db | undefined

/** Rol `app_panel`: lectura y escritura sujeta a RLS. */
export function dbPanel(): Db {
  _panel ??= crearCliente({ url: requerir('DATABASE_URL'), driver: leerDriver() })
  return _panel
}

/** Rol `lector_publico`: solo lectura de datos publicados. */
export function dbPublico(): Db {
  _publico ??= crearCliente({ url: requerir('DATABASE_URL_PUBLICO'), driver: leerDriver(), max: 3 })
  return _publico
}

/** Rol `migraciones`: solo scripts (seed, migración de Tuxcacuesco, pruebas). */
export function dbMigraciones(): Db {
  _migraciones ??= crearCliente({
    url: requerir('DATABASE_URL_MIGRACIONES'),
    driver: 'postgres',
    max: 4,
  })
  return _migraciones
}

function requerir(nombre: string): string {
  const v = process.env[nombre]
  if (!v) throw new Error(`Falta la variable de entorno ${nombre}`)
  return v
}
