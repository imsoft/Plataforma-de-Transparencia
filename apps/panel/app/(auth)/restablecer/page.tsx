import type { Metadata } from 'next'
import { FormularioRestablecer } from './formulario'

export const metadata: Metadata = { title: 'Nueva contraseña' }

export default async function PaginaRestablecer({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  const { token, error } = await searchParams
  return (
    <FormularioRestablecer
      token={token ?? null}
      errorInicial={error ? 'El enlace no es válido o ya venció. Pide uno nuevo.' : null}
    />
  )
}
