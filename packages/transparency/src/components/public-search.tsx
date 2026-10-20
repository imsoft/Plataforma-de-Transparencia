'use client'
import { normalizeKey } from '@platform/law-index'
import { ArrowRightIcon, SearchIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useMemo, useState } from 'react'
import { nodeRoute } from '../routes'

export type SearchableNode = {
  key: string | null
  routeSlug: string | null
  title: string
  label: string
  prefix: string
  subject: string
}

const withoutAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Buscador del índice para ciudadanos: por clave (8.5a) o por palabras. Sin JavaScript, el formulario manda a /transparencia. */
export function PublicSearch({
  nodes,
  suggestions = [],
  dark = true,
}: {
  nodes: SearchableNode[]
  suggestions?: string[]
  dark?: boolean
}) {
  const router = useRouter()
  const id = useId()
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const results = useMemo(() => {
    const t = text.trim()
    if (t.length < 2) return []
    const key = normalizeKey(t)
    const words = withoutAccents(t).split(/\s+/).filter(Boolean)
    return nodes
      .map((n) => {
        let p = 0
        if (key && n.key === key) p += 100
        else if (key && n.key?.startsWith(key)) p += 40
        const h = withoutAccents(`${n.title} ${n.label}`)
        if (words.every((w) => h.includes(w))) p += 20 + words.length * 5
        return { n, p }
      })
      .filter((r) => r.p > 0)
      .sort((a, b) => b.p - a.p)
      .slice(0, 6)
  }, [text, nodes])
  const goTo = (n: SearchableNode) => router.push(nodeRoute(n.prefix, n.key, n.routeSlug))
  const open = focused && results.length > 0

  return (
    <div className="relative w-full max-w-xl">
      <form
        role="search"
        action="/transparencia"
        onSubmit={(e) => {
          e.preventDefault()
          if (results[0]) goTo(results[0].n)
          else router.push('/transparencia')
        }}
        className="flex h-14 items-center gap-2 rounded-2xl bg-white p-1.5 pl-4 text-neutral-900 shadow-lg ring-1 ring-black/5"
      >
        <SearchIcon className="size-5 shrink-0 text-neutral-400" aria-hidden="true" />
        <label htmlFor={id} className="sr-only">
          Buscar en transparencia
        </label>
        <input
          id={id}
          name="q"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          placeholder="Busca: nómina, actas de cabildo, presupuesto, 8.5a…"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={`${id}-lista`}
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-neutral-400"
        />
        <button
          type="submit"
          className="grid h-11 shrink-0 place-items-center rounded-xl bg-primario-legible px-4 text-sm font-semibold text-sobre-primario hover:brightness-110"
        >
          <span className="hidden sm:inline">Buscar</span>
          <ArrowRightIcon className="size-5 sm:hidden" aria-hidden="true" />
        </button>
      </form>
      {open && (
        <ul
          id={`${id}-lista`}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl bg-white text-neutral-900 shadow-2xl ring-1 ring-black/5"
        >
          {results.map(({ n }) => (
            <li key={`${n.prefix}-${n.key ?? n.routeSlug}`} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => goTo(n)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-primario-suave/70"
              >
                <span className="w-14 shrink-0 font-mono text-sm font-semibold text-primario-legible">
                  {n.key ?? '—'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{n.title}</span>
                  <span className="block text-xs text-neutral-500">
                    {n.label} · {n.subject}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {suggestions.length > 0 && (
        <ul
          className={`mt-3 flex flex-wrap gap-2 text-sm ${dark ? 'text-white/90' : 'text-neutral-600'}`}
          aria-label="Búsquedas frecuentes"
        >
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => (setText(s), setFocused(true))}
                className={`rounded-full px-3 py-1.5 transition ${dark ? 'bg-white/10 hover:bg-white/20' : 'bg-neutral-100 hover:bg-neutral-200'}`}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
