import type { MetadataRoute } from 'next'
import { configSitio } from './config'
import { obtenerRutasSitemap } from './datos'

export type PaginaInstitucional = { ruta: string; prioridad?: number }

/** Crea la función `sitemap` de la app: páginas institucionales + todos los nodos de transparencia. */
export function crearSitemap(paginas: PaginaInstitucional[]) {
  return async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const { urlBase } = configSitio()
    const nodos = await obtenerRutasSitemap()
    return [
      ...paginas.map((p) => ({
        url: `${urlBase}${p.ruta}`,
        changeFrequency: 'monthly' as const,
        priority: p.prioridad ?? 0.7,
      })),
      ...nodos.map((n) => ({
        url: `${urlBase}${n.ruta}`,
        lastModified: n.actualizado,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ]
  }
}

export function crearRobots() {
  return function robots(): MetadataRoute.Robots {
    const { urlBase } = configSitio()
    return {
      rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/og/'] }],
      sitemap: `${urlBase}/sitemap.xml`,
    }
  }
}

/** GET /.well-known/security.txt */
export function crearSecurityTxt(contacto: string) {
  return function GET(): Response {
    const expira = new Date(Date.now() + 365 * 86400000).toISOString()
    return new Response(
      `Contact: mailto:${contacto}\nPreferred-Languages: es, en\nExpires: ${expira}\n`,
      { headers: { 'content-type': 'text/plain; charset=utf-8' } },
    )
  }
}
