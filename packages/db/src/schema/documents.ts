import { relations, sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth'
import { lawIndexNodes } from './catalog'
import { documentStatusEnum, fileTypeEnum, documentTypeEnum } from './enums'
import { municipalities, obligatedSubjects } from './municipalities'

const timestampColumn = () => timestamp({ withTimezone: true }).notNull().defaultNow()

export const documents = pgTable(
  'documents',
  {
    // nanoid(12): va en /d/<id>, debe ser corto y no adivinable. Lo genera la app.
    id: text().primaryKey(),
    municipalityId: uuid()
      .notNull()
      .references(() => municipalities.id),
    obligatedSubjectId: uuid()
      .notNull()
      .references(() => obligatedSubjects.id),
    nodeId: uuid()
      .notNull()
      .references(() => lawIndexNodes.id),
    name: text().notNull(),
    periodLabel: text(), // 'Marzo 2026', '1er trimestre 2026'
    periodStart: date(),
    periodEnd: date(),
    periodFolder: text().notNull().default('permanent'), // '2026-03' | '2026-t1' | '2026' | 'permanent'
    order: integer('sort_order').notNull().default(0),
    status: documentStatusEnum().notNull().default('published'),
    type: documentTypeEnum().notNull().default('file'),
    externalUrl: text(), // solo tipo video_externo
    currentVersionId: uuid(), // FK a document_versions (diferida, se agrega en SQL)
    publishedAt: timestamp({ withTimezone: true }),
    createdBy: text().references(() => user.id),
    createdAt: timestampColumn(),
    updatedAt: timestampColumn(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index('documents_node').on(t.municipalityId, t.obligatedSubjectId, t.nodeId, t.status, t.order),
    index('documents_recent').on(t.municipalityId, t.updatedAt),
  ],
)

export const documentVersions = pgTable(
  'document_versions',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    documentId: text()
      .notNull()
      .references(() => documents.id),
    number: integer().notNull(),
    storagePath: text('storage_path').notNull(),
    originalName: text().notNull(),
    mime: text().notNull(),
    fileType: fileTypeEnum().notNull(),
    size: bigint({ mode: 'number' }).notNull(),
    hashSha256: text(),
    durationSec: integer(),
    thumbnailPath: text(),
    isCurrent: boolean().notNull().default(true),
    uploadedBy: text().references(() => user.id),
    createdAt: timestampColumn(),
  },
  (t) => [uniqueIndex('document_versions_number').on(t.documentId, t.number)],
)

export const noInformationNotices = pgTable(
  'no_information_notices',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    municipalityId: uuid()
      .notNull()
      .references(() => municipalities.id),
    obligatedSubjectId: uuid()
      .notNull()
      .references(() => obligatedSubjects.id),
    nodeId: uuid()
      .notNull()
      .references(() => lawIndexNodes.id),
    periodLabel: text(),
    periodStart: date(),
    periodEnd: date(),
    text: text().notNull(),
    createdBy: text().references(() => user.id),
    createdAt: timestampColumn(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex('no_information_notices_period_unique')
      .on(t.nodeId, t.obligatedSubjectId, t.periodStart)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
)

export const documentsRelations = relations(documents, ({ one, many }) => ({
  municipality: one(municipalities, {
    fields: [documents.municipalityId],
    references: [municipalities.id],
  }),
  obligatedSubject: one(obligatedSubjects, {
    fields: [documents.obligatedSubjectId],
    references: [obligatedSubjects.id],
  }),
  node: one(lawIndexNodes, { fields: [documents.nodeId], references: [lawIndexNodes.id] }),
  currentVersion: one(documentVersions, {
    fields: [documents.currentVersionId],
    references: [documentVersions.id],
  }),
  versions: many(documentVersions),
}))

export const documentVersionsRelations = relations(documentVersions, ({ one }) => ({
  document: one(documents, {
    fields: [documentVersions.documentId],
    references: [documents.id],
  }),
}))

// `foreignKey` se importa para dejar claro que la FK documents.current_version_id → document_versions.id
// se crea en una migración SQL personalizada (es circular y debe ser DEFERRABLE).
void foreignKey
