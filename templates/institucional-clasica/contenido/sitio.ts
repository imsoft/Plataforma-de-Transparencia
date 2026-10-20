/** Contenido propio del municipio: menú, textos de portada, directorio. Se edita en código (Fase 3: desde el panel). */
export const MENU = [
  { href: '/', etiqueta: 'Inicio' },
  { href: '/directorio', etiqueta: 'Directorio' },
  { href: '/contacto', etiqueta: 'Contacto' },
  { href: '/transparencia', etiqueta: 'Transparencia' },
]

export const PORTADA = {
  titulo: 'Un gobierno que rinde cuentas a __NOMBRE__',
  subtitulo:
    'Consulta presupuesto, nómina, actas de cabildo y toda la información pública del Gobierno Municipal. Actualizada y con enlaces que no cambian.',
}

export const DIRECTORIO: { cargo: string; nombre: string; telefono?: string; correo?: string }[] = [
  { cargo: 'Presidencia Municipal', nombre: 'Por definir', telefono: '' },
  { cargo: 'Secretaría General', nombre: 'Por definir' },
  { cargo: 'Tesorería', nombre: 'Por definir' },
  { cargo: 'Unidad de Transparencia', nombre: 'Por definir' },
]

export const CORREO_SEGURIDAD = 'seguridad@__DOMINIO__'
