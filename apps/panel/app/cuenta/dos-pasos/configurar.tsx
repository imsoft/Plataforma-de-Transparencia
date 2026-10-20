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
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { authCliente } from '@/lib/auth-cliente'

type Paso = 'inicio' | 'escanear' | 'respaldo' | 'desactivar'

export function ConfigurarDosPasos({
  activa,
  email,
  volver,
}: {
  activa: boolean
  email: string
  volver: string
}) {
  const router = useRouter()
  const [paso, setPaso] = useState<Paso>(activa ? 'desactivar' : 'inicio')
  const [cargando, setCargando] = useState(false)
  const [uri, setUri] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [respaldo, setRespaldo] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (uri) void QRCode.toDataURL(uri, { width: 220, margin: 1 }).then(setQr)
  }, [uri])

  async function activar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    const password = campo(new FormData(e.currentTarget), 'password')
    const r = await authCliente.twoFactor.enable({
      password,
      issuer: 'Plataforma de Transparencia',
    })
    setCargando(false)
    if (r.error || r.data.method !== 'totp') return setError('La contraseña no es correcta.')
    setUri(r.data.totpURI)
    setRespaldo(r.data.backupCodes)
    setPaso('escanear')
  }

  async function confirmar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    const code = campo(new FormData(e.currentTarget), 'code').replace(/\s/g, '')
    const r = await authCliente.twoFactor.verifyTotp({ code, trustDevice: true })
    setCargando(false)
    if (r.error)
      return setError(
        'El código no coincide. Revisa que la hora del teléfono sea automática e intenta de nuevo.',
      )
    setPaso('respaldo')
  }

  async function desactivar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCargando(true)
    const r = await authCliente.twoFactor.disable({
      password: campo(new FormData(e.currentTarget), 'password'),
    })
    setCargando(false)
    if (r.error) return setError('La contraseña no es correcta.')
    toast('Verificación en dos pasos desactivada')
    router.push('/cuenta')
    router.refresh()
  }

  const secreto = uri ? new URL(uri).searchParams.get('secret') : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verificación en dos pasos</CardTitle>
        <CardDescription>
          {paso === 'inicio' &&
            'Necesitas una aplicación de autenticación en tu teléfono (Google Authenticator, Microsoft Authenticator o Authy). Es gratis.'}
          {paso === 'escanear' &&
            'Paso 2 de 3 · Abre la aplicación, toca "Agregar" y escanea este código.'}
          {paso === 'respaldo' &&
            'Paso 3 de 3 · Guarda estos códigos de respaldo. Sirven si pierdes el teléfono. Cada uno se usa una vez.'}
          {paso === 'desactivar' &&
            'La verificación está activa. Para desactivarla escribe tu contraseña.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {paso === 'inicio' && (
          <form onSubmit={activar} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="password">Confirma tu contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="h-11"
              />
            </div>
            <Button type="submit" className="h-11" disabled={cargando}>
              {cargando && <Loader2Icon className="animate-spin" aria-hidden />} Continuar
            </Button>
          </form>
        )}

        {paso === 'escanear' && (
          <form onSubmit={confirmar} className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2 rounded-lg border p-4">
              {}
              {qr ? (
                <img
                  src={qr}
                  alt="Código QR para la aplicación de autenticación"
                  width={220}
                  height={220}
                />
              ) : (
                <div className="size-[220px] animate-pulse rounded bg-muted" />
              )}
              <details className="text-center text-xs text-muted-foreground">
                <summary className="cursor-pointer">
                  ¿No puedes escanear? Escribe la clave a mano
                </summary>
                <code className="mt-1 block break-all font-mono text-sm">{secreto}</code>
                <span className="block">Cuenta: {email}</span>
              </details>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="code">Escribe el código de 6 dígitos que muestra la aplicación</Label>
              <Input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                className="h-12 text-center text-2xl tracking-[0.4em]"
              />
            </div>
            <Button type="submit" className="h-11" disabled={cargando}>
              {cargando && <Loader2Icon className="animate-spin" aria-hidden />} Confirmar
            </Button>
          </form>
        )}

        {paso === 'respaldo' && (
          <div className="flex flex-col gap-4">
            <ul className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-4 font-mono text-sm">
              {respaldo.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  navigator.clipboard
                    .writeText(respaldo.join('\n'))
                    .then(() => toast.success('Códigos copiados'))
                }
              >
                Copiar códigos
              </Button>
              <Button
                className="h-11"
                onClick={() => {
                  toast.success('Verificación en dos pasos activada')
                  router.push(volver)
                  router.refresh()
                }}
              >
                Ya los guardé, continuar
              </Button>
            </div>
          </div>
        )}

        {paso === 'desactivar' && (
          <form onSubmit={desactivar} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="h-11"
              />
            </div>
            <Button
              type="submit"
              variant="destructive"
              className="h-11 self-start"
              disabled={cargando}
            >
              Desactivar verificación en dos pasos
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
