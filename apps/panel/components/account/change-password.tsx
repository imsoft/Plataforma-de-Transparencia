'use client'
import { Button } from '@platform/ui/components/button'
import { field } from '@/lib/form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@platform/ui/components/card'
import { Input } from '@platform/ui/components/input'
import { Label } from '@platform/ui/components/label'
import { useState } from 'react'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'

export function ChangePassword() {
  const [loading, setLoading] = useState(false)
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
            if (f.get('newPassword') !== f.get('newPassword2'))
              return toast.error('Las contraseñas nuevas no coinciden.')
            setLoading(true)
            const r = await authClient.changePassword({
              currentPassword: field(f, 'currentPassword'),
              newPassword: field(f, 'newPassword'),
              revokeOtherSessions: true,
            })
            setLoading(false)
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
            <Label htmlFor="currentPassword">Contraseña actual</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className="h-11"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="newPassword">Nueva contraseña</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              className="h-11"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="newPassword2">Repite la nueva contraseña</Label>
            <Input
              id="newPassword2"
              name="newPassword2"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              className="h-11"
            />
          </div>
          <Button type="submit" variant="outline" disabled={loading} className="h-11 self-start">
            Cambiar contraseña
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
