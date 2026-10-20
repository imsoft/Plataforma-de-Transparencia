import type { ReactNode } from 'react'
import { Pattern } from './pattern'

/**
 * Portada institucional: titular grande, buscador de transparencia y un panel con cifras reales.
 * El color viene del tema; la trama diagonal da textura sin imágenes.
 */
export function Hero({
  eyebrow,
  title,
  subtitle,
  search,
  panel,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  search?: ReactNode
  panel?: ReactNode
}) {
  return (
    <section className="relative isolate overflow-hidden bg-primario-legible text-sobre-primario">
      <Pattern className="opacity-[0.07]" />
      <div
        className="absolute -top-40 -right-40 size-[32rem] rounded-full bg-white/10 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.25fr_0.9fr] md:items-center md:py-20">
        <div className="flex flex-col gap-6">
          {eyebrow && (
            <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-80">{eyebrow}</p>
          )}
          <h1 className="font-heading text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          {subtitle && (
            <p className="max-w-xl text-base leading-relaxed opacity-90 md:text-lg">{subtitle}</p>
          )}
          {search}
        </div>
        {panel && <div className="relative">{panel}</div>}
      </div>
    </section>
  )
}
