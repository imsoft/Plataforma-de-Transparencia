import { headers } from 'next/headers'
import Link from 'next/link'
import { normalizeKey } from '@platform/law-index'
import { getMunicipality, getNodes } from './data'
import { nodeRoute } from '../routes'

/** Página 404 útil: enlaces principales y, si la ruta parece una clave, sugerencias. */
export async function NotFoundPage({ path }: { path?: string } = {}) {
  const m = await getMunicipality()
  const requested = path ?? (await headers()).get('x-ruta') ?? ''
  const last = requested.split('/').filter(Boolean).pop() ?? ''
  const key = normalizeKey(last)
  let suggestions: { href: string; text: string }[] = []
  if (key && m) {
    const nodes = await getNodes('')
    suggestions = nodes
      .filter((n) => n.key && (n.key.startsWith(key.slice(0, 2)) || key.startsWith(n.key)))
      .slice(0, 5)
      .map((n) => ({ href: nodeRoute('', n.key, null), text: `${n.key} · ${n.title}` }))
  }
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <p className="font-mono text-sm text-primario-legible">404</p>
      <h1 className="mt-2 text-3xl font-bold text-neutral-900">No encontramos esa página</h1>
      <p className="mt-2 text-neutral-600">
        Puede que el enlace esté mal escrito o que la página ya no exista.
      </p>
      {suggestions.length > 0 && (
        <div className="mt-8 text-left">
          <p className="font-medium">¿Buscabas alguna de estas secciones?</p>
          <ul className="mt-2 divide-y rounded-xl border bg-white">
            {suggestions.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="block px-4 py-3 hover:bg-primario-suave/60">
                  {s.text}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-md bg-primario-legible px-5 font-medium text-sobre-primario"
        >
          Ir al inicio
        </Link>
        <Link
          href="/transparencia"
          className="inline-flex h-11 items-center rounded-md border px-5 font-medium"
        >
          Transparencia
        </Link>
      </div>
    </div>
  )
}
