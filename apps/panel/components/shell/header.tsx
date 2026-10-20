import { publicUrl } from '@platform/files'
import Link from 'next/link'
import type { MunicipalityContext } from '@/lib/municipality'
import { env } from '@/lib/env'
import { ThemeToggle } from './theme-toggle'
import { UserMenu } from './user-menu'

const ROLE_NAME: Record<string, string> = {
  superadmin: 'Superadministrador',
  municipal_admin: 'Administrador del municipio',
  uploader: 'Capturista',
  supervisor: 'Supervisor',
}

export function Header({ c }: { c: MunicipalityContext }) {
  const { municipality: m, session } = c
  const coatOfArms = m.theme?.coatOfArmsPath ? publicUrl(m.theme.coatOfArmsPath) : null
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link
          href={`/m/${m.slug}`}
          className="flex min-w-0 items-center gap-2.5"
          aria-label={`Inicio de ${m.officialName}`}
        >
          {coatOfArms ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coatOfArms} alt="" className="size-9 rounded-md object-contain" />
          ) : (
            <span
              className="flex size-9 items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground"
              aria-hidden
            >
              {m.name.slice(0, 1)}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-tight">{m.name}</span>
            <span className="hidden truncate text-xs text-muted-foreground sm:block">
              {env.NEXT_PUBLIC_PLATFORM_NAME}
            </span>
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <UserMenu
            name={session.name}
            email={session.email}
            role={ROLE_NAME[c.role] ?? c.role}
            multipleMunicipalities={session.municipalities.length > 1 || session.isSuperadmin}
            isSuperadmin={session.isSuperadmin}
          />
        </div>
      </div>
    </header>
  )
}
