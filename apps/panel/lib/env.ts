import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    DATABASE_DRIVER: z.enum(['postgres', 'neon']).default('postgres'),
    BETTER_AUTH_SECRET: z.string().min(16),
    BETTER_AUTH_URL: z.string().url(),
    CORREO_PROVEEDOR: z.enum(['smtp', 'resend']).default('smtp'),
    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().default(1025),
    RESEND_API_KEY: z.string().optional(),
    CORREO_REMITENTE: z.string().default('Plataforma de Transparencia <no-responder@localhost>'),
    S3_ENDPOINT: z.string().url(),
    S3_BUCKET: z.string(),
    ARCHIVOS_URL_PUBLICA: z.string().url(),
    REVALIDACION_SECRETOS: z.string().default('{}'),
  },
  client: {
    NEXT_PUBLIC_PLATFORM_NAME: z.string().default('Plataforma de Transparencia'),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_DRIVER: process.env.DATABASE_DRIVER,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    CORREO_PROVEEDOR: process.env.CORREO_PROVEEDOR,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    CORREO_REMITENTE: process.env.CORREO_REMITENTE,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_BUCKET: process.env.S3_BUCKET,
    ARCHIVOS_URL_PUBLICA: process.env.ARCHIVOS_URL_PUBLICA,
    REVALIDACION_SECRETOS: process.env.REVALIDACION_SECRETOS,
    NEXT_PUBLIC_PLATFORM_NAME: process.env.NEXT_PUBLIC_PLATFORM_NAME,
  },
  emptyStringAsUndefined: true,
})
