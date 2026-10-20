import { asc, conUsuario, eq, redesSociales } from '@plataforma/db'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GestorRedes } from '@/components/redes/gestor'
import { contextoMunicipio } from '@/lib/municipio'

export const metadata: Metadata = { title: 'Redes sociales' }

export default async function PaginaRedes({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await contextoMunicipio(slug)
  if (!c.puede('redes_sociales:ver')) notFound()
  const redes = await conUsuario(c.ctx, (tx) =>
    tx.query.redesSociales.findMany({
      where: eq(redesSociales.municipioId, c.municipio.id),
      orderBy: [asc(redesSociales.orden)],
    }),
  )
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Redes sociales</h1>
        <p className="text-sm text-muted-foreground">
          Las cuentas oficiales que aparecen en el sitio. Agrega las que tenga el municipio; el DIF
          puede tener las suyas.
        </p>
      </div>
      <GestorRedes
        slug={slug}
        redes={redes.map((r) => ({
          id: r.id,
          sujetoObligadoId: r.sujetoObligadoId,
          red: r.red,
          nombreOtra: r.nombreOtra,
          url: r.url,
          texto: r.texto,
          visible: r.visible,
          ocultarEnVeda: r.ocultarEnVeda,
        }))}
        sujetos={c.municipio.sujetosObligados
          .filter((s) => s.activo)
          .map((s) => ({
            id: s.id,
            nombre: s.prefijo ? s.nombre : 'Ayuntamiento',
            raiz: s.prefijo === '',
          }))}
        puedeEditar={c.puede('redes_sociales:editar')}
        nombreOficial={c.municipio.nombreOficial}
      />
    </div>
  )
}
