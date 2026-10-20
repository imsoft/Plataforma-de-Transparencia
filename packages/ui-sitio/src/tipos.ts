export type EnlaceMenu = { href: string; etiqueta: string }
export type RedSocialSitio = {
  red: string
  nombreOtra: string | null
  url: string
  texto: string | null
}
export type IdentidadSitio = {
  nombre: string
  nombreOficial: string
  escudoUrl: string | null
  logoAdministracionUrl: string | null
  contacto: { direccion?: string; telefono?: string; correo?: string; horario?: string }
  nombrePlataforma: string
  urlPlataforma: string
}
