import type { Metadata } from 'next'
import { FormularioVerificar } from './formulario'

export const metadata: Metadata = { title: 'Verificación en dos pasos' }

export default async function PaginaVerificar({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>
}) {
  const { volver } = await searchParams
  return <FormularioVerificar volver={volver && volver.startsWith('/') ? volver : '/municipios'} />
}
