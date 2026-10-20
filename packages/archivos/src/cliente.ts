/** Cliente S3 (MinIO en local, Cloudflare R2 en producción). Se configura solo por variables de entorno. */
import { S3Client } from '@aws-sdk/client-s3'
import { z } from 'zod'

const esquema = z.object({
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('false'),
  ARCHIVOS_URL_PUBLICA: z.string().url(),
})

export type ConfigArchivos = {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
  /** Base pública (dominio de archivos) desde la que se sirven los archivos publicados. */
  urlPublica: string
}

export function configDesdeEnv(env: NodeJS.ProcessEnv = process.env): ConfigArchivos {
  const r = esquema.safeParse(env)
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
    urlPublica: e.ARCHIVOS_URL_PUBLICA.replace(/\/$/, ''),
  }
}

let _cliente: S3Client | undefined
let _config: ConfigArchivos | undefined

export function clienteS3(config: ConfigArchivos = configDesdeEnv()): {
  s3: S3Client
  config: ConfigArchivos
} {
  if (!_cliente || _config !== config) {
    _config = config
    _cliente = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    })
  }
  return { s3: _cliente, config }
}

/** URL pública de un objeto publicado (vía dominio de archivos / CDN). */
export function urlPublica(ruta: string, config: ConfigArchivos = configDesdeEnv()): string {
  return `${config.urlPublica}/${ruta.split('/').map(encodeURIComponent).join('/')}`
}
