import type { Metadata } from 'next'
import { VerifyForm } from './form'

export const metadata: Metadata = { title: 'Verificación en dos pasos' }

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { returnTo } = await searchParams
  return <VerifyForm returnTo={returnTo && returnTo.startsWith('/') ? returnTo : '/municipios'} />
}
