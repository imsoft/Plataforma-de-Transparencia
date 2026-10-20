import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { Tx } from '../cliente'
import * as s from '../schema'

export type DocumentoConVersion = typeof s.documentos.$inferSelect & {
  versionActual: typeof s.documentoVersiones.$inferSelect | null
}

/** Documentos de un nodo (todos los estados salvo papelera por defecto), con su versión vigente. */
export async function documentosDeNodo(
  tx: Tx,
  {
    municipioId,
    sujetoObligadoId,
    nodoId,
    estados,
  }: {
    municipioId: string
    sujetoObligadoId: string
    nodoId: string
    estados?: (typeof s.estadoDocumentoEnum.enumValues)[number][]
  },
): Promise<DocumentoConVersion[]> {
  return tx.query.documentos.findMany({
    where: and(
      eq(s.documentos.municipioId, municipioId),
      eq(s.documentos.sujetoObligadoId, sujetoObligadoId),
      eq(s.documentos.nodoId, nodoId),
      inArray(s.documentos.estado, estados ?? ['publicado', 'oculto', 'historico']),
    ),
    with: { versionActual: true },
    orderBy: [
      desc(s.documentos.periodoInicio),
      asc(s.documentos.orden),
      desc(s.documentos.creadoEn),
    ],
  })
}

export async function documentoPorId(tx: Tx, id: string) {
  return tx.query.documentos
    .findMany({
      where: eq(s.documentos.id, id),
      with: {
        versionActual: true,
        versiones: { orderBy: [desc(s.documentoVersiones.numero)] },
        nodo: true,
        sujetoObligado: true,
      },
      limit: 1,
    })
    .then((r) => r[0] ?? null)
}

export async function recientes(tx: Tx, municipioId: string, limite = 8) {
  return tx.query.documentos.findMany({
    where: and(
      eq(s.documentos.municipioId, municipioId),
      inArray(s.documentos.estado, ['publicado', 'oculto', 'historico']),
    ),
    with: { versionActual: true, nodo: true, sujetoObligado: true },
    orderBy: [desc(s.documentos.actualizadoEn)],
    limit: limite,
  })
}

export async function papelera(tx: Tx, municipioId: string) {
  return tx.query.documentos.findMany({
    where: and(eq(s.documentos.municipioId, municipioId), eq(s.documentos.estado, 'papelera')),
    with: { versionActual: true, nodo: true, sujetoObligado: true },
    orderBy: [desc(s.documentos.eliminadoEn)],
  })
}

export type Cobertura = { total: number; periodos: string[] }

/** Por nodo: cuántos documentos publicados tiene y qué periodos cubre (documentos + leyendas). Para el semáforo. */
export async function coberturaPorNodo(
  tx: Tx,
  municipioId: string,
  sujetoObligadoId: string,
): Promise<Map<string, Cobertura>> {
  const docs = await tx
    .select({
      nodoId: s.documentos.nodoId,
      periodo: s.documentos.periodoInicio,
      n: sql<number>`count(*)::int`,
    })
    .from(s.documentos)
    .where(
      and(
        eq(s.documentos.municipioId, municipioId),
        eq(s.documentos.sujetoObligadoId, sujetoObligadoId),
        eq(s.documentos.estado, 'publicado'),
      ),
    )
    .groupBy(s.documentos.nodoId, s.documentos.periodoInicio)
  const leyendas = await tx
    .select({
      nodoId: s.leyendasSinInformacion.nodoId,
      periodo: s.leyendasSinInformacion.periodoInicio,
    })
    .from(s.leyendasSinInformacion)
    .where(
      and(
        eq(s.leyendasSinInformacion.municipioId, municipioId),
        eq(s.leyendasSinInformacion.sujetoObligadoId, sujetoObligadoId),
        isNull(s.leyendasSinInformacion.eliminadoEn),
      ),
    )
  const mapa = new Map<string, Cobertura>()
  const entrada = (id: string) =>
    mapa.get(id) ?? (mapa.set(id, { total: 0, periodos: [] }), mapa.get(id)!)
  for (const d of docs) {
    const e = entrada(d.nodoId)
    e.total += d.n
    if (d.periodo && !e.periodos.includes(d.periodo)) e.periodos.push(d.periodo)
  }
  for (const l of leyendas) {
    const e = entrada(l.nodoId)
    if (l.periodo && !e.periodos.includes(l.periodo)) e.periodos.push(l.periodo)
  }
  return mapa
}

export async function leyendasDeNodo(
  tx: Tx,
  {
    municipioId,
    sujetoObligadoId,
    nodoId,
  }: { municipioId: string; sujetoObligadoId: string; nodoId: string },
) {
  return tx.query.leyendasSinInformacion.findMany({
    where: and(
      eq(s.leyendasSinInformacion.municipioId, municipioId),
      eq(s.leyendasSinInformacion.sujetoObligadoId, sujetoObligadoId),
      eq(s.leyendasSinInformacion.nodoId, nodoId),
      isNull(s.leyendasSinInformacion.eliminadoEn),
    ),
    orderBy: [desc(s.leyendasSinInformacion.periodoInicio)],
  })
}
