'use client'
import { normalizarClave } from '@plataforma/indice'
import { ArrowRightIcon, SearchIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useMemo, useState } from 'react'
import { rutaDeNodo } from '../rutas'

export type NodoBuscable = {
  clave: string | null
  rutaSlug: string | null
  titulo: string
  etiqueta: string
  prefijo: string
  sujeto: string
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Buscador del índice para ciudadanos: por clave (8.5a) o por palabras. Sin JavaScript, el formulario manda a /transparencia. */
export function BuscadorPublico({
  nodos,
  sugerencias = [],
  oscuro = true,
}: {
  nodos: NodoBuscable[]
  sugerencias?: string[]
  oscuro?: boolean
}) {
  const router = useRouter()
  const id = useId()
  const [texto, setTexto] = useState('')
  const [foco, setFoco] = useState(false)
  const resultados = useMemo(() => {
    const t = texto.trim()
    if (t.length < 2) return []
    const clave = normalizarClave(t)
    const palabras = sinAcentos(t).split(/\s+/).filter(Boolean)
    return nodos
      .map((n) => {
        let p = 0
        if (clave && n.clave === clave) p += 100
        else if (clave && n.clave?.startsWith(clave)) p += 40
        const h = sinAcentos(`${n.titulo} ${n.etiqueta}`)
        if (palabras.every((w) => h.includes(w))) p += 20 + palabras.length * 5
        return { n, p }
      })
      .filter((r) => r.p > 0)
      .sort((a, b) => b.p - a.p)
      .slice(0, 6)
  }, [texto, nodos])
  const irA = (n: NodoBuscable) => router.push(rutaDeNodo(n.prefijo, n.clave, n.rutaSlug))
  const abierto = foco && resultados.length > 0

  return (
    <div className="relative w-full max-w-xl">
      <form
        role="search"
        action="/transparencia"
        onSubmit={(e) => {
          e.preventDefault()
          if (resultados[0]) irA(resultados[0].n)
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
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => setFoco(true)}
          onBlur={() => setTimeout(() => setFoco(false), 120)}
          placeholder="Busca: nómina, actas de cabildo, presupuesto, 8.5a…"
          autoComplete="off"
          aria-expanded={abierto}
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
      {abierto && (
        <ul
          id={`${id}-lista`}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl bg-white text-neutral-900 shadow-2xl ring-1 ring-black/5"
        >
          {resultados.map(({ n }) => (
            <li key={`${n.prefijo}-${n.clave ?? n.rutaSlug}`} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => irA(n)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-primario-suave/70"
              >
                <span className="w-14 shrink-0 font-mono text-sm font-semibold text-primario-legible">
                  {n.clave ?? '—'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{n.titulo}</span>
                  <span className="block text-xs text-neutral-500">
                    {n.etiqueta} · {n.sujeto}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {sugerencias.length > 0 && (
        <ul
          className={`mt-3 flex flex-wrap gap-2 text-sm ${oscuro ? 'text-white/90' : 'text-neutral-600'}`}
          aria-label="Búsquedas frecuentes"
        >
          {sugerencias.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => (setTexto(s), setFoco(true))}
                className={`rounded-full px-3 py-1.5 transition ${oscuro ? 'bg-white/10 hover:bg-white/20' : 'bg-neutral-100 hover:bg-neutral-200'}`}
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
