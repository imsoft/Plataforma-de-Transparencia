import { createSitemap } from '@platform/transparency/next/sitemap'

export default createSitemap([
  { path: '/', priority: 1 },
  { path: '/directorio' },
  { path: '/contacto' },
  { path: '/aviso-de-privacidad', priority: 0.3 },
])
