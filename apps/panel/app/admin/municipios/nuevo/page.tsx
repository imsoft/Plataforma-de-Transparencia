import type { Metadata } from 'next'
import { _types } from '@/actions/admin'
import { MunicipalityForm } from '@/components/admin/municipality-form'

export const metadata: Metadata = { title: 'Nuevo municipio' }

export default async function NewMunicipalityPage() {
  const types = await _types()
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Dar de alta municipio</h1>
        <p className="text-sm text-muted-foreground">
          Crea el registro en la base de datos. Después genera su app con{' '}
          <code>pnpm new-municipality</code> usando el mismo identificador.
        </p>
      </div>
      <MunicipalityForm types={types.map((t) => ({ slug: t.slug, name: t.name }))} />
    </div>
  )
}
