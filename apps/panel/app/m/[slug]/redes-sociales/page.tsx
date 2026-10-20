import { asc, withUser, eq, socialNetworks } from '@platform/db'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { NetworksManager } from '@/components/networks/manager'
import { municipalityContext } from '@/lib/municipality'

export const metadata: Metadata = { title: 'Redes sociales' }

export default async function NetworksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await municipalityContext(slug)
  if (!c.can('socialNetworks:view')) notFound()
  const networks = await withUser(c.ctx, (tx) =>
    tx.query.socialNetworks.findMany({
      where: eq(socialNetworks.municipalityId, c.municipality.id),
      orderBy: [asc(socialNetworks.order)],
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
      <NetworksManager
        slug={slug}
        networks={networks.map((r) => ({
          id: r.id,
          obligatedSubjectId: r.obligatedSubjectId,
          network: r.network,
          otherName: r.otherName,
          url: r.url,
          text: r.text,
          visible: r.visible,
          hideDuringBlackout: r.hideDuringBlackout,
        }))}
        subjects={c.municipality.obligatedSubjects
          .filter((s) => s.active)
          .map((s) => ({
            id: s.id,
            name: s.prefix ? s.name : 'Ayuntamiento',
            root: s.prefix === '',
          }))}
        canEdit={c.can('socialNetworks:edit')}
        officialName={c.municipality.officialName}
      />
    </div>
  )
}
