/**
 * Parser del HTML de transparencia del sitio Angular de Tuxcacuesco (acordeones de Bootstrap anidados).
 * Produce un árbol genérico: cada nodo tiene título (texto del botón), id del acordeón, hijos y enlaces.
 * Función pura: recibe HTML, devuelve datos. Las pruebas usan un fragmento real.
 */
import { parse, type HTMLElement } from 'node-html-parser'

export type Link = { text: string; url: string }
export type HtmlNode = { id: string; title: string; children: HtmlNode[]; links: Link[] }

const cleanText = (s: string) =>
  s
    .replace(/\{\{\s*"([\s\S]*?)"\s*\|\s*titlecase\s*\}\}/g, '$1') // {{ "Texto" | titlecase }}
    .replace(/\{\{\s*'([\s\S]*?)'\s*\|\s*titlecase\s*\}\}/g, '$1')
    .replace(/&#41;/g, ')')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Parsea un archivo completo. `tituloRaiz` sirve para subpáginas que no traen <h1>. */
export function parseHtml(html: string, rootTitle = ''): HtmlNode {
  const root = parse(html, { blockTextElements: { script: false, style: false } })
  const h1 = root.querySelector('h1')
  const title = h1 ? cleanText(h1.text) : rootTitle
  return { id: 'raiz', title, children: itemsOf(root), links: directLinks(root) }
}

/** Items de acordeón que son hijos directos "lógicos" (no anidados dentro de otro item) del contenedor. */
function itemsOf(container: HTMLElement): HtmlNode[] {
  const items: HtmlNode[] = []
  for (const item of container.querySelectorAll('.accordion-item')) {
    // solo los que no tienen otro .accordion-item como ancestro dentro de `contenedor`
    let p = item.parentNode as HTMLElement | null
    let nested = false
    while (p && p !== container) {
      if (p.classList?.contains('accordion-item')) {
        nested = true
        break
      }
      p = p.parentNode as HTMLElement | null
    }
    if (nested) continue
    const button = item.querySelector('button')
    const body = item.querySelector('.accordion-collapse')
    const id =
      body?.getAttribute('id') ?? button?.getAttribute('data-bs-target')?.replace('#', '') ?? ''
    const title = button ? cleanText(button.text) : ''
    items.push({
      id,
      title,
      children: body ? itemsOf(body) : [],
      links: body ? directLinks(body) : [],
    })
  }
  return items
}

/** Enlaces <a href> del cuerpo que no pertenecen a un item anidado. */
function directLinks(container: HTMLElement): Link[] {
  const output: Link[] = []
  for (const a of container.querySelectorAll('a[href]')) {
    let p = a.parentNode as HTMLElement | null
    let nested = false
    while (p && p !== container) {
      if (p.classList?.contains('accordion-item')) {
        nested = true
        break
      }
      p = p.parentNode as HTMLElement | null
    }
    if (nested) continue
    const url = (a.getAttribute('href') ?? '').trim()
    if (!/^https?:\/\//.test(url)) continue
    output.push({
      text: cleanText(a.text) || decodeURIComponent(url.split('/').pop() ?? ''),
      url,
    })
  }
  return output
}

// ── Clasificación de títulos ─────────────────────────────────────────────────

const ROMAN = /^([IVXLC]+)\.\s*(.+)$/i
const ITEM = /^([a-zñ])\)\s*(.+)$/i
const NUMERAL = /^(\d{1,2})[.)]\s*(.+)$/

export type Classification =
  | { level: 'fraction'; number: string; title: string }
  | { level: 'item'; number: string; title: string }
  | { level: 'numeral'; number: string; title: string }
  | { level: 'grouping'; title: string }

/** "V. La información financiera" → fracción 5 · "a) Las partidas…" → inciso a · "Estados Financieros" → agrupador. */
export function classifyTitle(title: string): Classification {
  const r = ROMAN.exec(title)
  if (r) return { level: 'fraction', number: r[1]!.toUpperCase(), title: r[2]!.trim() }
  const i = ITEM.exec(title)
  if (i) return { level: 'item', number: i[1]!.toLowerCase(), title: i[2]!.trim() }
  const n = NUMERAL.exec(title)
  if (n) return { level: 'numeral', number: n[1]!, title: n[2]!.trim() }
  return { level: 'grouping', title: title.trim() }
}

// ── URLs de DigitalOcean Spaces ──────────────────────────────────────────────

export const SPACES_HOSTS = [
  'documentos-transparencia.sfo3.cdn.digitaloceanspaces.com',
  'documentos-transparencia.sfo3.digitaloceanspaces.com',
]

/** Misma URL con o sin CDN → forma canónica (sin CDN) y decodificada para comparar. */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname === SPACES_HOSTS[0]) u.hostname = SPACES_HOSTS[1]!
    return u.toString()
  } catch {
    return url
  }
}

/** Caracteres rotos típicos de doble codificación (ej. "Informaciขn Pฃblica"). */
export function hasSuspiciousCharacters(text: string): boolean {
  return /[฀-๿�]|Ã.|Â./.test(text)
}
