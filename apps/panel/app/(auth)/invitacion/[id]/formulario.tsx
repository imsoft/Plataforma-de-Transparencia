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
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { authCliente } from '@/lib/auth-cliente'

export function FormularioInvitacion({
  invitacionId,
  email,
  municipio,
  sesion,
}: {
  invitacionId: string
  email: string
  municipio: string
  sesion: { email: string; nombre: string } | null
}) {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function aceptar() {
    const r = await authCliente.organization.acceptInvitation({ invitationId: invitacionId })
    if (r.error) throw new Error(r.error.message ?? 'No se pudo aceptar la invitación')
  }

  async function crearCuenta(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    const f = new FormData(e.currentTarget)
    const password = campo(f, 'password')
    if (password !== campo(f, 'password2')) {
      setCargando(false)
      return setError('Las contraseñas no coinciden.')
    }
    try {
      const r = await authCliente.signUp.email({
        email,
        password,
        name: campo(f, 'name').trim(),
        cargo: campo(f, 'cargo').trim(),
      } as never)
      if (r.error) {
        const code = r.error.code ?? ''
        setError(
          code === 'PASSWORD_COMPROMISED'
            ? 'Esa contraseña apareció en una filtración. Elige otra.'
            : code === 'USER_ALREADY_EXISTS'
              ? 'Ya existe una cuenta con este correo. Inicia sesión y vuelve a abrir el enlace.'
              : (r.error.message ?? 'No se pudo crear la cuenta.'),
        )
        return
      }
      await aceptar()
      router.push('/municipios')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal.')
    } finally {
      setCargando(false)
    }
  }

  if (sesion && sesion.email.toLowerCase() === email.toLowerCase()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Te invitaron a {municipio}</CardTitle>
          <CardDescription>
            Hola {sesion.nombre}. Acepta para empezar a trabajar en este municipio.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <Button
            className="h-11"
            disabled={cargando}
            onClick={async () => {
              setCargando(true)
              try {
                await aceptar()
                router.push('/municipios')
                router.refresh()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Algo salió mal.')
              } finally {
                setCargando(false)
              }
            }}
          >
            {cargando && <Loader2Icon className="animate-spin" aria-hidden />} Aceptar invitación
          </Button>
        </CardContent>
      </Card>
    )
  }
  if (sesion) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Esta invitación es para otro correo</CardTitle>
          <CardDescription>
            La invitación es para <strong>{email}</strong> y tu sesión es de {sesion.email}. Cierra
            sesión y vuelve a abrir el enlace.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Crea tu cuenta para {municipio}</CardTitle>
        <CardDescription>
          Tu correo será <strong>{email}</strong>. Elige una contraseña de al menos 12 caracteres.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={crearCuenta} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="name">Tu nombre completo</Label>
            <Input
              id="name"
              name="name"
              required
              minLength={3}
              autoComplete="name"
              className="h-11 text-base"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="cargo">Cargo en el municipio (opcional)</Label>
            <Input
              id="cargo"
              name="cargo"
              autoComplete="organization-title"
              className="h-11 text-base"
              placeholder="Ej. Auxiliar de la Unidad de Transparencia"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="password">Contraseña</Label>
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
          <Button type="submit" className="h-11" disabled={cargando}>
            {cargando && <Loader2Icon className="animate-spin" aria-hidden />} Crear cuenta y entrar
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
