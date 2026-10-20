import { definicion, type TipoArchivo } from '@plataforma/archivos/tipos'
import { cn } from '@plataforma/ui/lib/utils'
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

const COLOR: Record<TipoArchivo, string> = {
  pdf: 'text-archivo-pdf bg-archivo-pdf/10',
  word: 'text-archivo-word bg-archivo-word/10',
  excel: 'text-archivo-excel bg-archivo-excel/10',
  powerpoint: 'text-archivo-powerpoint bg-archivo-powerpoint/10',
  zip: 'text-archivo-zip bg-archivo-zip/10',
  video: 'text-archivo-video bg-archivo-video/10',
  imagen: 'text-archivo-imagen bg-archivo-imagen/10',
}

/** Ícono del tipo de archivo con color fijo por tipo (no depende del tema del municipio). */
export function IconoArchivo({
  tipo,
  externo,
  className,
}: {
  tipo: TipoArchivo | null
  externo?: boolean
  className?: string
}) {
  if (externo) {
    return (
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-lg text-archivo-video bg-archivo-video/10',
          className,
        )}
        aria-hidden
      >
        <LinkIcon className="size-5" />
      </span>
    )
  }
  const def = tipo ? definicion(tipo) : null
  const Icono = def ? ICONOS[def.icono as keyof typeof ICONOS] : FileTextIcon
  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg',
        tipo ? COLOR[tipo] : 'bg-muted text-muted-foreground',
        className,
      )}
      aria-hidden
    >
      <Icono className="size-5" />
    </span>
  )
}
