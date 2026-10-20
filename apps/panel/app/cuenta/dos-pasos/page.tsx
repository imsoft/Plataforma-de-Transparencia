import type { Metadata } from 'next'
import { exigirSesion } from '@/lib/sesion'
import { ConfigurarDosPasos } from './configurar'

export const metadata: Metadata = { title: 'Verificación en dos pasos' }

export default async function PaginaDosPasos({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>
}) {
  const s = await exigirSesion()
  const { volver } = await searchParams
  return (
    <ConfigurarDosPasos
      activa={s.twoFactorEnabled}
      email={s.email}
      volver={volver && volver.startsWith('/') ? volver : '/municipios'}
    />
  )
}
