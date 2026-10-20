import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { FormularioInicioSesion } from './formulario'

export const metadata: Metadata = { title: 'Iniciar sesión' }

export default async function PaginaInicioSesion({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>
}) {
  if (await obtenerSesion()) redirect('/municipios')
  const { volver } = await searchParams
  return (
    <FormularioInicioSesion volver={volver && volver.startsWith('/') ? volver : '/municipios'} />
  )
}
