/** Cliente S3 (RustFS en local, Cloudflare R2 en producción). Se configura solo por variables de entorno. */
import { S3Client } from '@aws-sdk/client-s3'
import { z } from 'zod'

const schema = z.object({
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('false'),
  FILES_PUBLIC_URL: z.string().url(),
})

export type FilesConfig = {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
  /** Base pública (dominio de archivos) desde la que se sirven los archivos publicados. */
  publicUrl: string
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): FilesConfig {
  const r = schema.safeParse(env)
  if (!r.success)
    throw new Error(
      `Configuración de archivos incompleta: ${r.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    )
  const e = r.data
  return {
    endpoint: e.S3_ENDPOINT,
    region: e.S3_REGION,
    bucket: e.S3_BUCKET,
    accessKeyId: e.S3_ACCESS_KEY_ID,
    secretAccessKey: e.S3_SECRET_ACCESS_KEY,
    forcePathStyle: e.S3_FORCE_PATH_STYLE === 'true',
    publicUrl: e.FILES_PUBLIC_URL.replace(/\/$/, ''),
  }
}

let _client: S3Client | undefined
let _config: FilesConfig | undefined

export function s3Client(config: FilesConfig = configFromEnv()): {
  s3: S3Client
  config: FilesConfig
} {
  if (!_client || _config !== config) {
    _config = config
    _client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      // Sin checksums automáticos (CRC32) en las URLs firmadas: ni R2 ni RustFS los aceptan en subidas por partes
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    })
  }
  return { s3: _client, config }
}

/** URL pública de un objeto publicado (vía dominio de archivos / CDN). */
export function publicUrl(path: string, config: FilesConfig = configFromEnv()): string {
  return `${config.publicUrl}/${path.split('/').map(encodeURIComponent).join('/')}`
}
