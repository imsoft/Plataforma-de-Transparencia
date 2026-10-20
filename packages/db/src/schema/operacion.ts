import { sql } from 'drizzle-orm'
import { bigint, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { estadoExportacionEnum } from './enums'
import { municipios } from './municipios'

export type CambioCampo = { antes: unknown; despues: unknown }

/**
 * Bitácora inmutable. La llenan triggers de Postgres (ver migración `bitacora`), nunca la app.
 * Sin UPDATE/DELETE para ningún rol de la aplicación.
 */
export const bitacora = pgTable(
  'bitacora',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    ocurridoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
    actorId: text().notNull(),
    actorRol: text(),
    municipioId: uuid(),
    entidad: text().notNull(),
    entidadId: text().notNull(),
    accion: text().notNull(),
    cambios: jsonb().$type<Record<string, CambioCampo>>(),
    origen: text().notNull().default('panel'),
  },
  (t) => [
    index('bitacora_municipio_fecha').on(t.municipioId, t.ocurridoEn),
    index('bitacora_actor_fecha').on(t.actorId, t.ocurridoEn),
    index('bitacora_entidad').on(t.entidad, t.entidadId, t.ocurridoEn),
  ],
)

export const exportaciones = pgTable('exportaciones', {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  municipioId: uuid()
    .notNull()
    .references(() => municipios.id),
  solicitanteId: text().notNull(),
  estado: estadoExportacionEnum().notNull().default('pendiente'),
  rutaR2: text('ruta_r2'),
  mensajeError: text(),
  creadaEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  terminadaEn: timestamp({ withTimezone: true }),
})

/** Outbox de invalidación de caché hacia la app del municipio. */
export const revalidacionesPendientes = pgTable(
  'revalidaciones_pendientes',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    municipioId: uuid()
      .notNull()
      .references(() => municipios.id, { onDelete: 'cascade' }),
    etiquetas: text().array().notNull(),
    intentos: integer().notNull().default(0),
    ultimoError: text(),
    creadaEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('revalidaciones_municipio').on(t.municipioId, t.creadaEn)],
)

/** Configuración global en pares clave/valor (umbrales del semáforo, límites de tamaño, etc.). */
export const configuracion = pgTable('configuracion', {
  clave: text().primaryKey(),
  valor: jsonb().notNull(),
  actualizadaEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
