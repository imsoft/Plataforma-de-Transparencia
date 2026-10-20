import { RedesSociales } from '@plataforma/ui-sitio/redes-sociales'
import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from 'lucide-react'
import type { Metadata } from 'next'
import { municipioOFallback, redesDelAyuntamiento } from '@/lib/sitio'

export const metadata: Metadata = {
  title: 'Contacto',
  description: 'Dirección, teléfono, horario y redes sociales oficiales.',
}
export const revalidate = 86400

export default async function Contacto() {
  const m = await municipioOFallback()
  const c = m.datosContacto
  const datos = [
    c.direccion && { icono: MapPinIcon, etiqueta: 'Dirección', valor: c.direccion },
    c.telefono && {
      icono: PhoneIcon,
      etiqueta: 'Teléfono',
      valor: c.telefono,
      href: `tel:${c.telefono.replace(/\D/g, '')}`,
    },
    c.correo && {
      icono: MailIcon,
      etiqueta: 'Correo',
      valor: c.correo,
      href: `mailto:${c.correo}`,
    },
    c.horario && { icono: ClockIcon, etiqueta: 'Horario', valor: c.horario },
  ].filter(Boolean) as {
    icono: typeof MapPinIcon
    etiqueta: string
    valor: string
    href?: string
  }[]
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold tracking-widest text-primario-legible uppercase">
        {m.nombreOficial}
      </p>
      <h1 className="font-heading mt-1 text-4xl font-bold tracking-tight text-neutral-900">
        Contacto
      </h1>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {datos.map((d) => (
          <li
            key={d.etiqueta}
            className="flex items-start gap-4 rounded-2xl border border-neutral-200 bg-white p-5"
          >
            <span
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-primario-suave text-primario-legible"
              aria-hidden="true"
            >
              <d.icono className="size-5" />
            </span>
            <span>
              <span className="block text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                {d.etiqueta}
              </span>
              {d.href ? (
                <a
                  href={d.href}
                  className="mt-0.5 inline-flex min-h-6 items-center text-lg font-medium text-neutral-900 hover:underline"
                >
                  {d.valor}
                </a>
              ) : (
                <span className="mt-0.5 block text-lg font-medium text-neutral-900">{d.valor}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <h2 className="font-heading mt-10 text-2xl font-semibold text-neutral-900">
        Redes sociales oficiales
      </h2>
      <RedesSociales
        redes={redesDelAyuntamiento(m)}
        nombreSujeto={m.nombreOficial}
        className="mt-3"
      />
    </div>
  )
}
