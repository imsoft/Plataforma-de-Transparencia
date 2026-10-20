import { PublicSearch } from '@platform/transparency/components/public-search'
import { getNodes, getSummary } from '@platform/transparency/next/data'
import { nodeRoute } from '@platform/transparency/routes'
import { QuickLinks } from '@platform/ui-site/quick-links'
import { Hero } from '@platform/ui-site/hero'
import {
  ArrowRightIcon,
  BuildingIcon,
  FileSearchIcon,
  PhoneIcon,
  ShieldCheckIcon,
  UsersIcon,
} from 'lucide-react'
import Link from 'next/link'
import { DIRECTORY, HOME } from '@/content/site'
import { identityOf, municipalityOrFallback } from '@/lib/site'

export const revalidate = 86400

const date = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(iso))
    : 'sin publicaciones'

export default async function Home() {
  const m = await municipalityOrFallback()
  const identity = identityOf(m)
  const [summary, ...bySubject] = await Promise.all([
    getSummary(),
    ...m.subjects.map((s) => getNodes(s.prefix)),
  ])
  const searchable = m.subjects.flatMap((s, i) =>
    (bySubject[i] ?? [])
      .filter((n) => n.key || n.routeSlug)
      .map((n) => ({
        key: n.key,
        routeSlug: n.routeSlug,
        title: n.title,
        label: n.label,
        prefix: s.prefix,
        subject: s.prefix ? s.name : 'Ayuntamiento',
      })),
  )

  return (
    <>
      <Hero
        eyebrow={`Gobierno de ${m.name}`}
        title={HOME.title}
        subtitle={HOME.subtitle}
        search={
          <PublicSearch
            nodes={searchable}
            suggestions={['Nómina', 'Actas de cabildo', 'Presupuesto', 'Estados financieros']}
          />
        }
        panel={
          <div className="relative rounded-3xl bg-white/10 p-6 ring-1 ring-white/20 backdrop-blur-sm sm:p-8">
            <div className="flex items-center gap-4">
              {identity.coatOfArmsUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={identity.coatOfArmsUrl}
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
                  {m.name.slice(0, 1)}
                </span>
              )}
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase opacity-80">
                  Transparencia
                </p>
                <p className="font-heading text-lg font-semibold leading-tight">{m.officialName}</p>
              </div>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white/10 p-4">
                <dt className="text-xs opacity-80">Documentos públicos</dt>
                <dd className="font-heading mt-1 text-3xl font-bold tabular-nums">
                  {summary.totalDocuments.toLocaleString('es-MX')}
                </dd>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <dt className="text-xs opacity-80">Última actualización</dt>
                <dd className="font-heading mt-1 text-lg font-semibold leading-snug">
                  {date(summary.lastUpdate)}
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

      {summary.featured.length > 0 && (
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
            {summary.featured.map((d) => (
              <li key={`${d.prefix}-${d.key ?? d.routeSlug}`}>
                <Link
                  href={nodeRoute(d.prefix, d.key, d.routeSlug)}
                  className="group flex h-full items-start gap-4 rounded-2xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-px hover:border-neutral-300 hover:shadow-md"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primario-suave font-mono text-sm font-bold text-primario-legible">
                    {d.key ?? '§'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-medium text-neutral-900 group-hover:text-primario-legible">
                      {d.title}
                    </span>
                    <span className="mt-1 block text-xs text-neutral-500">
                      {d.label}
                      {d.prefix ? ` · ${d.prefix.toUpperCase()}` : ''} · {d.documents} documento
                      {d.documents === 1 ? '' : 's'}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <QuickLinks
        title="¿Qué necesitas hoy?"
        intro="Los accesos más usados por los vecinos. Todo lo que publicamos se queda con el municipio, no con las personas."
        quickLinks={[
          {
            href: '/transparencia',
            title: 'Transparencia',
            description:
              'Presupuesto, nómina, actas de cabildo, contratos y toda la información fundamental.',
            icon: <FileSearchIcon className="size-6" />,
            featured: true,
          },
          {
            href: '/directorio',
            title: 'Directorio',
            description: 'Funcionarios, áreas y teléfonos del Ayuntamiento.',
            icon: <UsersIcon className="size-6" />,
          },
          {
            href: '/contacto',
            title: 'Contacto',
            description: 'Dirección, horario y medios para comunicarte con nosotros.',
            icon: <PhoneIcon className="size-6" />,
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
                {m.subjects.length > 1
                  ? ` y de ${m.subjects
                      .filter((s) => s.prefix)
                      .map((s) => s.name)
                      .join(', ')}`
                  : ''}{' '}
                en un solo lugar.
              </li>
            </ul>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <p className="font-heading text-lg font-semibold text-neutral-900">Directorio</p>
            <ul className="mt-4 divide-y divide-neutral-200">
              {DIRECTORY.slice(0, 4).map((p) => (
                <li
                  key={p.jobTitle}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <span>
                    <span className="block font-medium text-neutral-900">{p.jobTitle}</span>
                    <span className="block text-neutral-500">{p.name}</span>
                  </span>
                  {p.phone && (
                    <span className="shrink-0 text-neutral-600 tabular-nums">{p.phone}</span>
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
