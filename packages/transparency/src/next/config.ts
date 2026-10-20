import { z } from 'zod'

const schema = z.object({
  MUNICIPALITY_SLUG: z.string().regex(/^[a-z0-9-]{2,60}$/, 'MUNICIPALITY_SLUG inválido'),
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3001'),
  REVALIDATION_SECRET: z.string().min(16).optional(),
  NEXT_PUBLIC_PLATFORM_NAME: z.string().default('Plataforma de Transparencia'),
  NEXT_PUBLIC_PLATFORM_URL: z.string().url().default('https://imsoft.io'),
  FILES_PUBLIC_URL: z.string().url(),
})

export type SiteConfig = {
  municipalitySlug: string
  /** Base pública del sitio (canónicas y OG). Sin diagonal final. */
  baseUrl: string
  revalidationSecret: string | undefined
  platformName: string
  platformUrl: string
  filesPublicUrl: string
}

let _config: SiteConfig | undefined

/** Configuración del sitio del municipio, validada una sola vez al arrancar. */
export function siteConfig(): SiteConfig {
  if (_config) return _config
  const r = schema.safeParse(process.env)
  if (!r.success)
    throw new Error(
      `Configuración del sitio incompleta: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    )
  _config = {
    municipalitySlug: r.data.MUNICIPALITY_SLUG,
    baseUrl: r.data.NEXT_PUBLIC_SITE_URL.replace(/\/$/, ''),
    revalidationSecret: r.data.REVALIDATION_SECRET,
    platformName: r.data.NEXT_PUBLIC_PLATFORM_NAME,
    platformUrl: r.data.NEXT_PUBLIC_PLATFORM_URL,
    filesPublicUrl: r.data.FILES_PUBLIC_URL.replace(/\/$/, ''),
  }
  return _config
}
