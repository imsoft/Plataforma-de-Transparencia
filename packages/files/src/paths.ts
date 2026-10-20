/**
 * Única función que decide dónde vive cada archivo en el bucket (sección 7.5):
 *   <municipio>/<sujeto-obligado>/<version-indice>/<carpeta-del-nodo>/<periodo>/<nombre-slug>__<id-corto>.<ext>
 * Versiones anteriores: misma carpeta + `_versiones/` + sufijo `__vN`.
 */
import { customAlphabet } from 'nanoid'

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'
export const newShortId = customAlphabet(ID_ALPHABET, 6)
export const newDocumentId = customAlphabet(ID_ALPHABET, 12)

/** Minúsculas, sin acentos, sin espacios ni caracteres especiales. Máximo 80 caracteres. */
export function slug(text: string, maximum = 80): string {
  const s = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maximum)
    .replace(/-+$/g, '')
  return s || 'documento'
}

export type PathParams = {
  municipalitySlug: string
  obligatedSubjectSlug: string // 'ayuntamiento' | 'dif' …
  versionFolder: string // 'ley-anterior'
  nodeFolder: string // 'art-08/fr-05/inc-a'
  periodFolder: string // '2026-03' | 'permanent'
  displayName: string
  shortId: string // 6 caracteres
  extension: string // 'pdf'
}

export function filePath(p: PathParams): string {
  const ext = p.extension.toLowerCase().replace(/^\./, '')
  const parts = [
    p.municipalitySlug,
    p.obligatedSubjectSlug,
    p.versionFolder,
    p.nodeFolder,
    p.periodFolder,
  ].map((x) => validateSegment(x))
  return `${parts.join('/')}/${slug(p.displayName)}__${p.shortId}.${ext}`
}

/** Ruta de una versión anterior al reemplazar: carpeta/_versiones/nombre__id__vN.ext */
export function previousVersionPath(currentPath: string, versionNumber: number): string {
  const i = currentPath.lastIndexOf('/')
  const folder = currentPath.slice(0, i)
  const file = currentPath.slice(i + 1)
  const dot = file.lastIndexOf('.')
  const base = dot === -1 ? file : file.slice(0, dot)
  const ext = dot === -1 ? '' : file.slice(dot)
  return `${folder}/_versiones/${base}__v${versionNumber}${ext}`
}

/** Miniatura de un video, junto al archivo: carpeta/_miniaturas/nombre__id.jpg */
export function thumbnailPathFor(videoPath: string): string {
  const i = videoPath.lastIndexOf('/')
  const file = videoPath.slice(i + 1).replace(/\.[^.]+$/, '')
  return `${videoPath.slice(0, i)}/_miniaturas/${file}.jpg`
}

/** Archivos de identidad del municipio (escudo, logos): <municipio>/_tema/<nombre>__<id>.<ext> */
export function themePath(
  municipalitySlug: string,
  name: string,
  shortId: string,
  extension: string,
): string {
  return `${validateSegment(municipalitySlug)}/_tema/${slug(name)}__${shortId}.${extension.toLowerCase()}`
}

/** Exportaciones ZIP: <municipio>/_exportaciones/<fecha>__<id>.zip */
export function exportPath(municipalitySlug: string, isoDate: string, shortId: string): string {
  return `${validateSegment(municipalitySlug)}/_exportaciones/${isoDate.slice(0, 10)}__${shortId}.zip`
}

function validateSegment(s: string): string {
  if (!/^[a-z0-9][a-z0-9/-]*$/.test(s) || s.includes('..') || s.includes('//')) {
    throw new Error(`Segmento de ruta inválido: "${s}"`)
  }
  return s
}

/** Nombre de archivo legible para Content-Disposition (ASCII + UTF-8). */
export function contentDisposition(
  disposition: 'inline' | 'attachment',
  displayName: string,
  extension: string,
): string {
  const base =
    displayName
      .trim()
      .replace(/[\\/:*?"<>|\r\n]+/g, ' ')
      .slice(0, 150) || 'documento'
  const ascii = `${slug(base)}.${extension}`
  const utf8 = encodeURIComponent(`${base}.${extension}`)
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${utf8}`
}
