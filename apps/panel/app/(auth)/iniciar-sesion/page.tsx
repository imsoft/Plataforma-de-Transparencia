import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { SignInForm } from './form'

export const metadata: Metadata = { title: 'Iniciar sesión' }

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  if (await getSession()) redirect('/municipios')
  const { returnTo } = await searchParams
  return <SignInForm returnTo={returnTo && returnTo.startsWith('/') ? returnTo : '/municipios'} />
}
