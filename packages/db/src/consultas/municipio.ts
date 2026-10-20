import { and, asc, eq } from 'drizzle-orm'
import type { Tx } from '../cliente'
import * as s from '../schema'

export type MunicipioCompleto = NonNullable<Awaited<ReturnType<typeof municipioPorSlug>>>

/** Municipio con tema, sujetos obligados (y su tipo) y dominios. Respeta RLS del contexto. */
export async function municipioPorSlug(tx: Tx, slug: string) {
  const m = await tx.query.municipios.findFirst({
    where: eq(s.municipios.slug, slug),
    with: {
      tema: true,
      dominios: true,
      sujetosObligados: { with: { tipo: true }, orderBy: [asc(s.sujetosObligados.orden)] },
    },
  })
  if (!m) return null
  return m
}

export async function municipioPorId(tx: Tx, id: string) {
  return tx.query.municipios.findFirst({
    where: eq(s.municipios.id, id),
    with: {
      tema: true,
      dominios: true,
      sujetosObligados: { with: { tipo: true }, orderBy: [asc(s.sujetosObligados.orden)] },
    },
  })
}

export async function sujetoObligadoPorPrefijo(tx: Tx, municipioId: string, prefijo: string) {
  return tx.query.sujetosObligados.findFirst({
    where: and(
      eq(s.sujetosObligados.municipioId, municipioId),
      eq(s.sujetosObligados.prefijo, prefijo),
      eq(s.sujetosObligados.activo, true),
    ),
    with: { tipo: true },
  })
}
