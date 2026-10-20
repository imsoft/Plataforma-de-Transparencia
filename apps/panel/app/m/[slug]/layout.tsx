import { cssDeTema, temaSchema } from '@plataforma/tema'
import { Encabezado } from '@/components/shell/encabezado'
import { NavMunicipio, type EnlaceNav } from '@/components/shell/nav-municipio'
import { contextoMunicipio } from '@/lib/municipio'
import { segmentoPanel } from '@/lib/urls'

export default async function LayoutMunicipio({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const c = await contextoMunicipio(slug)
  const tema = temaSchema.safeParse(c.municipio.tema ?? {})
  const css = tema.success ? cssDeTema(tema.data, { oscuro: true }) : ''
  const base = `/m/${slug}`
  const enlaces: EnlaceNav[] = [
    { href: base, etiqueta: 'Inicio', exacto: true },
    ...c.municipio.sujetosObligados
      .filter((so) => so.activo)
      .map((so) => ({
        href: `${base}/${segmentoPanel(so)}`,
        etiqueta: so.prefijo ? so.nombre : 'Ayuntamiento',
      })),
    { href: `${base}/papelera`, etiqueta: 'Papelera' },
  ]
  if (c.puede('usuario:ver')) enlaces.push({ href: `${base}/usuarios`, etiqueta: 'Usuarios' })
  if (c.puede('redes_sociales:ver'))
    enlaces.push({ href: `${base}/redes-sociales`, etiqueta: 'Redes sociales' })
  if (c.puede('identidad:ver')) enlaces.push({ href: `${base}/identidad`, etiqueta: 'Identidad' })
  if (c.puede('exportacion:ver'))
    enlaces.push({ href: `${base}/exportaciones`, etiqueta: 'Exportación' })

  return (
    <>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <Encabezado c={c} />
      <div className="mx-auto w-full max-w-6xl px-4">
        <NavMunicipio enlaces={enlaces} />
      </div>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </>
  )
}
