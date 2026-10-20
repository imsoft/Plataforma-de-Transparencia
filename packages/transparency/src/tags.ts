/**
 * Etiquetas de caché compartidas entre el panel (quien invalida) y los sitios (quienes cachean).
 * Función pura: cambia aquí y cambia en los dos lados.
 */
export type TagContext = {
  /** Prefijo del sujeto obligado ('' = Ayuntamiento). */
  prefix: string
  /** Claves del nodo y sus ancestros, de la raíz al nodo (ej. ['8', '85', '85a']). Para secciones sin clave: rutaSlug. */
  keyPath: string[]
}

export const MUNICIPALITY_TAG = 'municipality'
export const SITEMAP_TAG = 'sitemap'
export const ALL_TAG = 'all'

export const subjectTag = (prefix: string) => `so:${prefix || 'root'}`
export const nodeTag = (prefix: string, key: string) => `node:${prefix || 'root'}:${key}`
export const documentTag = (id: string) => `document:${id}`

/** Etiquetas afectadas por un cambio en un documento o leyenda de un nodo. */
export function nodeTags({ prefix, keyPath }: TagContext): string[] {
  return [ALL_TAG, subjectTag(prefix), ...keyPath.map((c) => nodeTag(prefix, c)), SITEMAP_TAG]
}

export function documentTags(id: string, ctx: TagContext): string[] {
  return [documentTag(id), ...nodeTags(ctx)]
}

/** Cambios de identidad, redes o datos de contacto: afectan el layout de todo el sitio y las tarjetas OG. */
export function municipalityTags(): string[] {
  return [ALL_TAG, MUNICIPALITY_TAG, 'og']
}
