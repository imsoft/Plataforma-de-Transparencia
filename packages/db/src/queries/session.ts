/** Lecturas de sesión/membresías. No llevan RLS (tablas de auth), por eso pueden usar el cliente del panel directo. */
import { eq, sql } from 'drizzle-orm'
import { dbPanel } from '../client'
import * as s from '../schema'

export type MembershipWithMunicipality = {
  memberId: string
  municipalityId: string
  organizationId: string
  role: string
  municipality: {
    id: string
    slug: string
    name: string
    officialName: string
    status: 'active' | 'panel_suspended'
  }
  scopes: { obligatedSubjectId: string | null; nodeId: string | null }[]
}

export async function userMemberships(userId: string): Promise<MembershipWithMunicipality[]> {
  const rows = await dbPanel().transaction(async (tx) => {
    // la política `panel_select_miembro` deja leer los municipios donde el usuario es miembro
    await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, true)`)
    return tx
      .select({
        memberId: s.member.id,
        organizationId: s.member.organizationId,
        role: s.member.role,
        municipalityId: s.municipalities.id,
        slug: s.municipalities.slug,
        name: s.municipalities.name,
        officialName: s.municipalities.officialName,
        status: s.municipalities.status,
      })
      .from(s.member)
      .innerJoin(s.municipalities, eq(s.municipalities.organizationId, s.member.organizationId))
      .where(eq(s.member.userId, userId))
  })
  if (rows.length === 0) return []
  // alcances_miembro sí tiene RLS; se leen con el contexto del propio usuario más abajo (panel) — aquí solo los ids.
  return rows.map((f) => ({
    memberId: f.memberId,
    municipalityId: f.municipalityId,
    organizationId: f.organizationId,
    role: f.role,
    municipality: {
      id: f.municipalityId,
      slug: f.slug,
      name: f.name,
      officialName: f.officialName,
      status: f.status,
    },
    scopes: [],
  }))
}

/** Municipios del superadmin (todos). */
export async function allMunicipalities() {
  return dbPanel().transaction(async (tx) => {
    // el superadmin lee con su rol; RLS lo deja pasar
    await tx.execute(
      sql`SELECT set_config('app.role', 'superadmin', true), set_config('app.user_id', 'read', true)`,
    )
    return tx
      .select({
        id: s.municipalities.id,
        slug: s.municipalities.slug,
        name: s.municipalities.name,
        officialName: s.municipalities.officialName,
        status: s.municipalities.status,
      })
      .from(s.municipalities)
      .orderBy(s.municipalities.name)
  })
}
