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

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'El correo o la contraseña no son correctos.',
  USER_NOT_FOUND: 'El correo o la contraseña no son correctos.',
  BANNED_USER:
    'Esta cuenta está dada de baja. Si crees que es un error, contacta al administrador de tu municipio.',
  TOO_MANY_REQUESTS: 'Demasiados intentos. Espera unos minutos y vuelve a intentar.',
}

export function SignInForm({ returnTo }: { returnTo: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const { data, error } = await authClient.signIn.email({
      email: field(form, 'email'),
      password: field(form, 'password'),
    })
    setLoading(false)
    if (error) {
      setError(
        error.status === 429
          ? MESSAGES.TOO_MANY_REQUESTS!
          : (MESSAGES[error.code ?? ''] ?? 'No se pudo iniciar sesión. Intenta de nuevo.'),
      )
      return
    }
    if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) {
      router.push(`/verificar?returnTo=${encodeURIComponent(returnTo)}`)
      return
    }
    router.push(returnTo)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Iniciar sesión</CardTitle>
        <CardDescription>Entra con el correo con el que te invitaron.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={send} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              className="h-11 text-base"
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
              <Link
                href="/recuperar"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                ¿La olvidaste?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
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
          <Button type="submit" size="lg" disabled={loading} className="h-11">
            {loading && <Loader2Icon className="animate-spin" aria-hidden />}
            Entrar
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
