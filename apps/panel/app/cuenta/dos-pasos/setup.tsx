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
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'

type Step = 'start' | 'scan' | 'backup' | 'disable'

export function TwoFactorSetup({
  active,
  email,
  returnTo,
}: {
  active: boolean
  email: string
  returnTo: string
}) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(active ? 'disable' : 'start')
  const [loading, setLoading] = useState(false)
  const [uri, setUri] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (uri) void QRCode.toDataURL(uri, { width: 220, margin: 1 }).then(setQr)
  }, [uri])

  async function enable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const password = field(new FormData(e.currentTarget), 'password')
    const r = await authClient.twoFactor.enable({
      password,
      issuer: 'Plataforma de Transparencia',
    })
    setLoading(false)
    if (r.error || r.data.method !== 'totp') return setError('La contraseña no es correcta.')
    setUri(r.data.totpURI)
    setBackupCodes(r.data.backupCodes)
    setStep('scan')
  }

  async function confirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const code = field(new FormData(e.currentTarget), 'code').replace(/\s/g, '')
    const r = await authClient.twoFactor.verifyTotp({ code, trustDevice: true })
    setLoading(false)
    if (r.error)
      return setError(
        'El código no coincide. Revisa que la hora del teléfono sea automática e intenta de nuevo.',
      )
    setStep('backup')
  }

  async function disable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const r = await authClient.twoFactor.disable({
      password: field(new FormData(e.currentTarget), 'password'),
    })
    setLoading(false)
    if (r.error) return setError('La contraseña no es correcta.')
    toast('Verificación en dos pasos desactivada')
    router.push('/cuenta')
    router.refresh()
  }

  const secret = uri ? new URL(uri).searchParams.get('secret') : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verificación en dos pasos</CardTitle>
        <CardDescription>
          {step === 'start' &&
            'Necesitas una aplicación de autenticación en tu teléfono (Google Authenticator, Microsoft Authenticator o Authy). Es gratis.'}
          {step === 'scan' &&
            'Paso 2 de 3 · Abre la aplicación, toca "Agregar" y escanea este código.'}
          {step === 'backup' &&
            'Paso 3 de 3 · Guarda estos códigos de respaldo. Sirven si pierdes el teléfono. Cada uno se usa una vez.'}
          {step === 'disable' &&
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

        {step === 'start' && (
          <form onSubmit={enable} className="flex flex-col gap-3">
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
            <Button type="submit" className="h-11" disabled={loading}>
              {loading && <Loader2Icon className="animate-spin" aria-hidden />} Continuar
            </Button>
          </form>
        )}

        {step === 'scan' && (
          <form onSubmit={confirm} className="flex flex-col gap-4">
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
                <code className="mt-1 block break-all font-mono text-sm">{secret}</code>
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
            <Button type="submit" className="h-11" disabled={loading}>
              {loading && <Loader2Icon className="animate-spin" aria-hidden />} Confirmar
            </Button>
          </form>
        )}

        {step === 'backup' && (
          <div className="flex flex-col gap-4">
            <ul className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-4 font-mono text-sm">
              {backupCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  navigator.clipboard
                    .writeText(backupCodes.join('\n'))
                    .then(() => toast.success('Códigos copiados'))
                }
              >
                Copiar códigos
              </Button>
              <Button
                className="h-11"
                onClick={() => {
                  toast.success('Verificación en dos pasos activada')
                  router.push(returnTo)
                  router.refresh()
                }}
              >
                Ya los guardé, continuar
              </Button>
            </div>
          </div>
        )}

        {step === 'disable' && (
          <form onSubmit={disable} className="flex flex-col gap-3">
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
              disabled={loading}
            >
              Desactivar verificación en dos pasos
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
