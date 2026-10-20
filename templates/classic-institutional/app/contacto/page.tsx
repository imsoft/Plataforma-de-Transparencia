import { SocialNetworks } from '@platform/ui-site/social-networks'
import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from 'lucide-react'
import type { Metadata } from 'next'
import { municipalityOrFallback, cityHallNetworks } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Contacto',
  description: 'Dirección, teléfono, horario y redes sociales oficiales.',
}
export const revalidate = 86400

export default async function Contact() {
  const m = await municipalityOrFallback()
  const c = m.contactInfo
  const data = [
    c.address && { icon: MapPinIcon, label: 'Dirección', value: c.address },
    c.phone && {
      icon: PhoneIcon,
      label: 'Teléfono',
      value: c.phone,
      href: `tel:${c.phone.replace(/\D/g, '')}`,
    },
    c.email && {
      icon: MailIcon,
      label: 'Correo',
      value: c.email,
      href: `mailto:${c.email}`,
    },
    c.hours && { icon: ClockIcon, label: 'Horario', value: c.hours },
  ].filter(Boolean) as {
    icon: typeof MapPinIcon
    label: string
    value: string
    href?: string
  }[]
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold tracking-widest text-primario-legible uppercase">
        {m.officialName}
      </p>
      <h1 className="font-heading mt-1 text-4xl font-bold tracking-tight text-neutral-900">
        Contacto
      </h1>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {data.map((d) => (
          <li
            key={d.label}
            className="flex items-start gap-4 rounded-2xl border border-neutral-200 bg-white p-5"
          >
            <span
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-primario-suave text-primario-legible"
              aria-hidden="true"
            >
              <d.icon className="size-5" />
            </span>
            <span>
              <span className="block text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                {d.label}
              </span>
              {d.href ? (
                <a
                  href={d.href}
                  className="mt-0.5 inline-flex min-h-6 items-center text-lg font-medium text-neutral-900 hover:underline"
                >
                  {d.value}
                </a>
              ) : (
                <span className="mt-0.5 block text-lg font-medium text-neutral-900">{d.value}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <h2 className="font-heading mt-10 text-2xl font-semibold text-neutral-900">
        Redes sociales oficiales
      </h2>
      <SocialNetworks
        networks={cityHallNetworks(m)}
        subjectName={m.officialName}
        className="mt-3"
      />
    </div>
  )
}
