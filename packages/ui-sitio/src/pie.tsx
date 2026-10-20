import Link from 'next/link'
import { RedesSociales } from './redes-sociales'
import type { EnlaceMenu, IdentidadSitio, RedSocialSitio } from './tipos'

export function Pie({
  identidad,
  menu,
  redes,
}: {
  identidad: IdentidadSitio
  menu: EnlaceMenu[]
  redes: RedSocialSitio[]
}) {
  const c = identidad.contacto
  return (
    <footer className="mt-20 bg-neutral-950 text-neutral-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            {identidad.escudoUrl ? (
              <img
                src={identidad.escudoUrl}
                alt=""
                width={48}
                height={48}
                className="size-12 object-contain brightness-0 invert opacity-90"
              />
            ) : (
              <span
                className="grid size-12 place-items-center rounded-xl bg-white/10 font-heading text-lg font-bold text-white"
                aria-hidden="true"
              >
                {identidad.nombre.slice(0, 1)}
              </span>
            )}
            <p className="font-heading text-lg font-semibold text-white">
              {identidad.nombreOficial}
            </p>
          </div>
          <address className="flex flex-col gap-1 text-sm not-italic leading-relaxed">
            {c.direccion && <span>{c.direccion}</span>}
            {c.telefono && (
              <a
                href={`tel:${c.telefono.replace(/\D/g, '')}`}
                className="inline-flex min-h-6 items-center py-1 hover:text-white"
              >
                Tel. {c.telefono}
              </a>
            )}
            {c.correo && (
              <a
                href={`mailto:${c.correo}`}
                className="inline-flex min-h-6 items-center py-1 hover:text-white"
              >
                {c.correo}
              </a>
            )}
            {c.horario && <span>{c.horario}</span>}
          </address>
        </div>
        <nav aria-label="Pie de página">
          <p className="mb-3 text-xs font-semibold tracking-widest text-neutral-400 uppercase">
            Navegación
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {menu.map((e) => (
              <li key={e.href}>
                <Link href={e.href} className="inline-block py-1.5 hover:text-white">
                  {e.etiqueta}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/aviso-de-privacidad" className="inline-block py-1.5 hover:text-white">
                Aviso de privacidad
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <p className="mb-3 text-xs font-semibold tracking-widest text-neutral-400 uppercase">
            Síguenos
          </p>
          <RedesSociales redes={redes} nombreSujeto={identidad.nombreOficial} oscuro />
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-neutral-400 sm:px-6">
          © {new Date().getFullYear()} {identidad.nombreOficial}. Desarrollado por{' '}
          <a
            href={identidad.urlPlataforma}
            className="underline-offset-2 hover:text-neutral-300 hover:underline"
            rel="noopener"
          >
            {identidad.nombrePlataforma}
          </a>
          .
        </p>
      </div>
    </footer>
  )
}
