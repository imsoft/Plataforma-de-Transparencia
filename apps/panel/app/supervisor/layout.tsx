import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CambiarTema } from '@/components/shell/cambiar-tema'
import { MenuUsuario } from '@/components/shell/menu-usuario'
import { env } from '@/lib/env'
import { exigirDosPasos } from '@/lib/municipio'
import { exigirSesion } from '@/lib/sesion'

export default async function LayoutSupervisor({ children }: { children: React.ReactNode }) {
  const s = await exigirSesion()
  if (!s.esSuperadmin && !s.membresias.some((m) => m.rol === 'supervisor')) notFound()
  exigirDosPasos(s, '/supervisor')
  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/supervisor" className="flex items-center gap-2.5">
            <span
              className="flex size-9 items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground"
              aria-hidden
            >
              T
            </span>
            <span className="text-sm font-semibold">{env.NEXT_PUBLIC_PLATFORM_NAME} · Tablero</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <CambiarTema />
            <MenuUsuario
              nombre={s.nombre}
              email={s.email}
              rol={s.esSuperadmin ? 'Superadministrador' : 'Supervisor'}
              variosMunicipios
              esSuperadmin={s.esSuperadmin}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </>
  )
}
