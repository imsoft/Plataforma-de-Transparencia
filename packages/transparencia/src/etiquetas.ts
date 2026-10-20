/**
 * Etiquetas de caché compartidas entre el panel (quien invalida) y los sitios (quienes cachean).
 * Función pura: cambia aquí y cambia en los dos lados.
 */
export type ContextoEtiquetas = {
  /** Prefijo del sujeto obligado ('' = Ayuntamiento). */
  prefijo: string
  /** Claves del nodo y sus ancestros, de la raíz al nodo (ej. ['8', '85', '85a']). Para secciones sin clave: rutaSlug. */
  rutaClaves: string[]
}

export const ETIQUETA_MUNICIPIO = 'municipio'
export const ETIQUETA_SITEMAP = 'sitemap'
export const ETIQUETA_TODO = 'todo'

export const etiquetaSujeto = (prefijo: string) => `so:${prefijo || 'raiz'}`
export const etiquetaNodo = (prefijo: string, clave: string) => `nodo:${prefijo || 'raiz'}:${clave}`
export const etiquetaDocumento = (id: string) => `documento:${id}`

/** Etiquetas afectadas por un cambio en un documento o leyenda de un nodo. */
export function etiquetasDeNodo({ prefijo, rutaClaves }: ContextoEtiquetas): string[] {
  return [
    ETIQUETA_TODO,
    etiquetaSujeto(prefijo),
    ...rutaClaves.map((c) => etiquetaNodo(prefijo, c)),
    ETIQUETA_SITEMAP,
  ]
}

export function etiquetasDeDocumento(id: string, ctx: ContextoEtiquetas): string[] {
  return [etiquetaDocumento(id), ...etiquetasDeNodo(ctx)]
}

/** Cambios de identidad, redes o datos de contacto: afectan el layout de todo el sitio y las tarjetas OG. */
export function etiquetasDeMunicipio(): string[] {
  return [ETIQUETA_TODO, ETIQUETA_MUNICIPIO, 'og']
}
