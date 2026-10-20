/**
 * Aplana el árbol del archivo a una lista de nodos con clave, carpeta y etiqueta,
 * validando jerarquía, claves únicas y periodicidad. Función pura, sin base de datos.
 */
import {
  arabigoARomano,
  carpetaDeNodo,
  generarClave,
  numeroFraccion,
  type SegmentosClave,
} from './claves'
import {
  archivoIndiceSchema,
  type ArchivoIndice,
  type Nivel,
  type NodoArchivo,
  type Periodicidad,
} from './formato'

export type NodoPlano = {
  /** Índice en la lista; el padre siempre aparece antes. */
  indice: number
  padreIndice: number | null
  nivel: Nivel
  numero: string
  etiqueta: string
  titulo: string
  descripcion: string | null
  clave: string | null
  rutaSlug: string | null
  periodicidad: Periodicidad
  periodicidadPorConfirmar: boolean
  carpetaR2: string
  orden: number
  /** Ruta desde la raíz, para mensajes de error. */
  ruta: string
}

export type ResultadoValidacion =
  { ok: true; nodos: NodoPlano[]; archivo: ArchivoIndice } | { ok: false; errores: string[] }

const ORDEN_NIVEL: Record<Nivel, number> = { articulo: 0, fraccion: 1, inciso: 2, subinciso: 3 }

export function validarIndice(entrada: unknown): ResultadoValidacion {
  const parse = archivoIndiceSchema.safeParse(entrada)
  if (!parse.success) {
    return {
      ok: false,
      errores: parse.error.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`),
    }
  }
  const archivo = parse.data
  const errores: string[] = []
  const nodos: NodoPlano[] = []
  const clavesVistas = new Map<string, string>()
  const slugsVistos = new Map<string, string>()

  const recorrer = (
    nodo: NodoArchivo,
    padre: NodoPlano | null,
    segmentos: SegmentosClave | null,
    orden: number,
    rutaPadre: string,
  ): void => {
    const ruta = `${rutaPadre}/${nodo.rutaSlug ?? nodo.numero ?? '?'}`
    if (padre && ORDEN_NIVEL[nodo.nivel] !== ORDEN_NIVEL[padre.nivel] + 1) {
      errores.push(`${ruta}: un ${nodo.nivel} no puede colgar de un ${padre.nivel}`)
      return
    }
    if (!padre && nodo.nivel !== 'articulo') {
      errores.push(`${ruta}: la raíz debe ser un artículo (o sección con rutaSlug)`)
      return
    }
    const periodicidad = nodo.periodicidad ?? padre?.periodicidad
    if (!periodicidad) {
      errores.push(`${ruta}: falta periodicidad (en el nodo o en algún ancestro)`)
      return
    }

    const esSeccion = !padre && nodo.rutaSlug !== undefined
    const bajoSeccion = padre !== null && segmentos === null
    let nuevosSegmentos: SegmentosClave | null = null
    let clave: string | null = null
    let carpeta: string
    let etiqueta: string
    let numero: string

    if (esSeccion) {
      const slug = nodo.rutaSlug!
      if (nodo.numero) errores.push(`${ruta}: una sección con rutaSlug no lleva número`)
      if (slugsVistos.has(slug)) errores.push(`${ruta}: rutaSlug duplicado "${slug}"`)
      slugsVistos.set(slug, ruta)
      numero = ''
      etiqueta = nodo.titulo
      carpeta = slug
    } else if (bajoSeccion) {
      if (!nodo.numero) {
        errores.push(`${ruta}: falta número`)
        return
      }
      numero = nodo.numero
      etiqueta = nodo.titulo
      carpeta = `${padre.carpetaR2}/${nodo.numero.toLowerCase().padStart(2, '0')}`
    } else {
      if (!nodo.numero) {
        errores.push(`${ruta}: falta número`)
        return
      }
      try {
        const base: SegmentosClave = segmentos ? { ...segmentos } : { articulo: nodo.numero }
        switch (nodo.nivel) {
          case 'articulo':
            nuevosSegmentos = { articulo: nodo.numero }
            numero = String(Number(nodo.numero))
            etiqueta = `Art. ${numero}`
            break
          case 'fraccion':
            nuevosSegmentos = { ...base, fraccion: nodo.numero }
            numero = numeroFraccion(nodo.numero)
            etiqueta = `Fracc. ${arabigoARomano(Number(numero))}`
            break
          case 'inciso':
            nuevosSegmentos = { ...base, inciso: nodo.numero }
            numero = nodo.numero.toLowerCase() // 'ñ' se conserva en etiqueta y número; en la clave es 'nn'
            etiqueta = `Inciso ${numero}`
            break
          case 'subinciso':
            nuevosSegmentos = { ...base, subinciso: nodo.numero }
            numero = String(Number(nodo.numero))
            etiqueta = `Numeral ${numero}`
            break
        }
        clave = generarClave(nuevosSegmentos)
        carpeta = carpetaDeNodo(nuevosSegmentos)
      } catch (e) {
        errores.push(`${ruta}: ${(e as Error).message}`)
        return
      }
      const previo = clavesVistas.get(clave)
      if (previo) {
        errores.push(`${ruta}: clave duplicada "${clave}" (ya la usa ${previo})`)
        return
      }
      clavesVistas.set(clave, ruta)
    }

    const plano: NodoPlano = {
      indice: nodos.length,
      padreIndice: padre?.indice ?? null,
      nivel: nodo.nivel,
      numero,
      etiqueta,
      titulo: nodo.titulo,
      descripcion: nodo.descripcion ?? null,
      clave,
      rutaSlug: esSeccion ? nodo.rutaSlug! : null,
      periodicidad,
      periodicidadPorConfirmar: nodo.periodicidadPorConfirmar ?? false,
      carpetaR2: carpeta,
      orden,
      ruta,
    }
    nodos.push(plano)
    nodo.hijos?.forEach((h, i) =>
      recorrer(h, plano, esSeccion || bajoSeccion ? null : nuevosSegmentos, i, ruta),
    )
  }

  archivo.nodos.forEach((n, i) => recorrer(n, null, null, i, ''))
  if (errores.length > 0) return { ok: false, errores }
  return { ok: true, nodos, archivo }
}
