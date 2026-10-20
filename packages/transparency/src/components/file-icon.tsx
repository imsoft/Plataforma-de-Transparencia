import { definition, type FileType } from '@platform/files/types'
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

/** Colores fijos por tipo (variables --color-archivo-* de @platform/ui), independientes del tema. */
const COLOR: Record<FileType, string> = {
  pdf: 'text-archivo-pdf bg-archivo-pdf/10',
  word: 'text-archivo-word bg-archivo-word/10',
  excel: 'text-archivo-excel bg-archivo-excel/10',
  powerpoint: 'text-archivo-powerpoint bg-archivo-powerpoint/10',
  zip: 'text-archivo-zip bg-archivo-zip/10',
  video: 'text-archivo-video bg-archivo-video/10',
  image: 'text-archivo-imagen bg-archivo-imagen/10',
}

export function FileIcon({
  type,
  external = false,
  className = 'size-10',
}: {
  type: FileType | null
  external?: boolean
  className?: string
}) {
  if (external) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg text-archivo-video bg-archivo-video/10 ${className}`}
        aria-hidden="true"
      >
        <LinkIcon className="size-1/2" />
      </span>
    )
  }
  const def = type ? definition(type) : null
  const Icon = def ? ICONS[def.icon as keyof typeof ICONS] : FileTextIcon
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg ${type ? COLOR[type] : 'bg-neutral-100 text-neutral-500'} ${className}`}
      aria-hidden="true"
    >
      <Icon className="size-1/2" />
    </span>
  )
}
