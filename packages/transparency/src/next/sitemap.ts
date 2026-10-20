import type { MetadataRoute } from 'next'
import { siteConfig } from './config'
import { getSitemapRoutes } from './data'

export type InstitutionalPage = { path: string; priority?: number }

/** Crea la función `sitemap` de la app: páginas institucionales + todos los nodos de transparencia. */
export function createSitemap(pages: InstitutionalPage[]) {
  return async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const { baseUrl } = siteConfig()
    const nodes = await getSitemapRoutes()
    return [
      ...pages.map((p) => ({
        url: `${baseUrl}${p.path}`,
        changeFrequency: 'monthly' as const,
        priority: p.priority ?? 0.7,
      })),
      ...nodes.map((n) => ({
        url: `${baseUrl}${n.path}`,
        lastModified: n.updated,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ]
  }
}

export function createRobots() {
  return function robots(): MetadataRoute.Robots {
    const { baseUrl } = siteConfig()
    return {
      rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/og/'] }],
      sitemap: `${baseUrl}/sitemap.xml`,
    }
  }
}

/** GET /.well-known/security.txt */
export function createSecurityTxt(contact: string) {
  return function GET(): Response {
    const expiresAt = new Date(Date.now() + 365 * 86400000).toISOString()
    return new Response(
      `Contact: mailto:${contact}\nPreferred-Languages: es, en\nExpires: ${expiresAt}\n`,
      { headers: { 'content-type': 'text/plain; charset=utf-8' } },
    )
  }
}
