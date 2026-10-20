/**
 * Catálogo único de tipos de archivo permitidos (sección 5.8). Lo usan panel, sitios y validación.
 * Los colores son fijos por tipo (no cambian con el tema) y cumplen contraste sobre blanco.
 */
export type FileType = 'pdf' | 'word' | 'excel' | 'powerpoint' | 'zip' | 'video' | 'image'

export type FileTypeDefinition = {
  type: FileType
  name: string
  extensions: readonly string[]
  mimes: readonly string[]
  /** Acción que ve el ciudadano. */
  action: string
  /** Se abre en el navegador (inline) o se descarga (attachment). */
  disposition: 'inline' | 'attachment'
  /** Clase de color del ícono (Tailwind) y nombre del ícono en el set compartido. */
  color: string
  icon: string
  /** Tamaño máximo por defecto en bytes (configurable en `configuracion`). */
  maxSize: number
}

const MB = 1024 * 1024
const GB = 1024 * MB

export const FILE_TYPES: readonly FileTypeDefinition[] = [
  {
    type: 'pdf',
    name: 'PDF',
    extensions: ['pdf'],
    mimes: ['application/pdf'],
    action: 'Ver PDF',
    disposition: 'inline',
    color: 'text-red-700',
    icon: 'file-text',
    maxSize: 50 * MB,
  },
  {
    type: 'word',
    name: 'Word',
    extensions: ['doc', 'docx'],
    mimes: [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    action: 'Descargar Word',
    disposition: 'attachment',
    color: 'text-blue-700',
    icon: 'file-text',
    maxSize: 50 * MB,
  },
  {
    type: 'excel',
    name: 'Excel',
    extensions: ['xls', 'xlsx', 'csv'],
    mimes: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ],
    action: 'Descargar Excel',
    disposition: 'attachment',
    color: 'text-green-700',
    icon: 'file-spreadsheet',
    maxSize: 50 * MB,
  },
  {
    type: 'powerpoint',
    name: 'PowerPoint',
    extensions: ['ppt', 'pptx'],
    mimes: [
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    action: 'Descargar PowerPoint',
    disposition: 'attachment',
    color: 'text-orange-700',
    icon: 'presentation',
    maxSize: 50 * MB,
  },
  {
    type: 'zip',
    name: 'ZIP',
    extensions: ['zip'],
    mimes: ['application/zip', 'application/x-zip-compressed'],
    action: 'Descargar ZIP',
    disposition: 'attachment',
    color: 'text-amber-700',
    icon: 'file-archive',
    maxSize: 200 * MB,
  },
  {
    type: 'video',
    name: 'Video',
    extensions: ['mp4', 'webm', 'mov'],
    mimes: ['video/mp4', 'video/webm', 'video/quicktime'],
    action: 'Ver video',
    disposition: 'inline',
    color: 'text-purple-700',
    icon: 'video',
    maxSize: 2 * GB,
  },
  {
    type: 'image',
    name: 'Imagen',
    extensions: ['jpg', 'jpeg', 'png', 'webp'],
    mimes: ['image/jpeg', 'image/png', 'image/webp'],
    action: 'Ver imagen',
    disposition: 'inline',
    color: 'text-teal-700',
    icon: 'image',
    maxSize: 20 * MB,
  },
] as const

export const ALLOWED_EXTENSIONS = FILE_TYPES.flatMap((t) => t.extensions)

export function typeByExtension(fileName: string): FileTypeDefinition | undefined {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  return FILE_TYPES.find((t) => t.extensions.includes(ext))
}

export function typeByMime(mime: string): FileTypeDefinition | undefined {
  return FILE_TYPES.find((t) => t.mimes.includes(mime.toLowerCase()))
}

export function definition(type: FileType): FileTypeDefinition {
  return FILE_TYPES.find((t) => t.type === type)!
}

/** "2.3 MB", "310 KB" */
export function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`
  if (bytes < GB) return `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`
  return `${(bytes / GB).toFixed(1)} GB`
}

/** "45 min", "1 h 05 min", "3:20" para videos cortos */
export function readableDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`
  if (m >= 10) return `${m} min`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Formatos de video que quizá no reproduzcan todos los navegadores. */
export function videoFormatWarning(fileName: string): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (ext === 'mov')
    return 'Los archivos .mov no se reproducen en todos los navegadores. Se publicará igual, pero te recomendamos subir MP4.'
  if (ext === 'webm')
    return 'Los archivos .webm no se reproducen en Safari (iPhone). Se publicará igual, pero te recomendamos subir MP4.'
  return null
}
