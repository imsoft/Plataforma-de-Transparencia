/** Detección del tipo real por firma de bytes (magic bytes), no por extensión ni Content-Type del navegador. */
import { fileTypeFromBuffer } from 'file-type'
import { TIPOS, tipoPorExtension, tipoPorMime, type DefinicionTipo } from './tipos'

export type ResultadoDeteccion =
  { ok: true; tipo: DefinicionTipo; mime: string } | { ok: false; motivo: string }

const MIMES_OOXML = new Set(['application/zip', 'application/x-zip-compressed'])

/**
 * Determina el tipo a partir del inicio del archivo. Reglas especiales:
 * - docx/xlsx/pptx son ZIP por dentro: file-type los distingue si recibe suficientes bytes; si solo ve ZIP,
 *   se acepta según la extensión declarada (el contenido sigue siendo un ZIP válido, no ejecutable).
 * - CSV es texto plano sin firma: se acepta si la extensión es .csv y el inicio es UTF-8 sin bytes nulos.
 */
export async function detectarTipo(
  inicio: Uint8Array,
  nombreArchivo: string,
): Promise<ResultadoDeteccion> {
  const porExtension = tipoPorExtension(nombreArchivo)
  if (!porExtension) {
    return {
      ok: false,
      motivo: `Solo se pueden subir ${TIPOS.map((t) => t.nombre).join(', ')}. Este archivo es .${nombreArchivo.split('.').pop() ?? '?'}`,
    }
  }
  const detectado = await fileTypeFromBuffer(inicio)

  if (!detectado) {
    if (
      porExtension.tipo === 'excel' &&
      nombreArchivo.toLowerCase().endsWith('.csv') &&
      esTextoPlano(inicio)
    ) {
      return { ok: true, tipo: porExtension, mime: 'text/csv' }
    }
    // file-type no reconoce ZIPs cuyo índice no cabe en el fragmento; basta la firma "PK" para ZIP/Office
    if (esFirmaZip(inicio) && ['zip', 'word', 'excel', 'powerpoint'].includes(porExtension.tipo)) {
      return {
        ok: true,
        tipo: porExtension,
        mime: porExtension.mimes[porExtension.tipo === 'zip' ? 0 : 1] ?? porExtension.mimes[0]!,
      }
    }
    return {
      ok: false,
      motivo: `No se reconoce el contenido del archivo. ¿Es realmente un ${porExtension.nombre}?`,
    }
  }

  const porMime = tipoPorMime(detectado.mime)
  if (porMime) {
    // Office moderno es un ZIP por dentro: si file-type solo ve ZIP, vale la extensión declarada
    if (porMime.tipo === 'zip' && ['word', 'excel', 'powerpoint'].includes(porExtension.tipo)) {
      return { ok: true, tipo: porExtension, mime: porExtension.mimes[1] ?? porExtension.mimes[0]! }
    }
    if (porMime.tipo !== porExtension.tipo) {
      return {
        ok: false,
        motivo: `El archivo dice ser ${porExtension.nombre} pero su contenido es ${porMime.nombre}. Revisa la extensión.`,
      }
    }
    return { ok: true, tipo: porMime, mime: detectado.mime }
  }
  // Office moderno: file-type puede devolver solo "application/zip" si el buffer es corto
  if (
    MIMES_OOXML.has(detectado.mime) &&
    ['word', 'excel', 'powerpoint'].includes(porExtension.tipo)
  ) {
    return { ok: true, tipo: porExtension, mime: porExtension.mimes[1] ?? porExtension.mimes[0]! }
  }
  // Office antiguo (.doc/.xls/.ppt) es "application/x-cfb"
  if (
    detectado.mime === 'application/x-cfb' &&
    ['word', 'excel', 'powerpoint'].includes(porExtension.tipo)
  ) {
    return { ok: true, tipo: porExtension, mime: porExtension.mimes[0]! }
  }
  return {
    ok: false,
    motivo: `El contenido del archivo (${detectado.mime}) no corresponde a un tipo permitido.`,
  }
}

function esFirmaZip(b: Uint8Array): boolean {
  return (
    b.length >= 4 &&
    b[0] === 0x50 &&
    b[1] === 0x4b &&
    (b[2] === 3 || b[2] === 5 || b[2] === 7) &&
    (b[3] === 4 || b[3] === 6 || b[3] === 8)
  )
}

function esTextoPlano(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return true
  } catch {
    return false
  }
}
