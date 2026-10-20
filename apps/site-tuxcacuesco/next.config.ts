// Carga .env/.env.local de la raíz del monorepo
import '@platform/db/env'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: [
    '@platform/ui',
    '@platform/ui-site',
    '@platform/transparency',
    '@platform/theme',
    '@platform/db',
    '@platform/law-index',
    '@platform/files',
    '@platform/social-networks',
  ],
  cacheComponents: false, // ISR por etiquetas (ver packages/transparency/src/next/datos.ts)
  poweredByHeader: false,
  serverExternalPackages: ['postgres', '@neondatabase/serverless'],
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
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]),
  // Rutas del sitio Angular anterior → nuevas (SEO)
  redirects: () =>
    Promise.resolve([
      { source: '/transparencia/articulo-8', destination: '/articulo-8', permanent: true },
      { source: '/transparencia/articulo-15', destination: '/articulo-15', permanent: true },
      {
        source: '/transparencia/armonizacion-contable',
        destination: '/armonizacion-contable',
        permanent: true,
      },
      { source: '/transparencia-dif/:path*', destination: '/dif', permanent: true },
    ]),
}

export default nextConfig
