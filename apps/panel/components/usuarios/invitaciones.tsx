'use client'
import { Button } from '@plataforma/ui/components/button'
import { MailIcon, XIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { cancelarInvitacion } from '@/acciones/usuarios'
import { NOMBRE_ROL } from './roles'

export function ListaInvitaciones({
  slug,
  invitaciones,
  puedeGestionar,
}: {
  slug: string
  invitaciones: { id: string; email: string; rol: string; vence: string }[]
  puedeGestionar: boolean
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">Invitaciones pendientes</h2>
      <ul className="divide-y rounded-xl border bg-card">
        {invitaciones.map((i) => (
          <li key={i.id} className="flex items-center gap-3 p-3">
            <MailIcon className="size-5 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{i.email}</p>
              <p className="text-xs text-muted-foreground">
                {NOMBRE_ROL[i.rol] ?? i.rol} · vence el {i.vence}
              </p>
            </div>
            {puedeGestionar && (
              <Button
                variant="ghost"
                size="sm"
                disabled={pendiente}
                onClick={() =>
                  iniciar(async () => {
                    const r = await cancelarInvitacion(slug, i.id)
                    if (!r.ok) {
                      toast.error(r.error)
                      return
                    }
                    toast('Invitación cancelada')
                    router.refresh()
                  })
                }
              >
                <XIcon aria-hidden /> Cancelar
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
