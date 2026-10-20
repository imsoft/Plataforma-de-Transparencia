import type { Metadata } from 'next'
import { ResetPasswordForm } from './form'

export const metadata: Metadata = { title: 'Nueva contraseña' }

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  const { token, error } = await searchParams
  return (
    <ResetPasswordForm
      token={token ?? null}
      initialError={error ? 'El enlace no es válido o ya venció. Pide uno nuevo.' : null}
    />
  )
}
