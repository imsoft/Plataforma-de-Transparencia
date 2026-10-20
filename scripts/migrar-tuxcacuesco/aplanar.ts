/**
 * Convierte el árbol HTML en (1) nodos del índice v1 y (2) documentos con su ruta de nodo y periodo.
 * Regla: artículo → fracción → inciso son nodos del índice; todo lo que cuelgue más abajo (años, meses,
 * "Estados Financieros", "Subsidios"…) se vuelve etiqueta de periodo/carpeta del documento.
 */
import { createHash } from 'node:crypto'
import {
  clasificarTitulo,
  normalizarUrl,
  tieneCaracteresSospechosos,
  type NodoHtml,
} from './parsear'

export type NodoIndiceV1 = {
  nivel: 'articulo' | 'fraccion' | 'inciso' | 'subinciso'
  numero?: string
  rutaSlug?: string
  titulo: string
  periodicidad?: 'mensual' | 'trimestral' | 'semestral' | 'anual' | 'permanente'
  periodicidadPorConfirmar?: boolean
  hijos?: NodoIndiceV1[]
}

export type DocumentoV1 = {
  id: string // determinista a partir de la URL: la migración es idempotente
  claveNodo: string // '85a' o 'armonizacion-contable/01'
  nombre: string
  url: string
  urlNormalizada: string
  periodoEtiqueta: string | null
  carpetaPeriodo: string
  periodoInicio: string | null
  advertencias: string[]
}

export type Fuente = {
  articulo: string | null
  rutaSlug?: string
  tituloArticulo: string
  arbol: NodoHtml
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'general'

export function idDeUrl(url: string): string {
  return createHash('sha256')
    .update(normalizarUrl(url))
    .digest('hex')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 12)
}

const romanoAArabigo = (r: string) => {
  const v: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 }
  let t = 0
  for (let i = 0; i < r.length; i++) {
    const a = v[r[i]!]!
    const b = v[r[i + 1] ?? ''] ?? 0
    t += a < b ? -a : a
  }
  return t
}

/** Detecta año y mes en la cadena de agrupadores (["Estados Financieros", "2024", "Enero"]). */
function periodoDe(agrupadores: string[]): {
  etiqueta: string | null
  carpeta: string
  inicio: string | null
} {
  const texto = agrupadores.join(' ').toLowerCase()
  const anio = /\b(20\d{2})\b/.exec(texto)?.[1]
  const mes = MESES.findIndex((m) => new RegExp(`\\b${m}\\b`).test(texto))
  const trim = /\b([1-4])\s*(?:er|do|to)?\s*trimestre\b|\btrimestre\s*([1-4])\b/.exec(texto)
  const etiqueta = agrupadores.length > 0 ? agrupadores.join(' · ') : null
  if (anio && mes >= 0)
    return {
      etiqueta,
      carpeta: `${anio}-${String(mes + 1).padStart(2, '0')}`,
      inicio: `${anio}-${String(mes + 1).padStart(2, '0')}-01`,
    }
  if (anio && trim) {
    const t = Number(trim[1] ?? trim[2])
    return {
      etiqueta,
      carpeta: `${anio}-t${t}`,
      inicio: `${anio}-${String((t - 1) * 3 + 1).padStart(2, '0')}-01`,
    }
  }
  if (anio) return { etiqueta, carpeta: anio, inicio: `${anio}-01-01` }
  if (agrupadores.length > 0)
    return { etiqueta, carpeta: slug(agrupadores.join('-')), inicio: null }
  return { etiqueta: null, carpeta: 'permanente', inicio: null }
}

