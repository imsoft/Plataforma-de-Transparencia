'use server'
import { require, MUNICIPALITY_ROLES, type MunicipalityRole } from '@platform/auth'
import {
  memberScopes,
  and,
  withUser,
  eq,
  invitation,
  member,
  session as sessionTable,
  user as userTable,
} from '@platform/db'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { municipalityContext } from '@/lib/municipality'
import { action, UserFacingError } from './common'

const roleSchema = z.enum(MUNICIPALITY_ROLES as [MunicipalityRole, ...MunicipalityRole[]])

const inviteSchema = z.object({
  slug: z.string(),
  email: z.string().trim().toLowerCase().email('Escribe un correo válido.'),
  role: roleSchema,
})

export async function inviteUser(input: z.infer<typeof inviteSchema>) {
  return action(async () => {
    const e = inviteSchema.parse(input)
    const c = await municipalityContext(e.slug)
    require(c.session, 'user:invite', { municipalityId: c.municipality.id })
    if (e.role === 'supervisor' && !c.session.isSuperadmin)
      throw new UserFacingError('Solo el superadministrador asigna supervisores.')
    // Better Auth crea la invitación y manda el correo (sendInvitationEmail)
    const invite = await auth.api.createInvitation({
      body: {
        email: e.email,
        role: e.role,
        organizationId: c.municipality.organizationId,
        resend: true,
      },
      headers: await headers(),
    })
    revalidatePath(`/m/${e.slug}/usuarios`)
    return { id: invite.id }
  })
}

export async function cancelInvitation(slug: string, invitationId: string) {
  return action(async () => {
    const c = await municipalityContext(slug)
    require(c.session, 'user:invite', { municipalityId: c.municipality.id })
    await withUser(c.ctx, (tx) =>
      tx
        .update(invitation)
        .set({ status: 'canceled' })
        .where(
          and(
            eq(invitation.id, z.string().parse(invitationId)),
            eq(invitation.organizationId, c.municipality.organizationId),
          ),
        ),
    )
    revalidatePath(`/m/${slug}/usuarios`)
  })
}

export async function changeRole(
  slug: string,
  memberId: string,
  role: MunicipalityRole,
  obligatedSubjectIds: string[] = [],
) {
  return action(async () => {
    const c = await municipalityContext(slug)
    require(c.session, 'user:change_role', { municipalityId: c.municipality.id })
    const newRole = roleSchema.parse(role)
    if (newRole === 'supervisor' && !c.session.isSuperadmin)
      throw new UserFacingError('Solo el superadministrador asigna supervisores.')
    await withUser(c.ctx, async (tx) => {
      const m = await tx.query.member.findFirst({
        where: and(
          eq(member.id, memberId),
          eq(member.organizationId, c.municipality.organizationId),
        ),
      })
      if (!m) throw new UserFacingError('Ese usuario ya no pertenece al municipio.')
      if (m.userId === c.session.userId)
        throw new UserFacingError('No puedes cambiar tu propio rol.')
      await tx.update(member).set({ role: newRole }).where(eq(member.id, m.id))
      await tx.delete(memberScopes).where(eq(memberScopes.memberId, m.id))
      for (const subjectId of z.array(z.string().uuid()).parse(obligatedSubjectIds)) {
        await tx.insert(memberScopes).values({
          memberId: m.id,
          municipalityId: c.municipality.id,
          obligatedSubjectId: subjectId,
        })
      }
    })
    revalidatePath(`/m/${slug}/usuarios`)
  })
}

/** Baja inmediata: se quita la membresía y se cierran todas sus sesiones. El usuario conserva su cuenta si tiene otros municipios. */
export async function removeMember(slug: string, memberId: string) {
  return action(async () => {
    const c = await municipalityContext(slug)
    require(c.session, 'user:remove', { municipalityId: c.municipality.id })
    await withUser(c.ctx, async (tx) => {
      const m = await tx.query.member.findFirst({
        where: and(
          eq(member.id, memberId),
          eq(member.organizationId, c.municipality.organizationId),
        ),
      })
      if (!m) throw new UserFacingError('Ese usuario ya no pertenece al municipio.')
      if (m.userId === c.session.userId)
        throw new UserFacingError('No puedes darte de baja a ti mismo.')
      await tx.delete(memberScopes).where(eq(memberScopes.memberId, m.id))
      await tx.delete(member).where(eq(member.id, m.id))
      await tx.delete(sessionTable).where(eq(sessionTable.userId, m.userId)) // revoca sesiones al instante
      const others = await tx.query.member.findMany({
        where: eq(member.userId, m.userId),
        columns: { id: true },
      })
      if (others.length === 0) {
        const u = await tx.query.user.findFirst({
          where: eq(userTable.id, m.userId),
          columns: { role: true },
        })
        if (!(u?.role ?? '').includes('superadmin'))
          await tx
            .update(userTable)
            .set({ banned: true, banReason: 'Dado de baja de su municipio' })
            .where(eq(userTable.id, m.userId))
      }
    })
    revalidatePath(`/m/${slug}/usuarios`)
  })
}
