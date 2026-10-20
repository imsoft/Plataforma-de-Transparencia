import {
  alcancesMiembro,
  and,
  conUsuario,
  desc,
  eq,
  inArray,
  invitation,
  member,
  user as tablaUser,
} from '@plataforma/db'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FilaUsuario } from '@/components/usuarios/fila'
import { InvitarUsuario } from '@/components/usuarios/invitar'
import { ListaInvitaciones } from '@/components/usuarios/invitaciones'
import { fechaCorta } from '@/lib/fechas'
import { contextoMunicipio } from '@/lib/municipio'

export const metadata: Metadata = { title: 'Usuarios' }

export default async function PaginaUsuarios({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await contextoMunicipio(slug)
  if (!c.puede('usuario:ver')) notFound()
  const { miembros, invitaciones } = await conUsuario(c.ctx, async (tx) => {
    const ms = await tx
      .select({
        memberId: member.id,
        userId: tablaUser.id,
        nombre: tablaUser.name,
        email: tablaUser.email,
        rol: member.role,
        cargo: tablaUser.cargo,
        desde: member.createdAt,
        dosPasos: tablaUser.twoFactorEnabled,
      })
      .from(member)
      .innerJoin(tablaUser, eq(tablaUser.id, member.userId))
      .where(eq(member.organizationId, c.municipio.organizationId))
      .orderBy(tablaUser.name)
    const alcances =
      ms.length > 0
        ? await tx.query.alcancesMiembro.findMany({
            where: inArray(
              alcancesMiembro.memberId,
              ms.map((m) => m.memberId),
            ),
          })
        : []
    const invs = await tx.query.invitation.findMany({
      where: and(
        eq(invitation.organizationId, c.municipio.organizationId),
        eq(invitation.status, 'pending'),
      ),
      orderBy: [desc(invitation.createdAt)],
    })
    return {
      miembros: ms.map((m) => ({
        ...m,
        sujetosObligadosIds: alcances
          .filter((a) => a.memberId === m.memberId && a.sujetoObligadoId)
          .map((a) => a.sujetoObligadoId!),
      })),
      invitaciones: invs.map((i) => ({
        id: i.id,
        email: i.email,
        rol: i.role ?? 'capturista',
        vence: fechaCorta(i.expiresAt),
      })),
    }
  })
  const sujetos = c.municipio.sujetosObligados
    .filter((s) => s.activo)
    .map((s) => ({ id: s.id, nombre: s.prefijo ? s.nombre : 'Ayuntamiento' }))
  const puedeGestionar = c.puede('usuario:invitar')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Quién puede publicar en {c.municipio.nombre}. Cuando alguien se va, dale de baja: pierde
            el acceso al instante.
          </p>
        </div>
        {puedeGestionar && <InvitarUsuario slug={slug} esSuperadmin={c.sesion.esSuperadmin} />}
      </div>

      <ul className="divide-y rounded-xl border bg-card">
        {miembros.map((m) => (
          <FilaUsuario
            key={m.memberId}
            slug={slug}
            usuario={{ ...m, desde: fechaCorta(m.desde), dosPasos: Boolean(m.dosPasos) }}
            sujetos={sujetos}
            puedeGestionar={puedeGestionar && m.userId !== c.sesion.usuarioId}
            esSuperadmin={c.sesion.esSuperadmin}
          />
        ))}
      </ul>

      {invitaciones.length > 0 && (
        <ListaInvitaciones
          slug={slug}
          invitaciones={invitaciones}
          puedeGestionar={puedeGestionar}
        />
      )}
    </div>
  )
}
