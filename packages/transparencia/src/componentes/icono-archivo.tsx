import { definicion, type TipoArchivo } from '@plataforma/archivos/tipos'
import {
  FileArchiveIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  ImageIcon,
  LinkIcon,
  PresentationIcon,
  VideoIcon,
} from 'lucide-react'

const ICONOS = {
  'file-text': FileTextIcon,
  'file-spreadsheet': FileSpreadsheetIcon,
  presentation: PresentationIcon,
  'file-archive': FileArchiveIcon,
  video: VideoIcon,
  image: ImageIcon,
} as const

/** Colores fijos por tipo (variables --color-archivo-* de @plataforma/ui), independientes del tema. */
const COLOR: Record<TipoArchivo, string> = {
  pdf: 'text-archivo-pdf bg-archivo-pdf/10',
  word: 'text-archivo-word bg-archivo-word/10',
  excel: 'text-archivo-excel bg-archivo-excel/10',
  powerpoint: 'text-archivo-powerpoint bg-archivo-powerpoint/10',
  zip: 'text-archivo-zip bg-archivo-zip/10',
  video: 'text-archivo-video bg-archivo-video/10',
  imagen: 'text-archivo-imagen bg-archivo-imagen/10',
}

export function IconoArchivo({
  tipo,
  externo = false,
  className = 'size-10',
}: {
  tipo: TipoArchivo | null
  externo?: boolean
  className?: string
}) {
  if (externo) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg text-archivo-video bg-archivo-video/10 ${className}`}
        aria-hidden="true"
      >
        <LinkIcon className="size-1/2" />
      </span>
    )
  }
  const def = tipo ? definicion(tipo) : null
  const Icono = def ? ICONOS[def.icono as keyof typeof ICONOS] : FileTextIcon
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg ${tipo ? COLOR[tipo] : 'bg-neutral-100 text-neutral-500'} ${className}`}
      aria-hidden="true"
    >
      <Icono className="size-1/2" />
    </span>
  )
}
