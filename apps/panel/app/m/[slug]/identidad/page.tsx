import { urlPublica } from '@plataforma/archivos'
import { TEMA_PLATAFORMA, temaSchema } from '@plataforma/tema'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FormularioIdentidad } from '@/components/identidad/formulario'
import { contextoMunicipio } from '@/lib/municipio'

export const metadata: Metadata = { title: 'Identidad' }

export default async function PaginaIdentidad({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await contextoMunicipio(slug)
  if (!c.puede('identidad:ver')) notFound()
  const t = temaSchema.safeParse(c.municipio.tema ?? {})
  const tema = t.success ? t.data : TEMA_PLATAFORMA
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Identidad del municipio</h1>
        <p className="text-sm text-muted-foreground">
          Colores, escudo y datos de contacto. Los cambios se ven en el sitio público y en el panel
          al momento, sin tocar los documentos ni sus enlaces.
        </p>
      </div>
      <FormularioIdentidad
        slug={slug}
        tema={tema}
        escudoUrl={c.municipio.tema?.escudoRuta ? urlPublica(c.municipio.tema.escudoRuta) : null}
        logoUrl={
          c.municipio.tema?.logoAdministracionRuta
            ? urlPublica(c.municipio.tema.logoAdministracionRuta)
            : null
        }
        contacto={c.municipio.datosContacto}
        puedeEditar={c.puede('identidad:editar')}
      />
    </div>
  )
}
