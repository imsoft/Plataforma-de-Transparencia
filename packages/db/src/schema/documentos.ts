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
import { indiceNodos } from './catalogo'
import { estadoDocumentoEnum, tipoArchivoEnum, tipoDocumentoEnum } from './enums'
import { municipios, sujetosObligados } from './municipios'

const marcaTiempo = () => timestamp({ withTimezone: true }).notNull().defaultNow()

export const documentos = pgTable(
  'documentos',
  {
    // nanoid(12): va en /d/<id>, debe ser corto y no adivinable. Lo genera la app.
    id: text().primaryKey(),
    municipioId: uuid()
      .notNull()
      .references(() => municipios.id),
    sujetoObligadoId: uuid()
      .notNull()
      .references(() => sujetosObligados.id),
    nodoId: uuid()
      .notNull()
      .references(() => indiceNodos.id),
    nombre: text().notNull(),
    periodoEtiqueta: text(), // 'Marzo 2026', '1er trimestre 2026'
    periodoInicio: date(),
    periodoFin: date(),
    carpetaPeriodo: text().notNull().default('permanente'), // '2026-03' | '2026-t1' | '2026' | 'permanente'
    orden: integer().notNull().default(0),
    estado: estadoDocumentoEnum().notNull().default('publicado'),
    tipo: tipoDocumentoEnum().notNull().default('archivo'),
    urlExterna: text(), // solo tipo video_externo
    versionActualId: uuid(), // FK a documento_versiones (diferida, se agrega en SQL)
    publicadoEn: timestamp({ withTimezone: true }),
    creadoPor: text().references(() => user.id),
    creadoEn: marcaTiempo(),
    actualizadoEn: marcaTiempo(),
    eliminadoEn: timestamp({ withTimezone: true }),
  },
  (t) => [
    index('documentos_nodo').on(t.municipioId, t.sujetoObligadoId, t.nodoId, t.estado, t.orden),
    index('documentos_recientes').on(t.municipioId, t.actualizadoEn),
  ],
)

export const documentoVersiones = pgTable(
  'documento_versiones',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    documentoId: text()
      .notNull()
      .references(() => documentos.id),
    numero: integer().notNull(),
    rutaR2: text('ruta_r2').notNull(),
    nombreOriginal: text().notNull(),
    mime: text().notNull(),
    tipoArchivo: tipoArchivoEnum().notNull(),
    tamano: bigint({ mode: 'number' }).notNull(),
    hashSha256: text(),
    duracionSeg: integer(),
    miniaturaRuta: text(),
    vigente: boolean().notNull().default(true),
    subidoPor: text().references(() => user.id),
    creadoEn: marcaTiempo(),
  },
  (t) => [uniqueIndex('documento_versiones_numero').on(t.documentoId, t.numero)],
)

export const leyendasSinInformacion = pgTable(
  'leyendas_sin_informacion',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    municipioId: uuid()
      .notNull()
      .references(() => municipios.id),
    sujetoObligadoId: uuid()
      .notNull()
      .references(() => sujetosObligados.id),
    nodoId: uuid()
      .notNull()
      .references(() => indiceNodos.id),
    periodoEtiqueta: text(),
    periodoInicio: date(),
    periodoFin: date(),
    texto: text().notNull(),
    creadoPor: text().references(() => user.id),
    creadoEn: marcaTiempo(),
    eliminadoEn: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex('leyendas_periodo_unica')
      .on(t.nodoId, t.sujetoObligadoId, t.periodoInicio)
      .where(sql`${t.eliminadoEn} IS NULL`),
  ],
)

export const documentosRelations = relations(documentos, ({ one, many }) => ({
  municipio: one(municipios, { fields: [documentos.municipioId], references: [municipios.id] }),
  sujetoObligado: one(sujetosObligados, {
    fields: [documentos.sujetoObligadoId],
    references: [sujetosObligados.id],
  }),
  nodo: one(indiceNodos, { fields: [documentos.nodoId], references: [indiceNodos.id] }),
  versionActual: one(documentoVersiones, {
    fields: [documentos.versionActualId],
    references: [documentoVersiones.id],
  }),
  versiones: many(documentoVersiones),
}))

export const documentoVersionesRelations = relations(documentoVersiones, ({ one }) => ({
  documento: one(documentos, {
    fields: [documentoVersiones.documentoId],
    references: [documentos.id],
  }),
}))

// `foreignKey` se importa para dejar claro que la FK documentos.version_actual_id → documento_versiones.id
// se crea en una migración SQL personalizada (es circular y debe ser DEFERRABLE).
void foreignKey
