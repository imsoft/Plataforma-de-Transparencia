import { z } from 'zod'

const esquema = z.object({
  MUNICIPIO_SLUG: z.string().regex(/^[a-z0-9-]{2,60}$/, 'MUNICIPIO_SLUG inválido'),
  NEXT_PUBLIC_SITIO_URL: z.string().url().default('http://localhost:3001'),
  REVALIDACION_SECRETO: z.string().min(16).optional(),
  NEXT_PUBLIC_PLATFORM_NAME: z.string().default('Plataforma de Transparencia'),
  NEXT_PUBLIC_PLATFORM_URL: z.string().url().default('https://imsoft.io'),
  ARCHIVOS_URL_PUBLICA: z.string().url(),
})

export type ConfigSitio = {
  municipioSlug: string
  /** Base pública del sitio (canónicas y OG). Sin diagonal final. */
  urlBase: string
  revalidacionSecreto: string | undefined
  nombrePlataforma: string
  urlPlataforma: string
  archivosUrlPublica: string
}

let _config: ConfigSitio | undefined

/** Configuración del sitio del municipio, validada una sola vez al arrancar. */
export function configSitio(): ConfigSitio {
  if (_config) return _config
  const r = esquema.safeParse(process.env)
  if (!r.success)
    throw new Error(
      `Configuración del sitio incompleta: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    )
  _config = {
    municipioSlug: r.data.MUNICIPIO_SLUG,
    urlBase: r.data.NEXT_PUBLIC_SITIO_URL.replace(/\/$/, ''),
    revalidacionSecreto: r.data.REVALIDACION_SECRETO,
    nombrePlataforma: r.data.NEXT_PUBLIC_PLATFORM_NAME,
    urlPlataforma: r.data.NEXT_PUBLIC_PLATFORM_URL,
    archivosUrlPublica: r.data.ARCHIVOS_URL_PUBLICA.replace(/\/$/, ''),
  }
  return _config
}
