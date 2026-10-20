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
import { useState } from 'react'
import { authClient } from '@/lib/auth-client'

export default function RecoverPage() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const email = field(new FormData(e.currentTarget), 'email')
    await authClient.requestPasswordReset({ email, redirectTo: '/restablecer' })
    setLoading(false)
    setSent(true) // siempre el mismo mensaje: no revelamos si el correo existe
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recuperar contraseña</CardTitle>
        <CardDescription>
          Te mandamos un enlace a tu correo para elegir una contraseña nueva.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p className="text-sm">
            Si el correo está registrado, en unos minutos recibirás el enlace. Revisa también la
            carpeta de correo no deseado.
          </p>
        ) : (
          <form onSubmit={send} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoFocus
                className="h-11 text-base"
              />
            </div>
            <Button type="submit" className="h-11" disabled={loading}>
              {loading && <Loader2Icon className="animate-spin" aria-hidden />} Enviar enlace
            </Button>
          </form>
        )}
        <Link
          href="/iniciar-sesion"
          className="mt-4 block text-center text-sm text-primary underline-offset-4 hover:underline"
        >
          Volver a iniciar sesión
        </Link>
      </CardContent>
    </Card>
  )
}
