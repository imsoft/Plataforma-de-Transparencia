import { todosLosMunicipios } from '@plataforma/db/consultas/sesion'
import { Button } from '@plataforma/ui/components/button'
import { Badge } from '@plataforma/ui/components/badge'
import { PlusIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { BotonSuspender } from '@/components/admin/suspender'

export const metadata: Metadata = { title: 'Municipios' }

export default async function PaginaAdmin() {
  const lista = await todosLosMunicipios()
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Municipios</h1>
          <p className="text-sm text-muted-foreground">
            Alta, identidad y estado del panel de cada municipio.
          </p>
        </div>
        <Button
          nativeButton={false}
          render={<Link href="/admin/municipios/nuevo" />}
          className="h-11"
        >
          <PlusIcon aria-hidden /> Dar de alta municipio
        </Button>
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {lista.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {m.nombreOficial}{' '}
                {m.estatus === 'panel_suspendido' && (
                  <Badge variant="destructive">Panel suspendido</Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">/{m.slug}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/m/${m.slug}`} />}
            >
              Abrir panel
            </Button>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/m/${m.slug}/identidad`} />}
            >
              Identidad
            </Button>
            <BotonSuspender municipioId={m.id} suspendido={m.estatus === 'panel_suspendido'} />
          </li>
        ))}
      </ul>
    </div>
  )
}
