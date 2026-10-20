import type { Metadata } from 'next'
import { DIRECTORY } from '@/content/site'

export const metadata: Metadata = {
  title: 'Directorio',
  description: 'Funcionarios y áreas del Ayuntamiento con sus teléfonos y correos.',
}

export default function Directory() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold tracking-widest text-primario-legible uppercase">
        Ayuntamiento
      </p>
      <h1 className="font-heading mt-1 text-4xl font-bold tracking-tight text-neutral-900">
        Directorio
      </h1>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {DIRECTORY.map((p) => (
          <li key={p.jobTitle} className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              {p.jobTitle}
            </p>
            <p className="font-heading mt-1 text-lg font-semibold text-neutral-900">{p.name}</p>
            <div className="mt-2 text-sm text-neutral-600">
              {p.phone && (
                <a
                  href={`tel:${p.phone.replace(/\D/g, '')}`}
                  className="inline-flex min-h-6 items-center py-1 hover:underline"
                >
                  {p.phone}
                </a>
              )}
              {p.email && (
                <a href={`mailto:${p.email}`} className="block py-1 hover:underline">
                  {p.email}
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
