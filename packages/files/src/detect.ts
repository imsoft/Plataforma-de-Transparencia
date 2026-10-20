/** Detección del tipo real por firma de bytes (magic bytes), no por extensión ni Content-Type del navegador. */
import { fileTypeFromBuffer } from 'file-type'
import { FILE_TYPES, typeByExtension, typeByMime, type FileTypeDefinition } from './types'

export type DetectionResult =
  { ok: true; type: FileTypeDefinition; mime: string } | { ok: false; reason: string }

const MIMES_OOXML = new Set(['application/zip', 'application/x-zip-compressed'])

/**
 * Determina el tipo a partir del inicio del archivo. Reglas especiales:
 * - docx/xlsx/pptx son ZIP por dentro: file-type los distingue si recibe suficientes bytes; si solo ve ZIP,
 *   se acepta según la extensión declarada (el contenido sigue siendo un ZIP válido, no ejecutable).
 * - CSV es texto plano sin firma: se acepta si la extensión es .csv y el inicio es UTF-8 sin bytes nulos.
 */
export async function detectType(start: Uint8Array, fileName: string): Promise<DetectionResult> {
  const byExtension = typeByExtension(fileName)
  if (!byExtension) {
    return {
      ok: false,
      reason: `Solo se pueden subir ${FILE_TYPES.map((t) => t.name).join(', ')}. Este archivo es .${fileName.split('.').pop() ?? '?'}`,
    }
  }
  const detected = await fileTypeFromBuffer(start)

  if (!detected) {
    if (
      byExtension.type === 'excel' &&
      fileName.toLowerCase().endsWith('.csv') &&
      isPlainText(start)
    ) {
      return { ok: true, type: byExtension, mime: 'text/csv' }
    }
    // file-type no reconoce ZIPs cuyo índice no cabe en el fragmento; basta la firma "PK" para ZIP/Office
    if (
      isZipSignature(start) &&
      ['zip', 'word', 'excel', 'powerpoint'].includes(byExtension.type)
    ) {
      return {
        ok: true,
        type: byExtension,
        mime: byExtension.mimes[byExtension.type === 'zip' ? 0 : 1] ?? byExtension.mimes[0]!,
      }
    }
    return {
      ok: false,
      reason: `No se reconoce el contenido del archivo. ¿Es realmente un ${byExtension.name}?`,
    }
  }

  const byMime = typeByMime(detected.mime)
  if (byMime) {
    // Office moderno es un ZIP por dentro: si file-type solo ve ZIP, vale la extensión declarada
    if (byMime.type === 'zip' && ['word', 'excel', 'powerpoint'].includes(byExtension.type)) {
      return { ok: true, type: byExtension, mime: byExtension.mimes[1] ?? byExtension.mimes[0]! }
    }
    if (byMime.type !== byExtension.type) {
      return {
        ok: false,
        reason: `El archivo dice ser ${byExtension.name} pero su contenido es ${byMime.name}. Revisa la extensión.`,
      }
    }
    return { ok: true, type: byMime, mime: detected.mime }
  }
  // Office moderno: file-type puede devolver solo "application/zip" si el buffer es corto
  if (
    MIMES_OOXML.has(detected.mime) &&
    ['word', 'excel', 'powerpoint'].includes(byExtension.type)
  ) {
    return { ok: true, type: byExtension, mime: byExtension.mimes[1] ?? byExtension.mimes[0]! }
  }
  // Office antiguo (.doc/.xls/.ppt) es "application/x-cfb"
  if (
    detected.mime === 'application/x-cfb' &&
    ['word', 'excel', 'powerpoint'].includes(byExtension.type)
  ) {
    return { ok: true, type: byExtension, mime: byExtension.mimes[0]! }
  }
  return {
    ok: false,
    reason: `El contenido del archivo (${detected.mime}) no corresponde a un tipo permitido.`,
  }
}

function isZipSignature(b: Uint8Array): boolean {
  return (
    b.length >= 4 &&
    b[0] === 0x50 &&
    b[1] === 0x4b &&
    (b[2] === 3 || b[2] === 5 || b[2] === 7) &&
    (b[3] === 4 || b[3] === 6 || b[3] === 8)
  )
}

function isPlainText(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return true
  } catch {
    return false
  }
}
