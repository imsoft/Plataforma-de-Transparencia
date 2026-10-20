import {
  memberScopes,
  and,
  withUser,
  desc,
  eq,
  inArray,
  invitation,
  member,
  user as userTable,
} from '@platform/db'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { UserRow } from '@/components/users/row'
import { InviteUser } from '@/components/users/invite'
import { InvitationList } from '@/components/users/invitations'
import { shortDate } from '@/lib/dates'
import { municipalityContext } from '@/lib/municipality'

export const metadata: Metadata = { title: 'Usuarios' }

export default async function UsersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await municipalityContext(slug)
  if (!c.can('user:view')) notFound()
  const { members, invitations } = await withUser(c.ctx, async (tx) => {
    const ms = await tx
      .select({
        memberId: member.id,
        userId: userTable.id,
        name: userTable.name,
        email: userTable.email,
        role: member.role,
        jobTitle: userTable.jobTitle,
        from: member.createdAt,
        twoFactor: userTable.twoFactorEnabled,
      })
      .from(member)
      .innerJoin(userTable, eq(userTable.id, member.userId))
      .where(eq(member.organizationId, c.municipality.organizationId))
      .orderBy(userTable.name)
    const scopes =
      ms.length > 0
        ? await tx.query.memberScopes.findMany({
            where: inArray(
              memberScopes.memberId,
              ms.map((m) => m.memberId),
            ),
          })
        : []
    const invites = await tx.query.invitation.findMany({
      where: and(
        eq(invitation.organizationId, c.municipality.organizationId),
        eq(invitation.status, 'pending'),
      ),
      orderBy: [desc(invitation.createdAt)],
    })
    return {
      members: ms.map((m) => ({
        ...m,
        obligatedSubjectIds: scopes
          .filter((a) => a.memberId === m.memberId && a.obligatedSubjectId)
          .map((a) => a.obligatedSubjectId!),
      })),
      invitations: invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role ?? 'uploader',
        expiresOn: shortDate(i.expiresAt),
      })),
    }
  })
  const subjects = c.municipality.obligatedSubjects
    .filter((s) => s.active)
    .map((s) => ({ id: s.id, name: s.prefix ? s.name : 'Ayuntamiento' }))
  const canManage = c.can('user:invite')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Quién puede publicar en {c.municipality.name}. Cuando alguien se va, dale de baja:
            pierde el acceso al instante.
          </p>
        </div>
        {canManage && <InviteUser slug={slug} isSuperadmin={c.session.isSuperadmin} />}
      </div>

      <ul className="divide-y rounded-xl border bg-card">
        {members.map((m) => (
          <UserRow
            key={m.memberId}
            slug={slug}
            user={{ ...m, from: shortDate(m.from), twoFactor: Boolean(m.twoFactor) }}
            subjects={subjects}
            canManage={canManage && m.userId !== c.session.userId}
            isSuperadmin={c.session.isSuperadmin}
          />
        ))}
      </ul>

      {invitations.length > 0 && (
        <InvitationList slug={slug} invitations={invitations} canManage={canManage} />
      )}
    </div>
  )
}
