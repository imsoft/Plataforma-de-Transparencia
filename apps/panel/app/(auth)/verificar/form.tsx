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
import { useState } from 'react'
import { authClient } from '@/lib/auth-client'

export function VerifyForm({ returnTo }: { returnTo: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useBackup, setUseBackup] = useState(false)

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const code = field(new FormData(e.currentTarget), 'code').replace(/\s/g, '')
    const r = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice: true })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice: true })
    setLoading(false)
    if (r.error) {
      setError(
        useBackup
          ? 'Ese código de respaldo no es válido.'
          : 'El código no es válido o ya venció. Revisa la hora de tu teléfono e intenta de nuevo.',
      )
      return
    }
    router.push(returnTo)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verificación en dos pasos</CardTitle>
        <CardDescription>
          {useBackup
            ? 'Escribe uno de tus códigos de respaldo.'
            : 'Escribe el código de 6 dígitos de tu aplicación de autenticación.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={send} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="code">{useBackup ? 'Código de respaldo' : 'Código'}</Label>
            <Input
              id="code"
              name="code"
              inputMode={useBackup ? 'text' : 'numeric'}
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
          <Button type="submit" size="lg" disabled={loading} className="h-11">
            {loading && <Loader2Icon className="animate-spin" aria-hidden />}
            Verificar
          </Button>
          <Button type="button" variant="link" onClick={() => setUseBackup((v) => !v)}>
            {useBackup
              ? 'Usar el código de la aplicación'
              : 'No tengo mi teléfono: usar código de respaldo'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
