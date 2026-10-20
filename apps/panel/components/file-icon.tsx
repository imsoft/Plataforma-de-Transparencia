import { definition, type FileType } from '@platform/files/types'
import { cn } from '@platform/ui/lib/utils'
import {
  FileArchiveIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  ImageIcon,
  LinkIcon,
  PresentationIcon,
  VideoIcon,
} from 'lucide-react'

const ICONS = {
  'file-text': FileTextIcon,
  'file-spreadsheet': FileSpreadsheetIcon,
  presentation: PresentationIcon,
  'file-archive': FileArchiveIcon,
  video: VideoIcon,
  image: ImageIcon,
} as const

const COLOR: Record<FileType, string> = {
  pdf: 'text-archivo-pdf bg-archivo-pdf/10',
  word: 'text-archivo-word bg-archivo-word/10',
  excel: 'text-archivo-excel bg-archivo-excel/10',
  powerpoint: 'text-archivo-powerpoint bg-archivo-powerpoint/10',
  zip: 'text-archivo-zip bg-archivo-zip/10',
  video: 'text-archivo-video bg-archivo-video/10',
  image: 'text-archivo-imagen bg-archivo-imagen/10',
}

/** Ícono del tipo de archivo con color fijo por tipo (no depende del tema del municipio). */
export function FileIcon({
  type,
  external,
  className,
}: {
  type: FileType | null
  external?: boolean
  className?: string
}) {
  if (external) {
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
  const def = type ? definition(type) : null
  const Icon = def ? ICONS[def.icon as keyof typeof ICONS] : FileTextIcon
  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg',
        type ? COLOR[type] : 'bg-muted text-muted-foreground',
        className,
      )}
      aria-hidden
    >
      <Icon className="size-5" />
    </span>
  )
}
