import { sql } from 'drizzle-orm'
import { bigint, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { exportStatusEnum } from './enums'
import { municipalities } from './municipalities'

export type FieldChange = { before: unknown; after: unknown }

/**
 * Bitácora inmutable. La llenan triggers de Postgres (ver migración `security`), nunca la app.
 * Sin UPDATE/DELETE para ningún rol de la aplicación.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    actorId: text().notNull(),
    actorRole: text(),
    municipalityId: uuid(),
    entity: text().notNull(),
    entityId: text().notNull(),
    action: text().notNull(),
    changes: jsonb().$type<Record<string, FieldChange>>(),
    origin: text().notNull().default('panel'),
  },
  (t) => [
    index('audit_log_municipality_date').on(t.municipalityId, t.occurredAt),
    index('audit_log_actor_date').on(t.actorId, t.occurredAt),
    index('audit_log_entity').on(t.entity, t.entityId, t.occurredAt),
  ],
)

export const exportJobs = pgTable('export_jobs', {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  municipalityId: uuid()
    .notNull()
    .references(() => municipalities.id),
  requesterId: text().notNull(),
  status: exportStatusEnum().notNull().default('pending'),
  storagePath: text('storage_path'),
  errorMessage: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp({ withTimezone: true }),
})

/** Outbox de invalidación de caché hacia la app del municipio. */
export const pendingRevalidations = pgTable(
  'pending_revalidations',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    municipalityId: uuid()
      .notNull()
      .references(() => municipalities.id, { onDelete: 'cascade' }),
    tags: text().array().notNull(),
    attempts: integer().notNull().default(0),
    lastError: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('pending_revalidations_municipality').on(t.municipalityId, t.createdAt)],
)

/** Configuración global en pares clave/valor (umbrales del semáforo, límites de tamaño, etc.). */
export const settings = pgTable('settings', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
