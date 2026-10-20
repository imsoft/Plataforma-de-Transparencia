'use client'
import { Button } from '@platform/ui/components/button'
import { MailIcon, XIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { cancelInvitation } from '@/actions/users'
import { ROLE_NAME } from './roles'

export function InvitationList({
  slug,
  invitations,
  canManage,
}: {
  slug: string
  invitations: { id: string; email: string; role: string; expiresOn: string }[]
  canManage: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">Invitaciones pendientes</h2>
      <ul className="divide-y rounded-xl border bg-card">
        {invitations.map((i) => (
          <li key={i.id} className="flex items-center gap-3 p-3">
            <MailIcon className="size-5 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{i.email}</p>
              <p className="text-xs text-muted-foreground">
                {ROLE_NAME[i.role] ?? i.role} · vence el {i.expiresOn}
              </p>
            </div>
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await cancelInvitation(slug, i.id)
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
