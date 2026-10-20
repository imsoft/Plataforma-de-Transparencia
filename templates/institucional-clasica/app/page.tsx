import { BuscadorPublico } from '@plataforma/transparencia/componentes/buscador-publico'
import { obtenerNodos, obtenerResumen } from '@plataforma/transparencia/next/datos'
import { rutaDeNodo } from '@plataforma/transparencia/rutas'
import { Accesos } from '@plataforma/ui-sitio/accesos'
import { Hero } from '@plataforma/ui-sitio/hero'
import {
  ArrowRightIcon,
  BuildingIcon,
  FileSearchIcon,
  PhoneIcon,
  ShieldCheckIcon,
  UsersIcon,
} from 'lucide-react'
import Link from 'next/link'
import { DIRECTORIO, PORTADA } from '@/contenido/sitio'
import { identidadDe, municipioOFallback } from '@/lib/sitio'

export const revalidate = 86400

const fecha = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(iso))
    : 'sin publicaciones'

export default async function Portada() {
  const m = await municipioOFallback()
  const identidad = identidadDe(m)
  const [resumen, ...porSujeto] = await Promise.all([
    obtenerResumen(),
    ...m.sujetos.map((s) => obtenerNodos(s.prefijo)),
  ])
  const buscables = m.sujetos.flatMap((s, i) =>
    (porSujeto[i] ?? [])
      .filter((n) => n.clave || n.rutaSlug)
      .map((n) => ({
        clave: n.clave,
        rutaSlug: n.rutaSlug,
        titulo: n.titulo,
        etiqueta: n.etiqueta,
        prefijo: s.prefijo,
        sujeto: s.prefijo ? s.nombre : 'Ayuntamiento',
      })),
  )

  return (
    <>
      <Hero
        eyebrow={`Gobierno de ${m.nombre}`}
        titulo={PORTADA.titulo}
        subtitulo={PORTADA.subtitulo}
        buscador={
          <BuscadorPublico
            nodos={buscables}
            sugerencias={['Nómina', 'Actas de cabildo', 'Presupuesto', 'Estados financieros']}
          />
        }
        panel={
          <div className="relative rounded-3xl bg-white/10 p-6 ring-1 ring-white/20 backdrop-blur-sm sm:p-8">
            <div className="flex items-center gap-4">
              {identidad.escudoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={identidad.escudoUrl}
                  alt=""
                  width={72}
                  height={72}
                  className="size-16 object-contain sm:size-[4.5rem]"
                />
              ) : (
                <span
                  className="grid size-16 place-items-center rounded-2xl bg-white/15 font-heading text-3xl font-bold"
                  aria-hidden="true"
                >
                  {m.nombre.slice(0, 1)}
                </span>
              )}
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase opacity-80">
                  Transparencia
                </p>
                <p className="font-heading text-lg font-semibold leading-tight">
                  {m.nombreOficial}
                </p>
              </div>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white/10 p-4">
                <dt className="text-xs opacity-80">Documentos públicos</dt>
                <dd className="font-heading mt-1 text-3xl font-bold tabular-nums">
                  {resumen.totalDocumentos.toLocaleString('es-MX')}
                </dd>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <dt className="text-xs opacity-80">Última actualización</dt>
                <dd className="font-heading mt-1 text-lg font-semibold leading-snug">
                  {fecha(resumen.ultimaActualizacion)}
                </dd>
              </div>
            </dl>
            <Link
              href="/transparencia"
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white font-semibold text-primario-legible shadow transition hover:bg-neutral-100"
            >
              Ver toda la información <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Link>
          </div>
        }
      />

      {resumen.destacadas.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-widest text-primario-legible uppercase">
                Lo más consultado
              </p>
              <h2 className="font-heading mt-1 text-3xl font-bold tracking-tight text-neutral-900">
                Información fundamental
              </h2>
            </div>
            <Link
              href="/transparencia"
              className="hidden items-center gap-1 text-sm font-semibold text-primario-legible hover:underline sm:inline-flex"
            >
              Índice completo <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {resumen.destacadas.map((d) => (
              <li key={`${d.prefijo}-${d.clave ?? d.rutaSlug}`}>
                <Link
                  href={rutaDeNodo(d.prefijo, d.clave, d.rutaSlug)}
                  className="group flex h-full items-start gap-4 rounded-2xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-px hover:border-neutral-300 hover:shadow-md"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primario-suave font-mono text-sm font-bold text-primario-legible">
                    {d.clave ?? '§'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-medium text-neutral-900 group-hover:text-primario-legible">
                      {d.titulo}
                    </span>
                    <span className="mt-1 block text-xs text-neutral-500">
                      {d.etiqueta}
                      {d.prefijo ? ` · ${d.prefijo.toUpperCase()}` : ''} · {d.documentos} documento
                      {d.documentos === 1 ? '' : 's'}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Accesos
        titulo="¿Qué necesitas hoy?"
        intro="Los accesos más usados por los vecinos. Todo lo que publicamos se queda con el municipio, no con las personas."
        accesos={[
          {
            href: '/transparencia',
            titulo: 'Transparencia',
            descripcion:
              'Presupuesto, nómina, actas de cabildo, contratos y toda la información fundamental.',
            icono: <FileSearchIcon className="size-6" />,
            destacado: true,
          },
          {
            href: '/directorio',
            titulo: 'Directorio',
            descripcion: 'Funcionarios, áreas y teléfonos del Ayuntamiento.',
            icono: <UsersIcon className="size-6" />,
          },
          {
            href: '/contacto',
            titulo: 'Contacto',
            descripcion: 'Dirección, horario y medios para comunicarte con nosotros.',
            icono: <PhoneIcon className="size-6" />,
          },
        ]}
      />

      <section className="bg-neutral-50">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-xs font-semibold tracking-widest text-primario-legible uppercase">
              Gobierno abierto
            </p>
            <h2 className="font-heading mt-2 text-3xl font-bold tracking-tight text-neutral-900 text-balance">
              Cada documento tiene un enlace permanente
            </h2>
            <p className="mt-3 max-w-prose leading-relaxed text-neutral-600">
              Puedes compartir cualquier sección o archivo con un enlace corto que nunca cambia,
              aunque el documento se actualice. Así se cita en solicitudes de información y en la
              Plataforma Nacional de Transparencia.
            </p>
            <ul className="mt-6 flex flex-col gap-3 text-sm text-neutral-700">
              <li className="flex items-start gap-3">
                <ShieldCheckIcon
                  className="mt-0.5 size-5 shrink-0 text-primario-legible"
                  aria-hidden="true"
                />{' '}
                Historial público de cambios: nada se borra, todo se puede rastrear.
              </li>
              <li className="flex items-start gap-3">
                <BuildingIcon
                  className="mt-0.5 size-5 shrink-0 text-primario-legible"
                  aria-hidden="true"
                />{' '}
                Información del Ayuntamiento
                {m.sujetos.length > 1
                  ? ` y de ${m.sujetos
                      .filter((s) => s.prefijo)
                      .map((s) => s.nombre)
                      .join(', ')}`
                  : ''}{' '}
                en un solo lugar.
              </li>
            </ul>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <p className="font-heading text-lg font-semibold text-neutral-900">Directorio</p>
            <ul className="mt-4 divide-y divide-neutral-200">
              {DIRECTORIO.slice(0, 4).map((p) => (
                <li key={p.cargo} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span>
                    <span className="block font-medium text-neutral-900">{p.cargo}</span>
                    <span className="block text-neutral-500">{p.nombre}</span>
                  </span>
                  {p.telefono && (
                    <span className="shrink-0 text-neutral-600 tabular-nums">{p.telefono}</span>
                  )}
                </li>
              ))}
            </ul>
            <Link
              href="/directorio"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primario-legible hover:underline"
            >
              Ver directorio completo <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
