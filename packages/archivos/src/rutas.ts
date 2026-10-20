/**
 * Única función que decide dónde vive cada archivo en el bucket (sección 7.5):
 *   <municipio>/<sujeto-obligado>/<version-indice>/<carpeta-del-nodo>/<periodo>/<nombre-slug>__<id-corto>.<ext>
 * Versiones anteriores: misma carpeta + `_versiones/` + sufijo `__vN`.
 */
import { customAlphabet } from 'nanoid'

const ALFABETO_ID = '0123456789abcdefghijklmnopqrstuvwxyz'
export const nuevoIdCorto = customAlphabet(ALFABETO_ID, 6)
export const nuevoIdDocumento = customAlphabet(ALFABETO_ID, 12)

/** Minúsculas, sin acentos, sin espacios ni caracteres especiales. Máximo 80 caracteres. */
export function slug(texto: string, maximo = 80): string {
  const s = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maximo)
    .replace(/-+$/g, '')
  return s || 'documento'
}

export type ParametrosRuta = {
  municipioSlug: string
  sujetoObligadoSlug: string // 'ayuntamiento' | 'dif' …
  versionCarpeta: string // 'ley-anterior'
  nodoCarpeta: string // 'art-08/fr-05/inc-a'
  periodoCarpeta: string // '2026-03' | 'permanente'
  nombreVisible: string
  idCorto: string // 6 caracteres
  extension: string // 'pdf'
}

export function rutaDeArchivo(p: ParametrosRuta): string {
  const ext = p.extension.toLowerCase().replace(/^\./, '')
  const partes = [
    p.municipioSlug,
    p.sujetoObligadoSlug,
    p.versionCarpeta,
    p.nodoCarpeta,
    p.periodoCarpeta,
  ].map((x) => validarSegmento(x))
  return `${partes.join('/')}/${slug(p.nombreVisible)}__${p.idCorto}.${ext}`
}

/** Ruta de una versión anterior al reemplazar: carpeta/_versiones/nombre__id__vN.ext */
export function rutaDeVersionAnterior(rutaActual: string, numeroVersion: number): string {
  const i = rutaActual.lastIndexOf('/')
  const carpeta = rutaActual.slice(0, i)
  const archivo = rutaActual.slice(i + 1)
  const punto = archivo.lastIndexOf('.')
  const base = punto === -1 ? archivo : archivo.slice(0, punto)
  const ext = punto === -1 ? '' : archivo.slice(punto)
  return `${carpeta}/_versiones/${base}__v${numeroVersion}${ext}`
}

/** Miniatura de un video, junto al archivo: carpeta/_miniaturas/nombre__id.jpg */
export function rutaDeMiniatura(rutaVideo: string): string {
  const i = rutaVideo.lastIndexOf('/')
  const archivo = rutaVideo.slice(i + 1).replace(/\.[^.]+$/, '')
  return `${rutaVideo.slice(0, i)}/_miniaturas/${archivo}.jpg`
}

/** Archivos de identidad del municipio (escudo, logos): <municipio>/_tema/<nombre>__<id>.<ext> */
export function rutaDeTema(
  municipioSlug: string,
  nombre: string,
  idCorto: string,
  extension: string,
): string {
  return `${validarSegmento(municipioSlug)}/_tema/${slug(nombre)}__${idCorto}.${extension.toLowerCase()}`
}

/** Exportaciones ZIP: <municipio>/_exportaciones/<fecha>__<id>.zip */
export function rutaDeExportacion(
  municipioSlug: string,
  fechaIso: string,
  idCorto: string,
): string {
  return `${validarSegmento(municipioSlug)}/_exportaciones/${fechaIso.slice(0, 10)}__${idCorto}.zip`
}

function validarSegmento(s: string): string {
  if (!/^[a-z0-9][a-z0-9/-]*$/.test(s) || s.includes('..') || s.includes('//')) {
    throw new Error(`Segmento de ruta inválido: "${s}"`)
  }
  return s
}

/** Nombre de archivo legible para Content-Disposition (ASCII + UTF-8). */
export function contentDisposition(
  disposicion: 'inline' | 'attachment',
  nombreVisible: string,
  extension: string,
): string {
  const base =
    nombreVisible
      .trim()
      .replace(/[\\/:*?"<>|\r\n]+/g, ' ')
      .slice(0, 150) || 'documento'
  const ascii = `${slug(base)}.${extension}`
  const utf8 = encodeURIComponent(`${base}.${extension}`)
  return `${disposicion}; filename="${ascii}"; filename*=UTF-8''${utf8}`
}
