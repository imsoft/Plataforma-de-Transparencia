import { ArrowUpRightIcon } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

export type QuickLink = {
  href: string
  title: string
  description: string
  icon: ReactNode
  featured?: boolean
}

export function QuickLinks({
  title,
  intro,
  quickLinks,
}: {
  title: string
  intro?: string
  quickLinks: QuickLink[]
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <h2 className="font-heading text-3xl font-bold tracking-tight text-neutral-900">{title}</h2>
        {intro && <p className="max-w-md text-neutral-600">{intro}</p>}
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((a) => (
          <li key={a.href}>
            <Link
              href={a.href}
              className={`group flex h-full flex-col gap-5 rounded-2xl border p-6 transition hover:-translate-y-0.5 hover:shadow-lg ${a.featured ? 'border-transparent bg-primario-legible text-sobre-primario' : 'border-neutral-200 bg-white hover:border-neutral-300'}`}
            >
              <span
                className={`grid size-12 place-items-center rounded-xl ${a.featured ? 'bg-white/15' : 'bg-primario-suave text-primario-legible'}`}
                aria-hidden="true"
              >
                {a.icon}
              </span>
              <span className="flex flex-1 flex-col gap-1">
                <span className="font-heading text-xl font-semibold">{a.title}</span>
                <span
                  className={`text-sm leading-relaxed ${a.featured ? 'opacity-90' : 'text-neutral-600'}`}
                >
                  {a.description}
                </span>
              </span>
              <span
                className={`inline-flex items-center gap-1 text-sm font-semibold ${a.featured ? '' : 'text-primario-legible'}`}
              >
                Entrar{' '}
                <ArrowUpRightIcon
                  className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
