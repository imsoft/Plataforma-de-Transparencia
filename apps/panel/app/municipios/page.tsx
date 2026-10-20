import { Button } from '@plataforma/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@plataforma/ui/components/card'
import { todosLosMunicipios } from '@plataforma/db/consultas/sesion'
import { BuildingIcon, ChevronRightIcon, ShieldIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CerrarSesion } from '@/components/cerrar-sesion'
import { exigirSesion } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Elige un municipio' }

const NOMBRE_ROL: Record<string, string> = {
  admin_municipal: 'Administrador',
  capturista: 'Capturista',
  supervisor: 'Supervisor',
}

export default async function PaginaMunicipios() {
  const sesion = await exigirSesion()
  const lista = sesion.esSuperadmin
    ? (await todosLosMunicipios()).map((m) => ({ ...m, rol: 'superadmin' }))
    : sesion.municipios.map((m) => ({ ...m.municipio, rol: m.rol }))

  if (!sesion.esSuperadmin && lista.length === 1) redirect(`/m/${lista[0]!.slug}`)

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Hola, {sesion.nombre.split(' ')[0]}</h1>
          <p className="text-muted-foreground">¿En qué municipio vas a trabajar hoy?</p>
        </div>
        <CerrarSesion />
      </header>

      {lista.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Todavía no tienes municipios</CardTitle>
            <CardDescription>
              Pide al administrador de tu municipio que te invite con este correo: {sesion.email}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <ul className="flex flex-col gap-3">
        {lista.map((m) => (
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
                <span className="block truncate font-medium">{m.nombreOficial}</span>
                <span className="block text-sm text-muted-foreground">
                  {NOMBRE_ROL[m.rol] ?? m.rol}
                  {m.estatus === 'panel_suspendido' && ' · panel suspendido'}
                </span>
              </span>
              <ChevronRightIcon className="size-5 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      {!sesion.esSuperadmin && sesion.membresias.some((m) => m.rol === 'supervisor') && (
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
      {sesion.esSuperadmin && (
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
