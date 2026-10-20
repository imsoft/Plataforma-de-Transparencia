import { themeCss, themeSchema } from '@platform/theme'
import { Header } from '@/components/shell/header'
import { MunicipalityNav, type NavLink } from '@/components/shell/municipality-nav'
import { municipalityContext } from '@/lib/municipality'
import { panelSegment } from '@/lib/urls'

export default async function MunicipalityLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const c = await municipalityContext(slug)
  const theme = themeSchema.safeParse(c.municipality.theme ?? {})
  const css = theme.success ? themeCss(theme.data, { dark: true }) : ''
  const base = `/m/${slug}`
  const links: NavLink[] = [
    { href: base, label: 'Inicio', exact: true },
    ...c.municipality.obligatedSubjects
      .filter((so) => so.active)
      .map((so) => ({
        href: `${base}/${panelSegment(so)}`,
        label: so.prefix ? so.name : 'Ayuntamiento',
      })),
    { href: `${base}/papelera`, label: 'Papelera' },
  ]
  if (c.can('user:view')) links.push({ href: `${base}/usuarios`, label: 'Usuarios' })
  if (c.can('socialNetworks:view'))
    links.push({ href: `${base}/redes-sociales`, label: 'Redes sociales' })
  if (c.can('identity:view')) links.push({ href: `${base}/identidad`, label: 'Identidad' })
  if (c.can('exportJob:view')) links.push({ href: `${base}/exportaciones`, label: 'Exportación' })

  return (
    <>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <Header c={c} />
      <div className="mx-auto w-full max-w-6xl px-4">
        <MunicipalityNav links={links} />
      </div>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </>
  )
}
