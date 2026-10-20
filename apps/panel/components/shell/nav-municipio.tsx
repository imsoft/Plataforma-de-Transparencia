'use client'
import { cn } from '@plataforma/ui/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type EnlaceNav = { href: string; etiqueta: string; exacto?: boolean }

export function NavMunicipio({ enlaces }: { enlaces: EnlaceNav[] }) {
  const ruta = usePathname()
  return (
    <nav
      aria-label="Secciones del municipio"
      className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <ul className="flex min-w-max gap-1 border-b">
        {enlaces.map((e) => {
          const activo = e.exacto
            ? ruta === e.href
            : ruta === e.href || ruta.startsWith(`${e.href}/`)
          return (
            <li key={e.href}>
              <Link
                href={e.href}
                aria-current={activo ? 'page' : undefined}
                className={cn(
                  'inline-flex h-11 items-center border-b-2 px-3 text-sm font-medium transition-colors',
                  activo
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {e.etiqueta}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
