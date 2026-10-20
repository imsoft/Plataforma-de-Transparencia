import type { Metadata } from 'next'
import { requireSession } from '@/lib/session'
import { TwoFactorSetup } from './setup'

export const metadata: Metadata = { title: 'Verificación en dos pasos' }

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const s = await requireSession()
  const { returnTo } = await searchParams
  return (
    <TwoFactorSetup
      active={s.twoFactorEnabled}
      email={s.email}
      returnTo={returnTo && returnTo.startsWith('/') ? returnTo : '/municipios'}
    />
  )
}
