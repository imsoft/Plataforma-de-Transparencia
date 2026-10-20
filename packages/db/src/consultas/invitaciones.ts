import { eq } from 'drizzle-orm'
import { dbPanel } from '../cliente'
import * as s from '../schema'

/** Invitación por id con el nombre del municipio (tabla de Better Auth, sin RLS). Lectura mínima para la página pública de aceptación. */
export async function invitacionPorId(id: string) {
  const [inv] = await dbPanel()
    .select({
      id: s.invitation.id,
      email: s.invitation.email,
      status: s.invitation.status,
      expiresAt: s.invitation.expiresAt,
      rol: s.invitation.role,
      municipio: s.organization.name,
    })
    .from(s.invitation)
    .innerJoin(s.organization, eq(s.organization.id, s.invitation.organizationId))
    .where(eq(s.invitation.id, id))
    .limit(1)
  return inv ?? null
}
