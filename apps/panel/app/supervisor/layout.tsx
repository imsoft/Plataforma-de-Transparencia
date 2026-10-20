import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ThemeToggle } from '@/components/shell/theme-toggle'
import { UserMenu } from '@/components/shell/user-menu'
import { env } from '@/lib/env'
import { requireTwoFactor } from '@/lib/municipality'
import { requireSession } from '@/lib/session'

export default async function SupervisorLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession()
  if (!s.isSuperadmin && !s.memberships.some((m) => m.role === 'supervisor')) notFound()
  requireTwoFactor(s, '/supervisor')
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
            <ThemeToggle />
            <UserMenu
              name={s.name}
              email={s.email}
              role={s.isSuperadmin ? 'Superadministrador' : 'Supervisor'}
              multipleMunicipalities
              isSuperadmin={s.isSuperadmin}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </>
  )
}
