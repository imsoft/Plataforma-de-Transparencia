import { ChevronRightIcon } from 'lucide-react'
import Link from 'next/link'

export type Crumb = { href?: string; label: string }

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Ubicación" className="text-sm text-neutral-600">
      <ol className="flex flex-wrap items-center gap-1">
        {crumbs.map((m, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRightIcon className="size-3.5" aria-hidden="true" />}
            {m.href ? (
              <Link href={m.href} className="hover:underline">
                {m.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-neutral-900">
                {m.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
