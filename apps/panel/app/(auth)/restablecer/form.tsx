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
import { Loader2Icon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { authClient } from '@/lib/auth-client'

export function ResetPasswordForm({
  token,
  initialError,
}: {
  token: string | null
  initialError: string | null
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!token) return
    const f = new FormData(e.currentTarget)
    if (f.get('password') !== f.get('password2')) return setError('Las contraseñas no coinciden.')
    setLoading(true)
    const r = await authClient.resetPassword({ newPassword: field(f, 'password'), token })
    setLoading(false)
    if (r.error)
      return setError(
        r.error.code === 'PASSWORD_COMPROMISED'
          ? 'Esa contraseña apareció en una filtración. Elige otra.'
          : 'No se pudo cambiar la contraseña. Pide un enlace nuevo.',
      )
    router.push('/iniciar-sesion')
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Elige tu nueva contraseña</CardTitle>
        <CardDescription>
          Mínimo 12 caracteres. Al cambiarla se cierran tus otras sesiones.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={send} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="password">Nueva contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              className="h-11 text-base"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="password2">Repite la contraseña</Label>
            <Input
              id="password2"
              name="password2"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              className="h-11 text-base"
            />
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <Button type="submit" className="h-11" disabled={loading || !token}>
            {loading && <Loader2Icon className="animate-spin" aria-hidden />} Guardar contraseña
          </Button>
          <Link
            href="/recuperar"
            className="text-center text-sm text-primary underline-offset-4 hover:underline"
          >
            Pedir un enlace nuevo
          </Link>
        </form>
      </CardContent>
    </Card>
  )
}
