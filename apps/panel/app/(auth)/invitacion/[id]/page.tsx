import { invitationById } from '@platform/db/queries/invitations'
import { Card, CardDescription, CardHeader, CardTitle } from '@platform/ui/components/card'
import type { Metadata } from 'next'
import { getSession } from '@/lib/session'
import { InvitationForm } from './form'

export const metadata: Metadata = { title: 'Invitación' }

export default async function InvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invite = await invitationById(id)
  if (!invite || invite.status !== 'pending' || invite.expiresAt < new Date()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Esta invitación ya no es válida</CardTitle>
          <CardDescription>
            Puede que haya vencido (duran 72 horas) o que ya se haya usado. Pide al administrador de
            tu municipio que te invite de nuevo.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }
  const session = await getSession()
  return (
    <InvitationForm
      invitationId={invite.id}
      email={invite.email}
      municipality={invite.municipality}
      session={session ? { email: session.email, name: session.name } : null}
    />
  )
}
