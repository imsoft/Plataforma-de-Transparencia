import { invitacionPorId } from '@plataforma/db/consultas/invitaciones'
import { Card, CardDescription, CardHeader, CardTitle } from '@plataforma/ui/components/card'
import type { Metadata } from 'next'
import { obtenerSesion } from '@/lib/sesion'
import { FormularioInvitacion } from './formulario'

export const metadata: Metadata = { title: 'Invitación' }

export default async function PaginaInvitacion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const inv = await invitacionPorId(id)
  if (!inv || inv.status !== 'pending' || inv.expiresAt < new Date()) {
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
  const sesion = await obtenerSesion()
  return (
    <FormularioInvitacion
      invitacionId={inv.id}
      email={inv.email}
      municipio={inv.municipio}
      sesion={sesion ? { email: sesion.email, nombre: sesion.nombre } : null}
    />
  )
}
