import { and, asc, eq } from 'drizzle-orm'
import type { Tx } from '../client'
import * as s from '../schema'

export type FullMunicipality = NonNullable<Awaited<ReturnType<typeof municipalityBySlug>>>

/** Municipio con tema, sujetos obligados (y su tipo) y dominios. Respeta RLS del contexto. */
export async function municipalityBySlug(tx: Tx, slug: string) {
  const m = await tx.query.municipalities.findFirst({
    where: eq(s.municipalities.slug, slug),
    with: {
      theme: true,
      domains: true,
      obligatedSubjects: { with: { type: true }, orderBy: [asc(s.obligatedSubjects.order)] },
    },
  })
  if (!m) return null
  return m
}

export async function municipalityById(tx: Tx, id: string) {
  return tx.query.municipalities.findFirst({
    where: eq(s.municipalities.id, id),
    with: {
      theme: true,
      domains: true,
      obligatedSubjects: { with: { type: true }, orderBy: [asc(s.obligatedSubjects.order)] },
    },
  })
}

export async function obligatedSubjectByPrefix(tx: Tx, municipalityId: string, prefix: string) {
  return tx.query.obligatedSubjects.findFirst({
    where: and(
      eq(s.obligatedSubjects.municipalityId, municipalityId),
      eq(s.obligatedSubjects.prefix, prefix),
      eq(s.obligatedSubjects.active, true),
    ),
    with: { type: true },
  })
}
