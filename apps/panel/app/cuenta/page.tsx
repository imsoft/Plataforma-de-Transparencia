import { Badge } from '@platform/ui/components/badge'
import { Button } from '@platform/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@platform/ui/components/card'
import { ROLES_REQUIRING_2FA } from '@platform/auth'
import { ShieldCheckIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChangePassword } from '@/components/account/change-password'
import { requireSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Mi cuenta' }

export default async function AccountPage() {
  const s = await requireSession()
  const mandatory =
    s.isSuperadmin ||
    s.memberships.some((m) => (ROLES_REQUIRING_2FA as readonly string[]).includes(m.role))
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Mi cuenta y seguridad</h1>
        <p className="text-sm text-muted-foreground">
          {s.name} · {s.email}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheckIcon className="size-5" aria-hidden /> Verificación en dos pasos
            {s.twoFactorEnabled ? (
              <Badge>Activa</Badge>
            ) : (
              <Badge variant="secondary">Desactivada</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Además de tu contraseña, pedimos un código de tu teléfono al entrar. Protege la
            información del municipio aunque alguien consiga tu contraseña.
            {mandatory && !s.twoFactorEnabled && ' Para tu rol es obligatoria.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            nativeButton={false}
            render={<Link href="/cuenta/dos-pasos" />}
            variant={s.twoFactorEnabled ? 'outline' : 'default'}
            className="h-11"
          >
            {s.twoFactorEnabled ? 'Administrar' : 'Activar ahora'}
          </Button>
        </CardContent>
      </Card>
      <ChangePassword />
    </div>
  )
}
