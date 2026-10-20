import type { Metadata } from 'next'
import { _tipos } from '@/acciones/admin'
import { FormularioMunicipio } from '@/components/admin/formulario-municipio'

export const metadata: Metadata = { title: 'Nuevo municipio' }

export default async function PaginaNuevoMunicipio() {
  const tipos = await _tipos()
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Dar de alta municipio</h1>
        <p className="text-sm text-muted-foreground">
          Crea el registro en la base de datos. Después genera su app con{' '}
          <code>pnpm nuevo-municipio</code> usando el mismo identificador.
        </p>
      </div>
      <FormularioMunicipio tipos={tipos.map((t) => ({ slug: t.slug, nombre: t.nombre }))} />
    </div>
  )
}
