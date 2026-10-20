'use client'
import { MenuIcon, XIcon } from 'lucide-react'
import Link from 'next/link'
import { useId, useState } from 'react'
import type { MenuLink } from './types'

export function MobileMenu({ menu }: { menu: MenuLink[] }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className="ml-auto md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="grid size-11 place-items-center rounded-md text-neutral-800 hover:bg-neutral-100"
      >
        {open ? <XIcon aria-hidden="true" /> : <MenuIcon aria-hidden="true" />}
        <span className="sr-only">{open ? 'Cerrar menú' : 'Abrir menú'}</span>
      </button>
      {open && (
        <nav
          id={id}
          aria-label="Principal"
          className="absolute inset-x-0 top-full z-40 border-b border-neutral-200 bg-white shadow-xl"
        >
          <ul className="flex flex-col p-2">
            {menu.map((e) => (
              <li key={e.href}>
                <Link
                  href={e.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-md px-4 py-3 text-base font-medium ${e.href === '/transparencia' ? 'bg-primario-legible text-sobre-primario' : 'hover:bg-neutral-100'}`}
                >
                  {e.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
