'use client'
import { cn } from '@platform/ui/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type NavLink = { href: string; label: string; exact?: boolean }

export function MunicipalityNav({ links }: { links: NavLink[] }) {
  const path = usePathname()
  return (
    <nav
      aria-label="Secciones del municipio"
      className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <ul className="flex min-w-max gap-1 border-b">
        {links.map((e) => {
          const active = e.exact
            ? path === e.href
            : path === e.href || path.startsWith(`${e.href}/`)
          return (
            <li key={e.href}>
              <Link
                href={e.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex h-11 items-center border-b-2 px-3 text-sm font-medium transition-colors',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {e.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
