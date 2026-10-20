import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { versionStatusEnum, nodeLevelEnum, frequencyEnum, equivalenceTypeEnum } from './enums'

const id = () =>
  uuid()
    .primaryKey()
    .default(sql`uuidv7()`)
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow()

export const states = pgTable('states', {
  id: id(),
  key: text().notNull().unique(), // 'JAL'
  name: text().notNull(),
})

export const obligatedSubjectTypes = pgTable('obligated_subject_types', {
  id: id(),
  slug: text().notNull().unique(), // 'ayuntamiento' | 'dif' | 'agua'
  name: text().notNull(),
})

export const lawIndexVersions = pgTable(
  'law_index_versions',
  {
    id: id(),
    stateId: uuid()
      .notNull()
      .references(() => states.id),
    slug: text().notNull(), // 'ley-anterior' | 'ley-2026'
    name: text().notNull(),
    effectiveDate: date(),
    status: versionStatusEnum().notNull().default('draft'),
    storageFolder: text('storage_folder').notNull(), // segmento de ruta en el bucket
    publishedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('law_index_versions_state_slug').on(t.stateId, t.slug),
    // una sola versión vigente por estado
    uniqueIndex('law_index_versions_current_unique')
      .on(t.stateId)
      .where(sql`${t.status} = 'current'`),
  ],
)

export const lawIndexNodes = pgTable(
  'law_index_nodes',
  {
    id: id(),
    versionId: uuid()
      .notNull()
      .references(() => lawIndexVersions.id, { onDelete: 'cascade' }),
    subjectTypeId: uuid()
      .notNull()
      .references(() => obligatedSubjectTypes.id),
    parentId: uuid(), // null = raíz (artículo o sección)
    level: nodeLevelEnum().notNull(),
    number: text().notNull(), // '8', '5', 'a' (fracción en arábigo)
    label: text().notNull(), // 'Art. 8', 'Fracc. V', 'Inciso a'
    title: text().notNull(),
    description: text(),
    key: text(), // '85a'; null en secciones sin numeración legal
    routeSlug: text(), // 'armonizacion-contable' para raíces sin artículo
    frequency: frequencyEnum().notNull(),
    frequencyToConfirm: boolean().notNull().default(false),
    storageFolder: text('storage_folder').notNull(), // 'art-08/fr-05/inc-a'
    order: integer('sort_order').notNull().default(0),
    active: boolean().notNull().default(true),
  },
  (t) => [
    uniqueIndex('law_index_nodes_key_unique').on(t.versionId, t.subjectTypeId, t.key),
    uniqueIndex('law_index_nodes_route_slug_unique').on(t.versionId, t.subjectTypeId, t.routeSlug),
    index('law_index_nodes_parent_order').on(t.parentId, t.order),
    index('law_index_nodes_version_type').on(t.versionId, t.subjectTypeId),
  ],
)

export const lawIndexEquivalences = pgTable(
  'law_index_equivalences',
  {
    id: id(),
    sourceNodeId: uuid()
      .notNull()
      .references(() => lawIndexNodes.id, { onDelete: 'cascade' }),
    targetNodeId: uuid()
      .notNull()
      .references(() => lawIndexNodes.id, { onDelete: 'cascade' }),
    type: equivalenceTypeEnum().notNull().default('exact'),
    note: text(),
  },
  (t) => [uniqueIndex('law_index_equivalences_pair').on(t.sourceNodeId, t.targetNodeId)],
)

export const statesRelations = relations(states, ({ many }) => ({
  versions: many(lawIndexVersions),
}))

export const lawIndexVersionsRelations = relations(lawIndexVersions, ({ one, many }) => ({
  state: one(states, { fields: [lawIndexVersions.stateId], references: [states.id] }),
  nodes: many(lawIndexNodes),
}))

export const lawIndexNodesRelations = relations(lawIndexNodes, ({ one, many }) => ({
  version: one(lawIndexVersions, {
    fields: [lawIndexNodes.versionId],
    references: [lawIndexVersions.id],
  }),
  subjectType: one(obligatedSubjectTypes, {
    fields: [lawIndexNodes.subjectTypeId],
    references: [obligatedSubjectTypes.id],
  }),
  parent: one(lawIndexNodes, {
    fields: [lawIndexNodes.parentId],
    references: [lawIndexNodes.id],
    relationName: 'children',
  }),
  children: many(lawIndexNodes, { relationName: 'children' }),
}))

export const obligatedSubjectTypesRelations = relations(obligatedSubjectTypes, ({ many }) => ({
  nodes: many(lawIndexNodes),
}))
