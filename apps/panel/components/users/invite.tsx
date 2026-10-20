'use client'
import { Button } from '@platform/ui/components/button'
import { field } from '@/lib/form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@platform/ui/components/dialog'
import { Input } from '@platform/ui/components/input'
import { Label } from '@platform/ui/components/label'
import { Loader2Icon, UserPlusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { inviteUser } from '@/actions/users'
import { ROLE_DESCRIPTION, ROLE_NAME } from './roles'

export function InviteUser({ slug, isSuperadmin }: { slug: string; isSuperadmin: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<'municipal_admin' | 'uploader' | 'supervisor'>('uploader')
  const [pending, start] = useTransition()
  const roles = isSuperadmin
    ? (['municipal_admin', 'uploader', 'supervisor'] as const)
    : (['municipal_admin', 'uploader'] as const)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="h-11" />}>
        <UserPlusIcon aria-hidden /> Invitar usuario
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const email = field(new FormData(e.currentTarget), 'email')
            start(async () => {
              const r = await inviteUser({ slug, email, role })
              if (!r.ok) {
                toast.error(r.error)
                return
              }
              toast.success(`Invitación enviada a ${email}. Vence en 72 horas.`)
              setOpen(false)
              router.refresh()
            })
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>Invitar usuario</DialogTitle>
            <DialogDescription>
              Le llegará un correo con un enlace para crear su cuenta. Una cuenta por persona: nada
              de correos compartidos. Si quieres limitar a un capturista a ciertos sujetos
              obligados, hazlo desde su menú una vez que acepte.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label htmlFor="inv-email">Correo electrónico</Label>
            <Input
              id="inv-email"
              name="email"
              type="email"
              required
              autoFocus
              className="h-11 text-base"
              placeholder="nombre@municipio.gob.mx"
            />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Rol</legend>
            {roles.map((r) => (
              <label
                key={r}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${role === r ? 'border-primary bg-primary/5' : ''}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={role === r}
                  onChange={() => setRole(r)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">{ROLE_NAME[r]}</span>
                  <span className="block text-sm text-muted-foreground">{ROLE_DESCRIPTION[r]}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending} className="h-11">
              {pending && <Loader2Icon className="animate-spin" aria-hidden />} Enviar invitación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
