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
import { estatusVersionEnum, nivelNodoEnum, periodicidadEnum, tipoEquivalenciaEnum } from './enums'

const id = () =>
  uuid()
    .primaryKey()
    .default(sql`uuidv7()`)
const creadoEn = () => timestamp({ withTimezone: true }).notNull().defaultNow()

export const estados = pgTable('estados', {
  id: id(),
  clave: text().notNull().unique(), // 'JAL'
  nombre: text().notNull(),
})

export const tiposSujetoObligado = pgTable('tipos_sujeto_obligado', {
  id: id(),
  slug: text().notNull().unique(), // 'ayuntamiento' | 'dif' | 'agua'
  nombre: text().notNull(),
})

export const indiceVersiones = pgTable(
  'indice_versiones',
  {
    id: id(),
    estadoId: uuid()
      .notNull()
      .references(() => estados.id),
    slug: text().notNull(), // 'ley-anterior' | 'ley-2026'
    nombre: text().notNull(),
    fechaVigencia: date(),
    estatus: estatusVersionEnum().notNull().default('borrador'),
    carpetaR2: text('carpeta_r2').notNull(), // segmento de ruta en el bucket
    publicadaEn: timestamp({ withTimezone: true }),
    creadaEn: creadoEn(),
  },
  (t) => [
    uniqueIndex('indice_versiones_estado_slug').on(t.estadoId, t.slug),
    // una sola versión vigente por estado
    uniqueIndex('indice_versiones_vigente_unica')
      .on(t.estadoId)
      .where(sql`${t.estatus} = 'vigente'`),
  ],
)

export const indiceNodos = pgTable(
  'indice_nodos',
  {
    id: id(),
    versionId: uuid()
      .notNull()
      .references(() => indiceVersiones.id, { onDelete: 'cascade' }),
    tipoSujetoId: uuid()
      .notNull()
      .references(() => tiposSujetoObligado.id),
    padreId: uuid(), // null = raíz (artículo o sección)
    nivel: nivelNodoEnum().notNull(),
    numero: text().notNull(), // '8', '5', 'a' (fracción en arábigo)
    etiqueta: text().notNull(), // 'Art. 8', 'Fracc. V', 'Inciso a'
    titulo: text().notNull(),
    descripcion: text(),
    clave: text(), // '85a'; null en secciones sin numeración legal
    rutaSlug: text(), // 'armonizacion-contable' para raíces sin artículo
    periodicidad: periodicidadEnum().notNull(),
    periodicidadPorConfirmar: boolean().notNull().default(false),
    carpetaR2: text('carpeta_r2').notNull(), // 'art-08/fr-05/inc-a'
    orden: integer().notNull().default(0),
    activo: boolean().notNull().default(true),
  },
  (t) => [
    uniqueIndex('indice_nodos_clave_unica').on(t.versionId, t.tipoSujetoId, t.clave),
    uniqueIndex('indice_nodos_ruta_slug_unica').on(t.versionId, t.tipoSujetoId, t.rutaSlug),
    index('indice_nodos_padre_orden').on(t.padreId, t.orden),
    index('indice_nodos_version_tipo').on(t.versionId, t.tipoSujetoId),
  ],
)

export const indiceEquivalencias = pgTable(
  'indice_equivalencias',
  {
    id: id(),
    nodoOrigenId: uuid()
      .notNull()
      .references(() => indiceNodos.id, { onDelete: 'cascade' }),
    nodoDestinoId: uuid()
      .notNull()
      .references(() => indiceNodos.id, { onDelete: 'cascade' }),
    tipo: tipoEquivalenciaEnum().notNull().default('exacta'),
    nota: text(),
  },
  (t) => [uniqueIndex('indice_equivalencias_par').on(t.nodoOrigenId, t.nodoDestinoId)],
)

export const estadosRelations = relations(estados, ({ many }) => ({
  versiones: many(indiceVersiones),
}))

export const indiceVersionesRelations = relations(indiceVersiones, ({ one, many }) => ({
  estado: one(estados, { fields: [indiceVersiones.estadoId], references: [estados.id] }),
  nodos: many(indiceNodos),
}))

export const indiceNodosRelations = relations(indiceNodos, ({ one, many }) => ({
  version: one(indiceVersiones, {
    fields: [indiceNodos.versionId],
    references: [indiceVersiones.id],
  }),
  tipoSujeto: one(tiposSujetoObligado, {
    fields: [indiceNodos.tipoSujetoId],
    references: [tiposSujetoObligado.id],
  }),
  padre: one(indiceNodos, {
    fields: [indiceNodos.padreId],
    references: [indiceNodos.id],
    relationName: 'hijos',
  }),
  hijos: many(indiceNodos, { relationName: 'hijos' }),
}))

export const tiposSujetoObligadoRelations = relations(tiposSujetoObligado, ({ many }) => ({
  nodos: many(indiceNodos),
}))
