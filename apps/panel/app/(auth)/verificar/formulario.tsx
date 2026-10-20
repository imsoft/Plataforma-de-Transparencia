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

export function FormularioVerificar({ volver }: { volver: string }) {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usarRespaldo, setUsarRespaldo] = useState(false)

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    const code = campo(new FormData(e.currentTarget), 'code').replace(/\s/g, '')
    const r = usarRespaldo
      ? await authCliente.twoFactor.verifyBackupCode({ code, trustDevice: true })
      : await authCliente.twoFactor.verifyTotp({ code, trustDevice: true })
    setCargando(false)
    if (r.error) {
      setError(
        usarRespaldo
          ? 'Ese código de respaldo no es válido.'
          : 'El código no es válido o ya venció. Revisa la hora de tu teléfono e intenta de nuevo.',
      )
      return
    }
    router.push(volver)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verificación en dos pasos</CardTitle>
        <CardDescription>
          {usarRespaldo
            ? 'Escribe uno de tus códigos de respaldo.'
            : 'Escribe el código de 6 dígitos de tu aplicación de autenticación.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="code">{usarRespaldo ? 'Código de respaldo' : 'Código'}</Label>
            <Input
              id="code"
              name="code"
              inputMode={usarRespaldo ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              required
              autoFocus
              className="h-12 text-center text-2xl tracking-[0.4em]"
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
          <Button type="submit" size="lg" disabled={cargando} className="h-11">
            {cargando && <Loader2Icon className="animate-spin" aria-hidden />}
            Verificar
          </Button>
          <Button type="button" variant="link" onClick={() => setUsarRespaldo((v) => !v)}>
            {usarRespaldo
              ? 'Usar el código de la aplicación'
              : 'No tengo mi teléfono: usar código de respaldo'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
