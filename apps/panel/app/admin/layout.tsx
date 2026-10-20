import { requireSuperadmin } from '@platform/auth'
import Link from 'next/link'
import { MunicipalityNav } from '@/components/shell/municipality-nav'
import { ThemeToggle } from '@/components/shell/theme-toggle'
import { UserMenu } from '@/components/shell/user-menu'
import { env } from '@/lib/env'
import { requireTwoFactor } from '@/lib/municipality'
import { requireSession } from '@/lib/session'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession()
  requireSuperadmin(s)
  requireTwoFactor(s, '/admin')
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
            <ThemeToggle />
            <UserMenu
              name={s.name}
              email={s.email}
              role="Superadministrador"
              multipleMunicipalities
              isSuperadmin
            />
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl px-4">
        <MunicipalityNav
          links={[
            { href: '/admin', label: 'Municipios', exact: true },
            { href: '/admin/indice', label: 'Índice de la ley' },
            { href: '/admin/supervisores', label: 'Supervisores' },
          ]}
        />
      </div>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </>
  )
}
