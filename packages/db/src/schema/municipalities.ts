import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { member, organization } from './auth'
import { states, lawIndexNodes, obligatedSubjectTypes } from './catalog'
import { municipalityStatusEnum, templateEnum } from './enums'

const id = () =>
  uuid()
    .primaryKey()
    .default(sql`uuidv7()`)
const timestampColumn = () => timestamp({ withTimezone: true }).notNull().defaultNow()

export type ContactInfo = {
  address?: string
  phone?: string
  email?: string
  hours?: string
}

export const municipalities = pgTable('municipalities', {
  id: id(),
  stateId: uuid()
    .notNull()
    .references(() => states.id),
  organizationId: text()
    .notNull()
    .references(() => organization.id)
    .unique(),
  slug: text().notNull().unique(),
  name: text().notNull(), // 'Tuxcacuesco'
  officialName: text().notNull(), // 'H. Ayuntamiento de Tuxcacuesco'
  status: municipalityStatusEnum().notNull().default('active'),
  revalidationUrl: text(),
  revalidationSecretHash: text(),
  contactInfo: jsonb().$type<ContactInfo>().notNull().default({}),
  createdAt: timestampColumn(),
  updatedAt: timestampColumn(),
})

export const municipalityDomains = pgTable('municipality_domains', {
  id: id(),
  municipalityId: uuid()
    .notNull()
    .references(() => municipalities.id, { onDelete: 'cascade' }),
  host: text().notNull().unique(),
  isPrimary: boolean().notNull().default(false),
})

export type ThemeImages = { home?: string[]; favicon?: string }

export const municipalityTheme = pgTable('municipality_theme', {
  municipalityId: uuid()
    .primaryKey()
    .references(() => municipalities.id, { onDelete: 'cascade' }),
  template: templateEnum().notNull().default('classic-institutional'),
  primaryColor: text().notNull().default('#125c6a'), // paleta neutra por defecto (sin colores de partidos)
  secondaryColor: text().notNull().default('#35505e'),
  accentColor: text().notNull().default('#5b7a8c'),
  typeface: text().notNull().default('Inter'),
  coatOfArmsPath: text(),
  administrationLogoPath: text(),
  images: jsonb().$type<ThemeImages>().notNull().default({}),
  version: integer().notNull().default(1), // sube en cada cambio; invalida tarjetas OG
  updatedAt: timestampColumn(),
})

export const obligatedSubjects = pgTable(
  'obligated_subjects',
  {
    id: id(),
    municipalityId: uuid()
      .notNull()
      .references(() => municipalities.id, { onDelete: 'cascade' }),
    subjectTypeId: uuid()
      .notNull()
      .references(() => obligatedSubjectTypes.id),
    name: text().notNull(), // 'DIF Tuxcacuesco'
    prefix: text().notNull().default(''), // '' = raíz (Ayuntamiento)
    order: integer('sort_order').notNull().default(0),
    active: boolean().notNull().default(true),
  },
  (t) => [
    uniqueIndex('obligated_subjects_prefix').on(t.municipalityId, t.prefix),
    uniqueIndex('obligated_subjects_type').on(t.municipalityId, t.subjectTypeId),
  ],
)

export const socialNetworks = pgTable(
  'social_networks',
  {
    id: id(),
    municipalityId: uuid()
      .notNull()
      .references(() => municipalities.id, { onDelete: 'cascade' }),
    obligatedSubjectId: uuid().references(() => obligatedSubjects.id, { onDelete: 'cascade' }), // null = todo el municipio
    network: text().notNull(), // slug del catálogo u 'otra'
    otherName: text(),
    url: text().notNull(),
    text: text(),
    order: integer('sort_order').notNull().default(0),
    visible: boolean().notNull().default(true),
    hideDuringBlackout: boolean().notNull().default(false),
    updatedAt: timestampColumn(),
  },
  (t) => [
    index('social_networks_municipality').on(t.municipalityId, t.obligatedSubjectId, t.order),
  ],
)

/** Restricción opcional de una membresía a ciertos sujetos obligados o nodos. Sin filas = sin restricción. */
export const memberScopes = pgTable(
  'member_scopes',
  {
    id: id(),
    memberId: text()
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    municipalityId: uuid()
      .notNull()
      .references(() => municipalities.id, { onDelete: 'cascade' }),
    obligatedSubjectId: uuid().references(() => obligatedSubjects.id, { onDelete: 'cascade' }),
    nodeId: uuid().references(() => lawIndexNodes.id, { onDelete: 'cascade' }),
  },
  (t) => [index('member_scopes_member').on(t.memberId)],
)

export const municipalitiesRelations = relations(municipalities, ({ one, many }) => ({
  state: one(states, { fields: [municipalities.stateId], references: [states.id] }),
  organization: one(organization, {
    fields: [municipalities.organizationId],
    references: [organization.id],
  }),
  domains: many(municipalityDomains),
  theme: one(municipalityTheme),
  obligatedSubjects: many(obligatedSubjects),
  socialNetworks: many(socialNetworks),
}))

export const obligatedSubjectsRelations = relations(obligatedSubjects, ({ one }) => ({
  municipality: one(municipalities, {
    fields: [obligatedSubjects.municipalityId],
    references: [municipalities.id],
  }),
  type: one(obligatedSubjectTypes, {
    fields: [obligatedSubjects.subjectTypeId],
    references: [obligatedSubjectTypes.id],
  }),
}))

export const municipalityDomainsRelations = relations(municipalityDomains, ({ one }) => ({
  municipality: one(municipalities, {
    fields: [municipalityDomains.municipalityId],
    references: [municipalities.id],
  }),
}))

export const municipalityThemeRelations = relations(municipalityTheme, ({ one }) => ({
  municipality: one(municipalities, {
    fields: [municipalityTheme.municipalityId],
    references: [municipalities.id],
  }),
}))

export const socialNetworksRelations = relations(socialNetworks, ({ one }) => ({
  municipality: one(municipalities, {
    fields: [socialNetworks.municipalityId],
    references: [municipalities.id],
  }),
  obligatedSubject: one(obligatedSubjects, {
    fields: [socialNetworks.obligatedSubjectId],
    references: [obligatedSubjects.id],
  }),
}))

export const memberScopesRelations = relations(memberScopes, ({ one }) => ({
  member: one(member, { fields: [memberScopes.memberId], references: [member.id] }),
  municipality: one(municipalities, {
    fields: [memberScopes.municipalityId],
    references: [municipalities.id],
  }),
}))
