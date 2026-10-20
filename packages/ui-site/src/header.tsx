import { ArrowRightIcon, MailIcon, PhoneIcon } from 'lucide-react'
import Link from 'next/link'
import { MobileMenu } from './mobile-menu'
import type { MenuLink, SiteIdentity } from './types'

/** Encabezado "institucional clásico": barra superior de contacto, escudo protagonista, menú y acceso directo a transparencia. */
export function Header({ identity, menu }: { identity: SiteIdentity; menu: MenuLink[] }) {
  const c = identity.contact
  return (
    <header className="relative z-40 bg-white">
      <div className="bg-primario-legible text-sobre-primario">
        <div className="mx-auto flex h-9 max-w-6xl items-center justify-between gap-4 px-4 text-xs sm:px-6">
          <p className="truncate font-medium tracking-wide uppercase">
            Gobierno Municipal · Jalisco
          </p>
          <div className="hidden items-center gap-5 sm:flex">
            {c.phone && (
              <a
                href={`tel:${c.phone.replace(/\D/g, '')}`}
                className="inline-flex items-center gap-1.5 opacity-90 hover:opacity-100"
              >
                <PhoneIcon className="size-3.5" aria-hidden="true" /> {c.phone}
              </a>
            )}
            {c.email && (
              <a
                href={`mailto:${c.email}`}
                className="inline-flex items-center gap-1.5 opacity-90 hover:opacity-100"
              >
                <MailIcon className="size-3.5" aria-hidden="true" /> {c.email}
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="border-b border-neutral-200">
        <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center gap-4 px-4 sm:px-6 md:h-20">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3"
            aria-label={`Inicio · ${identity.officialName}`}
          >
            {identity.coatOfArmsUrl ? (
              <img
                src={identity.coatOfArmsUrl}
                alt=""
                width={56}
                height={56}
                className="size-12 object-contain md:size-14"
              />
            ) : (
              <span
                className="grid size-12 place-items-center rounded-xl bg-primario-legible font-heading text-xl font-bold text-sobre-primario md:size-14"
                aria-hidden="true"
              >
                {identity.name.slice(0, 1)}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate font-heading text-lg font-semibold leading-tight tracking-tight text-neutral-900 md:text-xl">
                {identity.officialName}
              </span>
              <span className="hidden text-xs text-neutral-500 sm:block">Sitio oficial</span>
            </span>
          </Link>
          <nav aria-label="Principal" className="ml-auto hidden md:block">
            <ul className="flex items-center gap-1">
              {menu
                .filter((e) => e.href !== '/transparencia')
                .map((e) => (
                  <li key={e.href}>
                    <Link
                      href={e.href}
                      className="inline-flex h-11 items-center rounded-md px-3 text-[0.9375rem] font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                    >
                      {e.label}
                    </Link>
                  </li>
                ))}
              <li className="pl-2">
                <Link
                  href="/transparencia"
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-primario-legible px-4 text-[0.9375rem] font-semibold text-sobre-primario shadow-sm transition hover:brightness-110"
                >
                  Transparencia <ArrowRightIcon className="size-4" aria-hidden="true" />
                </Link>
              </li>
            </ul>
          </nav>
          <MobileMenu menu={menu} />
        </div>
      </div>
    </header>
  )
}
