import { Badge } from '@plataforma/ui/components/badge'
import { Button } from '@plataforma/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@plataforma/ui/components/card'
import { ROLES_CON_2FA_OBLIGATORIA } from '@plataforma/auth'
import { ShieldCheckIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { CambiarContrasena } from '@/components/cuenta/cambiar-contrasena'
import { exigirSesion } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Mi cuenta' }

export default async function PaginaCuenta() {
  const s = await exigirSesion()
  const obligatoria =
    s.esSuperadmin ||
    s.membresias.some((m) => (ROLES_CON_2FA_OBLIGATORIA as readonly string[]).includes(m.rol))
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Mi cuenta y seguridad</h1>
        <p className="text-sm text-muted-foreground">
          {s.nombre} · {s.email}
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
            {obligatoria && !s.twoFactorEnabled && ' Para tu rol es obligatoria.'}
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
      <CambiarContrasena />
    </div>
  )
}
