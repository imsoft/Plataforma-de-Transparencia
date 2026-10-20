/**
 * Convierte el árbol HTML en (1) nodos del índice v1 y (2) documentos con su ruta de nodo y periodo.
 * Regla: artículo → fracción → inciso son nodos del índice; todo lo que cuelgue más abajo (años, meses,
 * "Estados Financieros", "Subsidios"…) se vuelve etiqueta de periodo/carpeta del documento.
 */
import { createHash } from 'node:crypto'
import { classifyTitle, normalizeUrl, hasSuspiciousCharacters, type HtmlNode } from './parse'

export type LawIndexNodeV1 = {
  level: 'article' | 'fraction' | 'item' | 'subitem'
  number?: string
  routeSlug?: string
  title: string
  frequency?: 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'permanent'
  frequencyToConfirm?: boolean
  children?: LawIndexNodeV1[]
}

export type DocumentV1 = {
  id: string // determinista a partir de la URL: la migración es idempotente
  nodeKey: string // '85a' o 'armonizacion-contable/01'
  name: string
  url: string
  normalizedUrl: string
  periodLabel: string | null
  periodFolder: string
  periodStart: string | null
  warnings: string[]
}

export type Source = {
  article: string | null
  routeSlug?: string
  articleTitle: string
  tree: HtmlNode
}

const MONTHS = [
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

export function idFromUrl(url: string): string {
  return createHash('sha256')
    .update(normalizeUrl(url))
    .digest('hex')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 12)
}

const romanToArabic = (r: string) => {
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
function periodOf(groupings: string[]): {
  label: string | null
  folder: string
  start: string | null
} {
  const text = groupings.join(' ').toLowerCase()
  const year = /\b(20\d{2})\b/.exec(text)?.[1]
  const month = MONTHS.findIndex((m) => new RegExp(`\\b${m}\\b`).test(text))
  const trim = /\b([1-4])\s*(?:er|do|to)?\s*trimestre\b|\btrimestre\s*([1-4])\b/.exec(text)
  const label = groupings.length > 0 ? groupings.join(' · ') : null
  if (year && month >= 0)
    return {
      label,
      folder: `${year}-${String(month + 1).padStart(2, '0')}`,
      start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
    }
  if (year && trim) {
    const t = Number(trim[1] ?? trim[2])
    return {
      label,
      folder: `${year}-t${t}`,
      start: `${year}-${String((t - 1) * 3 + 1).padStart(2, '0')}-01`,
    }
  }
  if (year) return { label, folder: year, start: `${year}-01-01` }
  if (groupings.length > 0) return { label, folder: slug(groupings.join('-')), start: null }
  return { label: null, folder: 'permanent', start: null }
}

export function flatten(sources: Source[]): {
  lawIndex: LawIndexNodeV1[]
  documents: DocumentV1[]
} {
  const lawIndex: LawIndexNodeV1[] = []
  const documents: DocumentV1[] = []
  const seen = new Set<string>()

  const addDoc = (nodeKey: string, groupings: string[], text: string, url: string) => {
    const normalizedUrl = normalizeUrl(url)
    const id = idFromUrl(url)
    const warnings: string[] = []
    if (seen.has(normalizedUrl)) warnings.push('URL repetida en otro lugar del sitio')
    seen.add(normalizedUrl)
    if (hasSuspiciousCharacters(text)) warnings.push('nombre con caracteres rotos')
    if (hasSuspiciousCharacters(decodeURIComponent(url))) warnings.push('URL con caracteres rotos')
    const p = periodOf(groupings)
    documents.push({
      id,
      nodeKey,
      name: text,
      url,
      normalizedUrl: normalizedUrl,
      periodLabel: p.label,
      periodFolder: p.folder,
      periodStart: p.start,
      warnings,
    })
  }

  for (const f of sources) {
    if (f.article) {
      const art: LawIndexNodeV1 = {
        level: 'article',
        number: f.article,
        title: f.articleTitle,
        frequency: 'monthly',
        frequencyToConfirm: true,
        children: [],
      }
      lawIndex.push(art)
      for (const fr of f.tree.children) {
        const c = classifyTitle(fr.title)
        if (c.level !== 'fraction') continue // en un artículo, el primer nivel siempre es fracción
        const fractionNumber = String(romanToArabic(c.number))
        const fractionNode: LawIndexNodeV1 = {
          level: 'fraction',
          number: c.number,
          title: c.title,
          children: [],
        }
        art.children!.push(fractionNode)
        const fractionKey = `${f.article}${fractionNumber}`
        // documentos directos de la fracción
        for (const e of fr.links) addDoc(fractionKey, [], e.text, e.url)
        for (const h of fr.children) {
          const ch = classifyTitle(h.title)
          if (ch.level === 'item') {
            fractionNode.children!.push({ level: 'item', number: ch.number, title: ch.title })
            walkGroupings(h, `${fractionKey}${ch.number}`, [], addDoc)
          } else {
            // agrupador directo bajo la fracción (años, etc.): documentos de la fracción
            walkGroupings(h, fractionKey, [h.title], addDoc)
          }
        }
        if (fractionNode.children!.length === 0) delete fractionNode.children
      }
    } else if (f.routeSlug) {
      // sección sin artículo (armonización contable): cada item numerado es una "fracción" bajo la sección
      const sectionNode: LawIndexNodeV1 = {
        level: 'article',
        routeSlug: f.routeSlug,
        title: f.articleTitle,
        frequency: 'quarterly',
        frequencyToConfirm: true,
        children: [],
      }
      lawIndex.push(sectionNode)
      let n = 0
      for (const item of f.tree.children) {
        n++
        const c = classifyTitle(item.title)
        const number = c.level === 'numeral' ? c.number : String(n)
        sectionNode.children!.push({ level: 'fraction', number, title: c.title })
        const key = `${f.routeSlug}/${number.padStart(2, '0')}`
        for (const e of item.links) addDoc(key, [], e.text, e.url)
        for (const h of item.children) walkGroupings(h, key, [h.title], addDoc)
      }
    }
  }
  return { lawIndex, documents }
}

function walkGroupings(
  node: HtmlNode,
  key: string,
  groupings: string[],
  add: (key: string, groupings: string[], text: string, url: string) => void,
) {
  for (const e of node.links) add(key, groupings, e.text, e.url)
  for (const h of node.children) walkGroupings(h, key, [...groupings, h.title], add)
}
