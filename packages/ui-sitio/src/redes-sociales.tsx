import { etiquetaAccesible, redPorSlug } from '@plataforma/redes'
import { IconoRed } from './iconos-redes'
import type { RedSocialSitio } from './tipos'

export function RedesSociales({
  redes,
  nombreSujeto,
  className = '',
  oscuro = false,
}: {
  redes: RedSocialSitio[]
  nombreSujeto: string
  className?: string
  oscuro?: boolean
}) {
  if (redes.length === 0) return null
  const estilo = oscuro
    ? 'bg-white/10 text-white hover:bg-white hover:text-neutral-900'
    : 'bg-primario-suave text-primario-legible hover:bg-primario-legible hover:text-sobre-primario'
  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`} aria-label="Redes sociales">
      {redes.map((r, i) => {
        const red = redPorSlug(r.red)
        const etiqueta = etiquetaAccesible(
          red,
          r.texto ?? (r.red === 'otra' ? r.nombreOtra : null),
          nombreSujeto,
        )
        return (
          <li key={`${r.url}-${i}`}>
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={etiqueta}
              title={etiqueta}
              className={`grid size-11 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario-legible ${estilo}`}
            >
              <IconoRed slug={red.slug} className="size-5" />
            </a>
          </li>
        )
      })}
    </ul>
  )
}
