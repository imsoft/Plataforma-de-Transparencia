import { exigirSuperadmin } from '@plataforma/auth'
import Link from 'next/link'
import { NavMunicipio } from '@/components/shell/nav-municipio'
import { CambiarTema } from '@/components/shell/cambiar-tema'
import { MenuUsuario } from '@/components/shell/menu-usuario'
import { env } from '@/lib/env'
import { exigirDosPasos } from '@/lib/municipio'
import { exigirSesion } from '@/lib/sesion'

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const s = await exigirSesion()
  exigirSuperadmin(s)
  exigirDosPasos(s, '/admin')
  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span
              className="flex size-9 items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground"
              aria-hidden
            >
              T
            </span>
            <span className="text-sm font-semibold">
              {env.NEXT_PUBLIC_PLATFORM_NAME} · Administración
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <CambiarTema />
            <MenuUsuario
              nombre={s.nombre}
              email={s.email}
              rol="Superadministrador"
              variosMunicipios
              esSuperadmin
            />
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl px-4">
        <NavMunicipio
          enlaces={[
            { href: '/admin', etiqueta: 'Municipios', exacto: true },
            { href: '/admin/indice', etiqueta: 'Índice de la ley' },
            { href: '/admin/supervisores', etiqueta: 'Supervisores' },
          ]}
        />
      </div>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </>
  )
}
