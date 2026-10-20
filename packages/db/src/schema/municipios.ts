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
import { estados, indiceNodos, tiposSujetoObligado } from './catalogo'
import { estatusMunicipioEnum, plantillaEnum } from './enums'

const id = () =>
  uuid()
    .primaryKey()
    .default(sql`uuidv7()`)
const marcaTiempo = () => timestamp({ withTimezone: true }).notNull().defaultNow()

export type DatosContacto = {
  direccion?: string
  telefono?: string
  correo?: string
  horario?: string
}

export const municipios = pgTable('municipios', {
  id: id(),
  estadoId: uuid()
    .notNull()
    .references(() => estados.id),
  organizationId: text()
    .notNull()
    .references(() => organization.id)
    .unique(),
  slug: text().notNull().unique(),
  nombre: text().notNull(), // 'Tuxcacuesco'
  nombreOficial: text().notNull(), // 'H. Ayuntamiento de Tuxcacuesco'
  estatus: estatusMunicipioEnum().notNull().default('activo'),
  urlRevalidacion: text(),
  secretoRevalidacionHash: text(),
  datosContacto: jsonb().$type<DatosContacto>().notNull().default({}),
  creadoEn: marcaTiempo(),
  actualizadoEn: marcaTiempo(),
})

export const municipioDominios = pgTable('municipio_dominios', {
  id: id(),
  municipioId: uuid()
    .notNull()
    .references(() => municipios.id, { onDelete: 'cascade' }),
  host: text().notNull().unique(),
  principal: boolean().notNull().default(false),
})

export type ImagenesTema = { portada?: string[]; favicon?: string }

export const municipioTema = pgTable('municipio_tema', {
  municipioId: uuid()
    .primaryKey()
    .references(() => municipios.id, { onDelete: 'cascade' }),
  plantilla: plantillaEnum().notNull().default('institucional-clasica'),
  colorPrimario: text().notNull().default('#125c6a'), // paleta neutra por defecto (sin colores de partidos)
  colorSecundario: text().notNull().default('#35505e'),
  colorAcento: text().notNull().default('#5b7a8c'),
  tipografia: text().notNull().default('Inter'),
  escudoRuta: text(),
  logoAdministracionRuta: text(),
  imagenes: jsonb().$type<ImagenesTema>().notNull().default({}),
  version: integer().notNull().default(1), // sube en cada cambio; invalida tarjetas OG
  actualizadoEn: marcaTiempo(),
})

export const sujetosObligados = pgTable(
  'sujetos_obligados',
  {
    id: id(),
    municipioId: uuid()
      .notNull()
      .references(() => municipios.id, { onDelete: 'cascade' }),
    tipoSujetoId: uuid()
      .notNull()
      .references(() => tiposSujetoObligado.id),
    nombre: text().notNull(), // 'DIF Tuxcacuesco'
    prefijo: text().notNull().default(''), // '' = raíz (Ayuntamiento)
    orden: integer().notNull().default(0),
    activo: boolean().notNull().default(true),
  },
  (t) => [
    uniqueIndex('sujetos_obligados_prefijo').on(t.municipioId, t.prefijo),
    uniqueIndex('sujetos_obligados_tipo').on(t.municipioId, t.tipoSujetoId),
  ],
)

export const redesSociales = pgTable(
  'redes_sociales',
  {
    id: id(),
    municipioId: uuid()
      .notNull()
      .references(() => municipios.id, { onDelete: 'cascade' }),
    sujetoObligadoId: uuid().references(() => sujetosObligados.id, { onDelete: 'cascade' }), // null = todo el municipio
    red: text().notNull(), // slug del catálogo u 'otra'
    nombreOtra: text(),
    url: text().notNull(),
    texto: text(),
    orden: integer().notNull().default(0),
    visible: boolean().notNull().default(true),
    ocultarEnVeda: boolean().notNull().default(false),
    actualizadoEn: marcaTiempo(),
  },
  (t) => [index('redes_sociales_municipio').on(t.municipioId, t.sujetoObligadoId, t.orden)],
)

/** Restricción opcional de una membresía a ciertos sujetos obligados o nodos. Sin filas = sin restricción. */
export const alcancesMiembro = pgTable(
  'alcances_miembro',
  {
    id: id(),
    memberId: text()
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    municipioId: uuid()
      .notNull()
      .references(() => municipios.id, { onDelete: 'cascade' }),
    sujetoObligadoId: uuid().references(() => sujetosObligados.id, { onDelete: 'cascade' }),
    nodoId: uuid().references(() => indiceNodos.id, { onDelete: 'cascade' }),
  },
  (t) => [index('alcances_miembro_member').on(t.memberId)],
)

export const municipiosRelations = relations(municipios, ({ one, many }) => ({
  estado: one(estados, { fields: [municipios.estadoId], references: [estados.id] }),
  organizacion: one(organization, {
    fields: [municipios.organizationId],
    references: [organization.id],
  }),
  dominios: many(municipioDominios),
  tema: one(municipioTema),
  sujetosObligados: many(sujetosObligados),
  redesSociales: many(redesSociales),
}))

export const sujetosObligadosRelations = relations(sujetosObligados, ({ one }) => ({
  municipio: one(municipios, {
    fields: [sujetosObligados.municipioId],
    references: [municipios.id],
  }),
  tipo: one(tiposSujetoObligado, {
    fields: [sujetosObligados.tipoSujetoId],
    references: [tiposSujetoObligado.id],
  }),
}))

export const municipioDominiosRelations = relations(municipioDominios, ({ one }) => ({
  municipio: one(municipios, {
    fields: [municipioDominios.municipioId],
    references: [municipios.id],
  }),
}))

export const municipioTemaRelations = relations(municipioTema, ({ one }) => ({
  municipio: one(municipios, { fields: [municipioTema.municipioId], references: [municipios.id] }),
}))

export const redesSocialesRelations = relations(redesSociales, ({ one }) => ({
  municipio: one(municipios, { fields: [redesSociales.municipioId], references: [municipios.id] }),
  sujetoObligado: one(sujetosObligados, {
    fields: [redesSociales.sujetoObligadoId],
    references: [sujetosObligados.id],
  }),
}))

export const alcancesMiembroRelations = relations(alcancesMiembro, ({ one }) => ({
  miembro: one(member, { fields: [alcancesMiembro.memberId], references: [member.id] }),
  municipio: one(municipios, {
    fields: [alcancesMiembro.municipioId],
    references: [municipios.id],
  }),
}))
