'use client'
import { Button } from '@plataforma/ui/components/button'
import { campo } from '@/lib/formulario'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@plataforma/ui/components/card'
import { Input } from '@plataforma/ui/components/input'
import { Label } from '@plataforma/ui/components/label'
import { useState } from 'react'
import { toast } from 'sonner'
import { authCliente } from '@/lib/auth-cliente'

export function CambiarContrasena() {
  const [cargando, setCargando] = useState(false)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cambiar contraseña</CardTitle>
        <CardDescription>Mínimo 12 caracteres. Se cerrarán tus otras sesiones.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const f = new FormData(e.currentTarget)
            if (f.get('nueva') !== f.get('nueva2'))
              return toast.error('Las contraseñas nuevas no coinciden.')
            setCargando(true)
            const r = await authCliente.changePassword({
              currentPassword: campo(f, 'actual'),
              newPassword: campo(f, 'nueva'),
              revokeOtherSessions: true,
            })
            setCargando(false)
            if (r.error)
              return toast.error(
                r.error.code === 'INVALID_PASSWORD'
                  ? 'La contraseña actual no es correcta.'
                  : r.error.code === 'PASSWORD_COMPROMISED'
                    ? 'Esa contraseña apareció en una filtración. Elige otra.'
                    : 'No se pudo cambiar la contraseña.',
              )
            toast.success('Contraseña actualizada')
            e.currentTarget?.reset()
          }}
          className="flex max-w-sm flex-col gap-3"
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="actual">Contraseña actual</Label>
            <Input
              id="actual"
              name="actual"
              type="password"
              required
              autoComplete="current-password"
              className="h-11"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="nueva">Nueva contraseña</Label>
            <Input
              id="nueva"
              name="nueva"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              className="h-11"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="nueva2">Repite la nueva contraseña</Label>
            <Input
              id="nueva2"
              name="nueva2"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              className="h-11"
            />
          </div>
          <Button type="submit" variant="outline" disabled={cargando} className="h-11 self-start">
            Cambiar contraseña
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
