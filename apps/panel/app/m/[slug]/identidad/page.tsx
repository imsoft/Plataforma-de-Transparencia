import { publicUrl } from '@platform/files'
import { PLATFORM_THEME, themeSchema } from '@platform/theme'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { IdentityForm } from '@/components/identity/form'
import { municipalityContext } from '@/lib/municipality'

export const metadata: Metadata = { title: 'Identidad' }

export default async function IdentityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await municipalityContext(slug)
  if (!c.can('identity:view')) notFound()
  const t = themeSchema.safeParse(c.municipality.theme ?? {})
  const theme = t.success ? t.data : PLATFORM_THEME
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Identidad del municipio</h1>
        <p className="text-sm text-muted-foreground">
          Colores, escudo y datos de contacto. Los cambios se ven en el sitio público y en el panel
          al momento, sin tocar los documentos ni sus enlaces.
        </p>
      </div>
      <IdentityForm
        slug={slug}
        theme={theme}
        coatOfArmsUrl={
          c.municipality.theme?.coatOfArmsPath
            ? publicUrl(c.municipality.theme.coatOfArmsPath)
            : null
        }
        logoUrl={
          c.municipality.theme?.administrationLogoPath
            ? publicUrl(c.municipality.theme.administrationLogoPath)
            : null
        }
        contact={c.municipality.contactInfo}
        canEdit={c.can('identity:edit')}
      />
    </div>
  )
}
