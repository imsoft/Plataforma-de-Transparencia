import { ChevronRightIcon } from 'lucide-react'
import Link from 'next/link'

export type Miga = { href?: string; etiqueta: string }

export function Migas({ migas }: { migas: Miga[] }) {
  return (
    <nav aria-label="Ubicación" className="text-sm text-neutral-600">
      <ol className="flex flex-wrap items-center gap-1">
        {migas.map((m, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRightIcon className="size-3.5" aria-hidden="true" />}
            {m.href ? (
              <Link href={m.href} className="hover:underline">
                {m.etiqueta}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-neutral-900">
                {m.etiqueta}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