export function aplanar(fuentes: Fuente[]): { indice: NodoIndiceV1[]; documentos: DocumentoV1[] } {
  const indice: NodoIndiceV1[] = []
  const documentos: DocumentoV1[] = []
  const vistos = new Set<string>()

  const agregarDoc = (claveNodo: string, agrupadores: string[], texto: string, url: string) => {
    const urlN = normalizarUrl(url)
    const id = idDeUrl(url)
    const advertencias: string[] = []
    if (vistos.has(urlN)) advertencias.push('URL repetida en otro lugar del sitio')
    vistos.add(urlN)
    if (tieneCaracteresSospechosos(texto)) advertencias.push('nombre con caracteres rotos')
    if (tieneCaracteresSospechosos(decodeURIComponent(url)))
      advertencias.push('URL con caracteres rotos')
    const p = periodoDe(agrupadores)
    documentos.push({
      id,
      claveNodo,
      nombre: texto,
      url,
      urlNormalizada: urlN,
      periodoEtiqueta: p.etiqueta,
      carpetaPeriodo: p.carpeta,
      periodoInicio: p.inicio,
      advertencias,
    })
  }

  for (const f of fuentes) {
    if (f.articulo) {
      const art: NodoIndiceV1 = {
        nivel: 'articulo',
        numero: f.articulo,
        titulo: f.tituloArticulo,
        periodicidad: 'mensual',
        periodicidadPorConfirmar: true,
        hijos: [],
      }
      indice.push(art)
      for (const fr of f.arbol.hijos) {
        const c = clasificarTitulo(fr.titulo)
        if (c.nivel !== 'fraccion') continue // en un artículo, el primer nivel siempre es fracción
        const numeroFr = String(romanoAArabigo(c.numero))
        const nodoFr: NodoIndiceV1 = {
          nivel: 'fraccion',
          numero: c.numero,
          titulo: c.titulo,
          hijos: [],
        }
        art.hijos!.push(nodoFr)
        const claveFr = `${f.articulo}${numeroFr}`
        // documentos directos de la fracción
        for (const e of fr.enlaces) agregarDoc(claveFr, [], e.texto, e.url)
        for (const h of fr.hijos) {
          const ch = clasificarTitulo(h.titulo)
          if (ch.nivel === 'inciso') {
            nodoFr.hijos!.push({ nivel: 'inciso', numero: ch.numero, titulo: ch.titulo })
            recorrerAgrupadores(h, `${claveFr}${ch.numero}`, [], agregarDoc)
          } else {
            // agrupador directo bajo la fracción (años, etc.): documentos de la fracción
            recorrerAgrupadores(h, claveFr, [h.titulo], agregarDoc)
          }
        }
        if (nodoFr.hijos!.length === 0) delete nodoFr.hijos
      }
    } else if (f.rutaSlug) {
      // sección sin artículo (armonización contable): cada item numerado es una "fracción" bajo la sección
      const sec: NodoIndiceV1 = {
        nivel: 'articulo',
        rutaSlug: f.rutaSlug,
        titulo: f.tituloArticulo,
        periodicidad: 'trimestral',
        periodicidadPorConfirmar: true,
        hijos: [],
      }
      indice.push(sec)
      let n = 0
      for (const item of f.arbol.hijos) {
        n++
        const c = clasificarTitulo(item.titulo)
        const numero = c.nivel === 'numeral' ? c.numero : String(n)
        sec.hijos!.push({ nivel: 'fraccion', numero, titulo: c.titulo })
        const clave = `${f.rutaSlug}/${numero.padStart(2, '0')}`
        for (const e of item.enlaces) agregarDoc(clave, [], e.texto, e.url)
        for (const h of item.hijos) recorrerAgrupadores(h, clave, [h.titulo], agregarDoc)
      }
    }
  }
  return { indice, documentos }
}

function recorrerAgrupadores(
  nodo: NodoHtml,
  clave: string,
  agrupadores: string[],
  agregar: (clave: string, agrupadores: string[], texto: string, url: string) => void,
) {
  for (const e of nodo.enlaces) agregar(clave, agrupadores, e.texto, e.url)
  for (const h of nodo.hijos) recorrerAgrupadores(h, clave, [...agrupadores, h.titulo], agregar)
}
