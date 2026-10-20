import { allMunicipalities } from '@platform/db/queries/session'
import { Button } from '@platform/ui/components/button'
import { Badge } from '@platform/ui/components/badge'
import { PlusIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SuspendButton } from '@/components/admin/suspend'

export const metadata: Metadata = { title: 'Municipios' }

export default async function AdminPage() {
  const list = await allMunicipalities()
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
        {list.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {m.officialName}{' '}
                {m.status === 'panel_suspended' && (
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
            <SuspendButton municipalityId={m.id} suspended={m.status === 'panel_suspended'} />
          </li>
        ))}
      </ul>
    </div>
  )
}
