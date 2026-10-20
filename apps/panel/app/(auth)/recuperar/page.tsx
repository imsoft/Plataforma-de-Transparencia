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
import { useState } from 'react'
import { authCliente } from '@/lib/auth-cliente'

export default function PaginaRecuperar() {
  const [cargando, setCargando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCargando(true)
    const email = campo(new FormData(e.currentTarget), 'email')
    await authCliente.requestPasswordReset({ email, redirectTo: '/restablecer' })
    setCargando(false)
    setEnviado(true) // siempre el mismo mensaje: no revelamos si el correo existe
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
        {enviado ? (
          <p className="text-sm">
            Si el correo está registrado, en unos minutos recibirás el enlace. Revisa también la
            carpeta de correo no deseado.
          </p>
        ) : (
          <form onSubmit={enviar} className="flex flex-col gap-4">
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
            <Button type="submit" className="h-11" disabled={cargando}>
              {cargando && <Loader2Icon className="animate-spin" aria-hidden />} Enviar enlace
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
