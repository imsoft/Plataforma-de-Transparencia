/** Datos semilla de desarrollo. Las contraseñas solo sirven en local. */
export const STATUS_LABEL = { key: 'JAL', name: 'Jalisco' }

export const SUBJECT_TYPES = [
  { slug: 'ayuntamiento', name: 'Ayuntamiento' },
  { slug: 'dif', name: 'DIF' },
  { slug: 'agua', name: 'Organismo de agua potable' },
]

export const DEMO_MUNICIPALITY = {
  slug: 'tuxcacuesco',
  name: 'Tuxcacuesco',
  officialName: 'H. Ayuntamiento de Tuxcacuesco',
  domain: 'tuxcacuesco.gob.mx',
  revalidationUrl: 'http://localhost:3001/api/revalidate',
  theme: {
    primaryColor: '#125c6a',
    secondaryColor: '#35505e',
    accentColor: '#5b7a8c',
    typeface: 'Inter',
  },
  obligatedSubjects: [
    { type: 'ayuntamiento', name: 'H. Ayuntamiento de Tuxcacuesco', prefix: '' },
    { type: 'dif', name: 'DIF Tuxcacuesco', prefix: 'dif' },
  ],
  contactInfo: {
    address: 'Portal Hidalgo 1, Centro, Tuxcacuesco, Jalisco',
    phone: '343 437 0001',
    email: 'contacto@tuxcacuesco.gob.mx',
  },
}

export const USERS = [
  {
    email: 'superadmin@localhost.test',
    name: 'Brandon (superadmin)',
    password: 'Superadmin-Local-2026!',
    role: 'superadmin' as const,
  },
  {
    email: 'supervisor@localhost.test',
    name: 'Sofía Supervisora',
    password: 'Supervisor-Local-2026!',
    role: 'supervisor' as const,
    jobTitle: 'Consultora externa',
  },
  {
    email: 'admin@tuxcacuesco.test',
    name: 'Andrés Admin',
    password: 'AdminMunicipal-2026!',
    role: 'municipal_admin' as const,
    jobTitle: 'Titular de la Unidad de Transparencia',
  },
  {
    email: 'capturista@tuxcacuesco.test',
    name: 'Carla Capturista',
    password: 'Capturista-Local-2026!',
    role: 'uploader' as const,
    jobTitle: 'Auxiliar administrativa',
  },
]

export const DEMO_NETWORKS = [
  {
    network: 'facebook',
    url: 'https://www.facebook.com/AyuntamientoTuxcacuesco',
    text: 'Facebook del Ayuntamiento',
    order: 0,
  },
  {
    network: 'whatsapp',
    url: 'https://wa.me/523434370001',
    text: 'WhatsApp de atención',
    order: 1,
  },
]
