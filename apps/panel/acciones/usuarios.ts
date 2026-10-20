'use server'
import { exigir, ROLES_MUNICIPIO, type RolMunicipio } from '@plataforma/auth'
import {
  alcancesMiembro,
  and,
  conUsuario,
  eq,
  invitation,
  member,
  session as tablaSesion,
  user as tablaUser,
} from '@plataforma/db'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { contextoMunicipio } from '@/lib/municipio'
import { accion, ErrorUsuario } from './comun'

const rolSchema = z.enum(ROLES_MUNICIPIO as [RolMunicipio, ...RolMunicipio[]])

const invitarSchema = z.object({
  slug: z.string(),
  email: z.string().trim().toLowerCase().email('Escribe un correo válido.'),
  rol: rolSchema,
})

export async function invitarUsuario(entrada: z.infer<typeof invitarSchema>) {
  return accion(async () => {
    const e = invitarSchema.parse(entrada)
    const c = await contextoMunicipio(e.slug)
    exigir(c.sesion, 'usuario:invitar', { municipioId: c.municipio.id })
    if (e.rol === 'supervisor' && !c.sesion.esSuperadmin)
      throw new ErrorUsuario('Solo el superadministrador asigna supervisores.')
    // Better Auth crea la invitación y manda el correo (sendInvitationEmail)
    const inv = await auth.api.createInvitation({
      body: {
        email: e.email,
        role: e.rol,
        organizationId: c.municipio.organizationId,
        resend: true,
      },
      headers: await headers(),
    })
    revalidatePath(`/m/${e.slug}/usuarios`)
    return { id: inv.id }
  })
}

export async function cancelarInvitacion(slug: string, invitacionId: string) {
  return accion(async () => {
    const c = await contextoMunicipio(slug)
    exigir(c.sesion, 'usuario:invitar', { municipioId: c.municipio.id })
    await conUsuario(c.ctx, (tx) =>
      tx
        .update(invitation)
        .set({ status: 'canceled' })
        .where(
          and(
            eq(invitation.id, z.string().parse(invitacionId)),
            eq(invitation.organizationId, c.municipio.organizationId),
          ),
        ),
    )
    revalidatePath(`/m/${slug}/usuarios`)
  })
}

export async function cambiarRol(
  slug: string,
  memberId: string,
  rol: RolMunicipio,
  sujetosObligadosIds: string[] = [],
) {
  return accion(async () => {
    const c = await contextoMunicipio(slug)
    exigir(c.sesion, 'usuario:cambiar_rol', { municipioId: c.municipio.id })
    const nuevoRol = rolSchema.parse(rol)
    if (nuevoRol === 'supervisor' && !c.sesion.esSuperadmin)
      throw new ErrorUsuario('Solo el superadministrador asigna supervisores.')
    await conUsuario(c.ctx, async (tx) => {
      const m = await tx.query.member.findFirst({
        where: and(eq(member.id, memberId), eq(member.organizationId, c.municipio.organizationId)),
      })
      if (!m) throw new ErrorUsuario('Ese usuario ya no pertenece al municipio.')
      if (m.userId === c.sesion.usuarioId)
        throw new ErrorUsuario('No puedes cambiar tu propio rol.')
      await tx.update(member).set({ role: nuevoRol }).where(eq(member.id, m.id))
      await tx.delete(alcancesMiembro).where(eq(alcancesMiembro.memberId, m.id))
      for (const soId of z.array(z.string().uuid()).parse(sujetosObligadosIds)) {
        await tx
          .insert(alcancesMiembro)
          .values({ memberId: m.id, municipioId: c.municipio.id, sujetoObligadoId: soId })
      }
    })
    revalidatePath(`/m/${slug}/usuarios`)
  })
}

/** Baja inmediata: se quita la membresía y se cierran todas sus sesiones. El usuario conserva su cuenta si tiene otros municipios. */
export async function darDeBaja(slug: string, memberId: string) {
  return accion(async () => {
    const c = await contextoMunicipio(slug)
    exigir(c.sesion, 'usuario:dar_de_baja', { municipioId: c.municipio.id })
    await conUsuario(c.ctx, async (tx) => {
      const m = await tx.query.member.findFirst({
        where: and(eq(member.id, memberId), eq(member.organizationId, c.municipio.organizationId)),
      })
      if (!m) throw new ErrorUsuario('Ese usuario ya no pertenece al municipio.')
      if (m.userId === c.sesion.usuarioId)
        throw new ErrorUsuario('No puedes darte de baja a ti mismo.')
      await tx.delete(alcancesMiembro).where(eq(alcancesMiembro.memberId, m.id))
      await tx.delete(member).where(eq(member.id, m.id))
      await tx.delete(tablaSesion).where(eq(tablaSesion.userId, m.userId)) // revoca sesiones al instante
      const otras = await tx.query.member.findMany({
        where: eq(member.userId, m.userId),
        columns: { id: true },
      })
      if (otras.length === 0) {
        const u = await tx.query.user.findFirst({
          where: eq(tablaUser.id, m.userId),
          columns: { role: true },
        })
        if (!(u?.role ?? '').includes('superadmin'))
          await tx
            .update(tablaUser)
            .set({ banned: true, banReason: 'Dado de baja de su municipio' })
            .where(eq(tablaUser.id, m.userId))
      }
    })
    revalidatePath(`/m/${slug}/usuarios`)
  })
}
