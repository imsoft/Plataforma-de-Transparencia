/** Contenido propio del municipio: menú, textos de portada, directorio. Se edita en código (Fase 3: desde el panel). */
export const MENU = [
  { href: '/', label: 'Inicio' },
  { href: '/directorio', label: 'Directorio' },
  { href: '/contacto', label: 'Contacto' },
  { href: '/transparencia', label: 'Transparencia' },
]

export const HOME = {
  title: 'Un gobierno que rinde cuentas a __NAME__',
  subtitle:
    'Consulta presupuesto, nómina, actas de cabildo y toda la información pública del Gobierno Municipal. Actualizada y con enlaces que no cambian.',
}

export const DIRECTORY: { jobTitle: string; name: string; phone?: string; email?: string }[] = [
  { jobTitle: 'Presidencia Municipal', name: 'Por definir', phone: '' },
  { jobTitle: 'Secretaría General', name: 'Por definir' },
  { jobTitle: 'Tesorería', name: 'Por definir' },
  { jobTitle: 'Unidad de Transparencia', name: 'Por definir' },
]

export const SECURITY_EMAIL = 'seguridad@__DOMAIN__'
