/**
 * Parser del HTML de transparencia del sitio Angular de Tuxcacuesco (acordeones de Bootstrap anidados).
 * Produce un árbol genérico: cada nodo tiene título (texto del botón), id del acordeón, hijos y enlaces.
 * Función pura: recibe HTML, devuelve datos. Las pruebas usan un fragmento real.
 */
import { parse, type HTMLElement } from 'node-html-parser'

export type Enlace = { texto: string; url: string }
export type NodoHtml = { id: string; titulo: string; hijos: NodoHtml[]; enlaces: Enlace[] }

const limpiarTexto = (s: string) =>
  s
    .replace(/\{\{\s*"([\s\S]*?)"\s*\|\s*titlecase\s*\}\}/g, '$1') // {{ "Texto" | titlecase }}
    .replace(/\{\{\s*'([\s\S]*?)'\s*\|\s*titlecase\s*\}\}/g, '$1')
    .replace(/&#41;/g, ')')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Parsea un archivo completo. `tituloRaiz` sirve para subpáginas que no traen <h1>. */
export function parsearHtml(html: string, tituloRaiz = ''): NodoHtml {
  const raiz = parse(html, { blockTextElements: { script: false, style: false } })
  const h1 = raiz.querySelector('h1')
  const titulo = h1 ? limpiarTexto(h1.text) : tituloRaiz
  return { id: 'raiz', titulo, hijos: itemsDe(raiz), enlaces: enlacesDirectos(raiz) }
}

/** Items de acordeón que son hijos directos "lógicos" (no anidados dentro de otro item) del contenedor. */
function itemsDe(contenedor: HTMLElement): NodoHtml[] {
  const items: NodoHtml[] = []
  for (const item of contenedor.querySelectorAll('.accordion-item')) {
    // solo los que no tienen otro .accordion-item como ancestro dentro de `contenedor`
    let p = item.parentNode as HTMLElement | null
    let anidado = false
    while (p && p !== contenedor) {
      if (p.classList?.contains('accordion-item')) {
        anidado = true
        break
      }
      p = p.parentNode as HTMLElement | null
    }
    if (anidado) continue
    const boton = item.querySelector('button')
    const cuerpo = item.querySelector('.accordion-collapse')
    const id =
      cuerpo?.getAttribute('id') ?? boton?.getAttribute('data-bs-target')?.replace('#', '') ?? ''
    const titulo = boton ? limpiarTexto(boton.text) : ''
    items.push({
      id,
      titulo,
      hijos: cuerpo ? itemsDe(cuerpo) : [],
      enlaces: cuerpo ? enlacesDirectos(cuerpo) : [],
    })
  }
  return items
}

/** Enlaces <a href> del cuerpo que no pertenecen a un item anidado. */
function enlacesDirectos(contenedor: HTMLElement): Enlace[] {
  const salida: Enlace[] = []
  for (const a of contenedor.querySelectorAll('a[href]')) {
    let p = a.parentNode as HTMLElement | null
    let anidado = false
    while (p && p !== contenedor) {
      if (p.classList?.contains('accordion-item')) {
        anidado = true
        break
      }
      p = p.parentNode as HTMLElement | null
    }
    if (anidado) continue
    const url = (a.getAttribute('href') ?? '').trim()
    if (!/^https?:\/\//.test(url)) continue
    salida.push({
      texto: limpiarTexto(a.text) || decodeURIComponent(url.split('/').pop() ?? ''),
      url,
    })
  }
  return salida
}

// ── Clasificación de títulos ─────────────────────────────────────────────────

const ROMANO = /^([IVXLC]+)\.\s*(.+)$/i
const INCISO = /^([a-zñ])\)\s*(.+)$/i
const NUMERAL = /^(\d{1,2})[.)]\s*(.+)$/

export type Clasificacion =
  | { nivel: 'fraccion'; numero: string; titulo: string }
  | { nivel: 'inciso'; numero: string; titulo: string }
  | { nivel: 'numeral'; numero: string; titulo: string }
  | { nivel: 'agrupador'; titulo: string }

/** "V. La información financiera" → fracción 5 · "a) Las partidas…" → inciso a · "Estados Financieros" → agrupador. */
export function clasificarTitulo(titulo: string): Clasificacion {
  const r = ROMANO.exec(titulo)
  if (r) return { nivel: 'fraccion', numero: r[1]!.toUpperCase(), titulo: r[2]!.trim() }
  const i = INCISO.exec(titulo)
  if (i) return { nivel: 'inciso', numero: i[1]!.toLowerCase(), titulo: i[2]!.trim() }
  const n = NUMERAL.exec(titulo)
  if (n) return { nivel: 'numeral', numero: n[1]!, titulo: n[2]!.trim() }
  return { nivel: 'agrupador', titulo: titulo.trim() }
}

// ── URLs de DigitalOcean Spaces ──────────────────────────────────────────────

export const HOSTS_SPACES = [
  'documentos-transparencia.sfo3.cdn.digitaloceanspaces.com',
  'documentos-transparencia.sfo3.digitaloceanspaces.com',
]

/** Misma URL con o sin CDN → forma canónica (sin CDN) y decodificada para comparar. */
export function normalizarUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname === HOSTS_SPACES[0]) u.hostname = HOSTS_SPACES[1]!
    return u.toString()
  } catch {
    return url
  }
}

/** Caracteres rotos típicos de doble codificación (ej. "Informaciขn Pฃblica"). */
export function tieneCaracteresSospechosos(texto: string): boolean {
  return /[฀-๿�]|Ã.|Â./.test(texto)
}
