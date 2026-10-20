import { headers } from 'next/headers'
import Link from 'next/link'
import { normalizarClave } from '@plataforma/indice'
import { obtenerMunicipio, obtenerNodos } from './datos'
import { rutaDeNodo } from '../rutas'

/** Página 404 útil: enlaces principales y, si la ruta parece una clave, sugerencias. */
export async function NoEncontrado({ ruta }: { ruta?: string } = {}) {
  const m = await obtenerMunicipio()
  const pedida = ruta ?? (await headers()).get('x-ruta') ?? ''
  const ultimo = pedida.split('/').filter(Boolean).pop() ?? ''
  const clave = normalizarClave(ultimo)
  let sugerencias: { href: string; texto: string }[] = []
  if (clave && m) {
    const nodos = await obtenerNodos('')
    sugerencias = nodos
      .filter(
        (n) => n.clave && (n.clave.startsWith(clave.slice(0, 2)) || clave.startsWith(n.clave)),
      )
      .slice(0, 5)
      .map((n) => ({ href: rutaDeNodo('', n.clave, null), texto: `${n.clave} · ${n.titulo}` }))
  }
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <p className="font-mono text-sm text-primario-legible">404</p>
      <h1 className="mt-2 text-3xl font-bold text-neutral-900">No encontramos esa página</h1>
      <p className="mt-2 text-neutral-600">
        Puede que el enlace esté mal escrito o que la página ya no exista.
      </p>
      {sugerencias.length > 0 && (
        <div className="mt-8 text-left">
          <p className="font-medium">¿Buscabas alguna de estas secciones?</p>
          <ul className="mt-2 divide-y rounded-xl border bg-white">
            {sugerencias.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="block px-4 py-3 hover:bg-primario-suave/60">
                  {s.texto}
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
