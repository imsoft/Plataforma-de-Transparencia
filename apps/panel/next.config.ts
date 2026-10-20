// Carga .env/.env.local de la raíz del monorepo (Next solo lee los de la app)
import '@plataforma/db/env'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: [
    '@plataforma/ui',
    '@plataforma/tema',
    '@plataforma/auth',
    '@plataforma/db',
    '@plataforma/indice',
    '@plataforma/archivos',
  ],
  cacheComponents: false, // el panel es 100 % dinámico y autenticado
  poweredByHeader: false,
  serverExternalPackages: ['postgres', '@neondatabase/serverless', 'nodemailer', 'file-type'],
  headers: () =>
    Promise.resolve([
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ]),
}

export default nextConfig
