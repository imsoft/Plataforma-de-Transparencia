/** Datos semilla de desarrollo. Las contraseñas solo sirven en local. */
export const ESTADO = { clave: 'JAL', nombre: 'Jalisco' }

export const TIPOS_SUJETO = [
  { slug: 'ayuntamiento', nombre: 'Ayuntamiento' },
  { slug: 'dif', nombre: 'DIF' },
  { slug: 'agua', nombre: 'Organismo de agua potable' },
]

export const MUNICIPIO_DEMO = {
  slug: 'tuxcacuesco',
  nombre: 'Tuxcacuesco',
  nombreOficial: 'H. Ayuntamiento de Tuxcacuesco',
  dominio: 'tuxcacuesco.gob.mx',
  urlRevalidacion: 'http://localhost:3001/api/revalidar',
  tema: {
    colorPrimario: '#125c6a',
    colorSecundario: '#35505e',
    colorAcento: '#5b7a8c',
    tipografia: 'Inter',
  },
  sujetosObligados: [
    { tipo: 'ayuntamiento', nombre: 'H. Ayuntamiento de Tuxcacuesco', prefijo: '' },
    { tipo: 'dif', nombre: 'DIF Tuxcacuesco', prefijo: 'dif' },
  ],
  datosContacto: {
    direccion: 'Portal Hidalgo 1, Centro, Tuxcacuesco, Jalisco',
    telefono: '343 437 0001',
    correo: 'contacto@tuxcacuesco.gob.mx',
  },
}

export const USUARIOS = [
  {
    email: 'superadmin@localhost.test',
    name: 'Brandon (superadmin)',
    password: 'Superadmin-Local-2026!',
    rol: 'superadmin' as const,
  },
  {
    email: 'supervisor@localhost.test',
    name: 'Sofía Supervisora',
    password: 'Supervisor-Local-2026!',
    rol: 'supervisor' as const,
    cargo: 'Consultora externa',
  },
  {
    email: 'admin@tuxcacuesco.test',
    name: 'Andrés Admin',
    password: 'AdminMunicipal-2026!',
    rol: 'admin_municipal' as const,
    cargo: 'Titular de la Unidad de Transparencia',
  },
  {
    email: 'capturista@tuxcacuesco.test',
    name: 'Carla Capturista',
    password: 'Capturista-Local-2026!',
    rol: 'capturista' as const,
    cargo: 'Auxiliar administrativa',
  },
]

export const REDES_DEMO = [
  {
    red: 'facebook',
    url: 'https://www.facebook.com/AyuntamientoTuxcacuesco',
    texto: 'Facebook del Ayuntamiento',
    orden: 0,
  },
  { red: 'whatsapp', url: 'https://wa.me/523434370001', texto: 'WhatsApp de atención', orden: 1 },
]
