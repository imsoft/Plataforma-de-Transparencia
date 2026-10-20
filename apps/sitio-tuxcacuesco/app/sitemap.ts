import { crearSitemap } from '@plataforma/transparencia/next/sitemap'

export default crearSitemap([
  { ruta: '/', prioridad: 1 },
  { ruta: '/directorio' },
  { ruta: '/contacto' },
  { ruta: '/aviso-de-privacidad', prioridad: 0.3 },
])
