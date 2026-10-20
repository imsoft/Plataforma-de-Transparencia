'use client'
import { MenuIcon, XIcon } from 'lucide-react'
import Link from 'next/link'
import { useId, useState } from 'react'
import type { EnlaceMenu } from './tipos'

export function MenuMovil({ menu }: { menu: EnlaceMenu[] }) {
  const [abierto, setAbierto] = useState(false)
  const id = useId()
  return (
    <div className="ml-auto md:hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls={id}
        className="grid size-11 place-items-center rounded-md text-neutral-800 hover:bg-neutral-100"
      >
        {abierto ? <XIcon aria-hidden="true" /> : <MenuIcon aria-hidden="true" />}
        <span className="sr-only">{abierto ? 'Cerrar menú' : 'Abrir menú'}</span>
      </button>
      {abierto && (
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
                  onClick={() => setAbierto(false)}
                  className={`block rounded-md px-4 py-3 text-base font-medium ${e.href === '/transparencia' ? 'bg-primario-legible text-sobre-primario' : 'hover:bg-neutral-100'}`}
                >
                  {e.etiqueta}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
