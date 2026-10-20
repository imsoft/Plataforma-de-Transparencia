import { Button } from '@platform/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@platform/ui/components/card'
import { allMunicipalities } from '@platform/db/queries/session'
import { BuildingIcon, ChevronRightIcon, ShieldIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SignOut } from '@/components/sign-out'
import { requireSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Elige un municipio' }

const ROLE_NAME: Record<string, string> = {
  municipal_admin: 'Administrador',
  uploader: 'Capturista',
  supervisor: 'Supervisor',
}

export default async function MunicipalitiesPage() {
  const session = await requireSession()
  const list = session.isSuperadmin
    ? (await allMunicipalities()).map((m) => ({ ...m, role: 'superadmin' }))
    : session.municipalities.map((m) => ({ ...m.municipality, role: m.role }))

  if (!session.isSuperadmin && list.length === 1) redirect(`/m/${list[0]!.slug}`)

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Hola, {session.name.split(' ')[0]}</h1>
          <p className="text-muted-foreground">¿En qué municipio vas a trabajar hoy?</p>
        </div>
        <SignOut />
      </header>

      {list.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Todavía no tienes municipios</CardTitle>
            <CardDescription>
              Pide al administrador de tu municipio que te invite con este correo: {session.email}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <ul className="flex flex-col gap-3">
        {list.map((m) => (
          <li key={m.id}>
            <Link
              href={`/m/${m.slug}`}
              className="flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted"
                aria-hidden
              >
                <BuildingIcon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{m.officialName}</span>
                <span className="block text-sm text-muted-foreground">
                  {ROLE_NAME[m.role] ?? m.role}
                  {m.status === 'panel_suspended' && ' · panel suspendido'}
                </span>
              </span>
              <ChevronRightIcon className="size-5 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      {!session.isSuperadmin && session.memberships.some((m) => m.role === 'supervisor') && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="font-medium">Tablero de municipios</p>
              <p className="text-sm text-muted-foreground">
                Avance, semáforo y pendientes de todos tus municipios
              </p>
            </div>
            <Button variant="outline" nativeButton={false} render={<Link href="/supervisor" />}>
              Abrir
            </Button>
          </CardContent>
        </Card>
      )}
      {session.isSuperadmin && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3">
              <ShieldIcon className="size-5 text-muted-foreground" aria-hidden />
              <div>
                <p className="font-medium">Administración de la plataforma</p>
                <p className="text-sm text-muted-foreground">
                  Municipios, índice de la ley y supervisores
                </p>
              </div>
            </div>
            <Button variant="outline" nativeButton={false} render={<Link href="/admin" />}>
              Abrir
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
