import '@platform/ui/globals.css'
import { themeCss, themeSchema } from '@platform/theme'
import { siteConfig } from '@platform/transparency/next/config'
import { organizationJsonLd } from '@platform/transparency/next/metadata'
import { Header } from '@platform/ui-site/header'
import { Footer } from '@platform/ui-site/footer'
import type { Metadata } from 'next'
import { Bricolage_Grotesque, Source_Sans_3 } from 'next/font/google'
import { MENU } from '@/content/site'
import { identityOf, municipalityOrFallback, cityHallNetworks } from '@/lib/site'

// Display con carácter para títulos; cuerpo neutro y muy legible en celulares.
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
})
const body = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
})

export async function generateMetadata(): Promise<Metadata> {
  const m = await municipalityOrFallback()
  const { baseUrl } = siteConfig()
  return {
    metadataBase: new URL(baseUrl),
    title: { default: m.officialName, template: `%s | ${m.officialName}` },
    description: `Sitio oficial del ${m.officialName}: trámites, servicios y transparencia.`,
    openGraph: { siteName: m.officialName, locale: 'es_MX', type: 'website' },
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const m = await municipalityOrFallback()
  const theme = themeSchema.safeParse(m.theme ?? {})
  const css = theme.success ? themeCss(theme.data) : ''
  return (
    <html lang="es-MX" className={`${display.variable} ${body.variable} font-sans antialiased`}>
      <head>{css && <style dangerouslySetInnerHTML={{ __html: css }} />}</head>
      <body className="min-h-dvh bg-white text-neutral-900">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2"
        >
          Ir al contenido
        </a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd(m)) }}
        />
        <Header identity={identityOf(m)} menu={MENU} />
        <main id="contenido">{children}</main>
        <Footer identity={identityOf(m)} menu={MENU} networks={cityHallNetworks(m)} />
      </body>
    </html>
  )
}
