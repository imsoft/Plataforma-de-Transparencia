/**
 * Catálogo único de tipos de archivo permitidos (sección 5.8). Lo usan panel, sitios y validación.
 * Los colores son fijos por tipo (no cambian con el tema) y cumplen contraste sobre blanco.
 */
export type TipoArchivo = 'pdf' | 'word' | 'excel' | 'powerpoint' | 'zip' | 'video' | 'imagen'

export type DefinicionTipo = {
  tipo: TipoArchivo
  nombre: string
  extensiones: readonly string[]
  mimes: readonly string[]
  /** Acción que ve el ciudadano. */
  accion: string
  /** Se abre en el navegador (inline) o se descarga (attachment). */
  disposicion: 'inline' | 'attachment'
  /** Clase de color del ícono (Tailwind) y nombre del ícono en el set compartido. */
  color: string
  icono: string
  /** Tamaño máximo por defecto en bytes (configurable en `configuracion`). */
  tamanoMaximo: number
}

const MB = 1024 * 1024
const GB = 1024 * MB

export const TIPOS: readonly DefinicionTipo[] = [
  {
    tipo: 'pdf',
    nombre: 'PDF',
    extensiones: ['pdf'],
    mimes: ['application/pdf'],
    accion: 'Ver PDF',
    disposicion: 'inline',
    color: 'text-red-700',
    icono: 'file-text',
    tamanoMaximo: 50 * MB,
  },
  {
    tipo: 'word',
    nombre: 'Word',
    extensiones: ['doc', 'docx'],
    mimes: [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    accion: 'Descargar Word',
    disposicion: 'attachment',
    color: 'text-blue-700',
    icono: 'file-text',
    tamanoMaximo: 50 * MB,
  },
  {
    tipo: 'excel',
    nombre: 'Excel',
    extensiones: ['xls', 'xlsx', 'csv'],
    mimes: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ],
    accion: 'Descargar Excel',
    disposicion: 'attachment',
    color: 'text-green-700',
    icono: 'file-spreadsheet',
    tamanoMaximo: 50 * MB,
  },
  {
    tipo: 'powerpoint',
    nombre: 'PowerPoint',
    extensiones: ['ppt', 'pptx'],
    mimes: [
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    accion: 'Descargar PowerPoint',
    disposicion: 'attachment',
    color: 'text-orange-700',
    icono: 'presentation',
    tamanoMaximo: 50 * MB,
  },
  {
    tipo: 'zip',
    nombre: 'ZIP',
    extensiones: ['zip'],
    mimes: ['application/zip', 'application/x-zip-compressed'],
    accion: 'Descargar ZIP',
    disposicion: 'attachment',
    color: 'text-amber-700',
    icono: 'file-archive',
    tamanoMaximo: 200 * MB,
  },
  {
    tipo: 'video',
    nombre: 'Video',
    extensiones: ['mp4', 'webm', 'mov'],
    mimes: ['video/mp4', 'video/webm', 'video/quicktime'],
    accion: 'Ver video',
    disposicion: 'inline',
    color: 'text-purple-700',
    icono: 'video',
    tamanoMaximo: 2 * GB,
  },
  {
    tipo: 'imagen',
    nombre: 'Imagen',
    extensiones: ['jpg', 'jpeg', 'png', 'webp'],
    mimes: ['image/jpeg', 'image/png', 'image/webp'],
    accion: 'Ver imagen',
    disposicion: 'inline',
    color: 'text-teal-700',
    icono: 'image',
    tamanoMaximo: 20 * MB,
  },
] as const

export const EXTENSIONES_PERMITIDAS = TIPOS.flatMap((t) => t.extensiones)

export function tipoPorExtension(nombreArchivo: string): DefinicionTipo | undefined {
  const ext = nombreArchivo.split('.').pop()?.toLowerCase() ?? ''
  return TIPOS.find((t) => t.extensiones.includes(ext))
}

export function tipoPorMime(mime: string): DefinicionTipo | undefined {
  return TIPOS.find((t) => t.mimes.includes(mime.toLowerCase()))
}

export function definicion(tipo: TipoArchivo): DefinicionTipo {
  return TIPOS.find((t) => t.tipo === tipo)!
}

/** "2.3 MB", "310 KB" */
export function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`
  if (bytes < GB) return `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`
  return `${(bytes / GB).toFixed(1)} GB`
}

/** "45 min", "1 h 05 min", "3:20" para videos cortos */
export function duracionLegible(segundos: number): string {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = Math.floor(segundos % 60)
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`
  if (m >= 10) return `${m} min`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Formatos de video que quizá no reproduzcan todos los navegadores. */
export function avisoFormatoVideo(nombreArchivo: string): string | null {
  const ext = nombreArchivo.split('.').pop()?.toLowerCase()
  if (ext === 'mov')
    return 'Los archivos .mov no se reproducen en todos los navegadores. Se publicará igual, pero te recomendamos subir MP4.'
  if (ext === 'webm')
    return 'Los archivos .webm no se reproducen en Safari (iPhone). Se publicará igual, pero te recomendamos subir MP4.'
  return null
}
