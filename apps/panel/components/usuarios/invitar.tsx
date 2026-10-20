'use client'
import { Button } from '@plataforma/ui/components/button'
import { campo } from '@/lib/formulario'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@plataforma/ui/components/dialog'
import { Input } from '@plataforma/ui/components/input'
import { Label } from '@plataforma/ui/components/label'
import { Loader2Icon, UserPlusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { invitarUsuario } from '@/acciones/usuarios'
import { DESCRIPCION_ROL, NOMBRE_ROL } from './roles'

export function InvitarUsuario({ slug, esSuperadmin }: { slug: string; esSuperadmin: boolean }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [rol, setRol] = useState<'admin_municipal' | 'capturista' | 'supervisor'>('capturista')
  const [pendiente, iniciar] = useTransition()
  const roles = esSuperadmin
    ? (['admin_municipal', 'capturista', 'supervisor'] as const)
    : (['admin_municipal', 'capturista'] as const)

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button className="h-11" />}>
        <UserPlusIcon aria-hidden /> Invitar usuario
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const email = campo(new FormData(e.currentTarget), 'email')
            iniciar(async () => {
              const r = await invitarUsuario({ slug, email, rol })
              if (!r.ok) {
                toast.error(r.error)
                return
              }
              toast.success(`Invitación enviada a ${email}. Vence en 72 horas.`)
              setAbierto(false)
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
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${rol === r ? 'border-primary bg-primary/5' : ''}`}
              >
                <input
                  type="radio"
                  name="rol"
                  value={r}
                  checked={rol === r}
                  onChange={() => setRol(r)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">{NOMBRE_ROL[r]}</span>
                  <span className="block text-sm text-muted-foreground">{DESCRIPCION_ROL[r]}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pendiente} className="h-11">
              {pendiente && <Loader2Icon className="animate-spin" aria-hidden />} Enviar invitación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
