import '@plataforma/ui/globals.css'
import { cssDeTema, temaSchema } from '@plataforma/tema'
import { configSitio } from '@plataforma/transparencia/next/config'
import { jsonLdOrganizacion } from '@plataforma/transparencia/next/metadatos'
import { Encabezado } from '@plataforma/ui-sitio/encabezado'
import { Pie } from '@plataforma/ui-sitio/pie'
import type { Metadata } from 'next'
import { Bricolage_Grotesque, Source_Sans_3 } from 'next/font/google'
import { MENU } from '@/contenido/sitio'
import { identidadDe, municipioOFallback, redesDelAyuntamiento } from '@/lib/sitio'

// Display con carácter para títulos; cuerpo neutro y muy legible en celulares.
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
})
const cuerpo = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
})

export async function generateMetadata(): Promise<Metadata> {
  const m = await municipioOFallback()
  const { urlBase } = configSitio()
  return {
    metadataBase: new URL(urlBase),
    title: { default: m.nombreOficial, template: `%s | ${m.nombreOficial}` },
    description: `Sitio oficial del ${m.nombreOficial}: trámites, servicios y transparencia.`,
    openGraph: { siteName: m.nombreOficial, locale: 'es_MX', type: 'website' },
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const m = await municipioOFallback()
  const tema = temaSchema.safeParse(m.tema ?? {})
  const css = tema.success ? cssDeTema(tema.data) : ''
  return (
    <html lang="es-MX" className={`${display.variable} ${cuerpo.variable} font-sans antialiased`}>
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrganizacion(m)) }}
        />
        <Encabezado identidad={identidadDe(m)} menu={MENU} />
        <main id="contenido">{children}</main>
        <Pie identidad={identidadDe(m)} menu={MENU} redes={redesDelAyuntamiento(m)} />
      </body>
    </html>
  )
}
