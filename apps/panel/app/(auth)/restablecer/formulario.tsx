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
import { Loader2Icon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { authCliente } from '@/lib/auth-cliente'

export function FormularioRestablecer({
  token,
  errorInicial,
}: {
  token: string | null
  errorInicial: string | null
}) {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(errorInicial)
  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!token) return
    const f = new FormData(e.currentTarget)
    if (f.get('password') !== f.get('password2')) return setError('Las contraseñas no coinciden.')
    setCargando(true)
    const r = await authCliente.resetPassword({ newPassword: campo(f, 'password'), token })
    setCargando(false)
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
        <form onSubmit={enviar} className="flex flex-col gap-4">
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
          <Button type="submit" className="h-11" disabled={cargando || !token}>
            {cargando && <Loader2Icon className="animate-spin" aria-hidden />} Guardar contraseña
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
