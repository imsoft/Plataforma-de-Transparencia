'use client'
import { readableSize, type FileType } from '@platform/files/client-types'
import { field } from '@/lib/form'
import { Badge } from '@platform/ui/components/badge'
import { Button } from '@platform/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@platform/ui/components/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@platform/ui/components/dropdown-menu'
import { Input } from '@platform/ui/components/input'
import { Label } from '@platform/ui/components/label'
import {
  EyeIcon,
  EyeOffIcon,
  HistoryIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { changeDocumentStatus, renameDocument } from '@/actions/documents'
import { CopyLink } from '@/components/copy-link'
import { FileIcon } from '@/components/file-icon'

export type DocRow = {
  id: string
  name: string
  status: 'published' | 'hidden' | 'historical' | 'trash'
  type: 'file' | 'external_video'
  fileType: FileType | null
  size: number | null
  periodLabel: string | null
  publishedAt: string
  externalUrl: string | null
}

const TYPE_LABEL: Record<FileType, string> = {
  pdf: 'PDF',
  word: 'Word',
  excel: 'Excel',
  powerpoint: 'PowerPoint',
  zip: 'ZIP',
  video: 'Video',
  image: 'Imagen',
}

export function DocumentRow({
  slug,
  doc,
  site,
  canEdit,
}: {
  slug: string
  doc: DocRow
  site: string
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [renaming, setRenaming] = useState(false)
  const url = `${site}/d/${doc.id}`

  function changeStatus(status: DocRow['status'], message: string) {
    start(async () => {
      const r = await changeDocumentStatus(slug, doc.id, status)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      const previous = r.data.previousStatus
      toast(message, {
        duration: 8000,
        action: {
          label: 'Deshacer',
          onClick: () => {
            void changeDocumentStatus(slug, doc.id, previous).then((u) => {
              if (!u.ok) toast.error(u.error)
              else router.refresh()
            })
          },
        },
      })
      router.refresh()
    })
  }

  const date = new Date(doc.publishedAt).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  })

  return (
    <li className={pending ? 'opacity-60' : undefined}>
      <div className="flex items-center gap-3 p-3">
        <FileIcon type={doc.fileType} external={doc.type === 'external_video'} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            <Link href={`/m/${slug}/documentos/${doc.id}`} className="hover:underline">
              {doc.name}
            </Link>
          </p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>
              {doc.type === 'external_video'
                ? 'Video (enlace)'
                : doc.fileType
                  ? TYPE_LABEL[doc.fileType]
                  : 'Archivo'}
              {doc.size ? ` · ${readableSize(doc.size)}` : ''}
            </span>
            {doc.periodLabel && <span>· {doc.periodLabel}</span>}
            <span>· {date}</span>
            {doc.status === 'hidden' && <Badge variant="secondary">Oculto</Badge>}
            {doc.status === 'historical' && <Badge variant="secondary">Histórico</Badge>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <CopyLink url={url} size="sm" variant="outline" iconOnly={false} />
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" aria-label={`Más opciones de ${doc.name}`} />
                }
              >
                <MoreHorizontalIcon aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setRenaming(true)}>
                  <PencilIcon aria-hidden /> Renombrar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/m/${slug}/documentos/${doc.id}`)}>
                  <HistoryIcon aria-hidden /> Historial y reemplazar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {doc.status === 'published' ? (
                  <DropdownMenuItem
                    onClick={() => changeStatus('hidden', 'Documento oculto del sitio público')}
                  >
                    <EyeOffIcon aria-hidden /> Ocultar del sitio
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => changeStatus('published', 'Documento publicado de nuevo')}
                  >
                    <EyeIcon aria-hidden /> Volver a publicar
                  </DropdownMenuItem>
                )}
                {doc.status !== 'historical' && (
                  <DropdownMenuItem
                    onClick={() => changeStatus('historical', 'Documento marcado como histórico')}
                  >
                    <HistoryIcon aria-hidden /> Mandar a histórico
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => changeStatus('trash', 'Se mandó a la papelera')}
                >
                  <Trash2Icon aria-hidden /> Mandar a la papelera
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const name = field(new FormData(e.currentTarget), 'name')
              start(async () => {
                const r = await renameDocument(slug, doc.id, name)
                if (!r.ok) {
                  toast.error(r.error)
                  return
                }
                toast.success('Nombre actualizado. El enlace sigue siendo el mismo.')
                setRenaming(false)
                router.refresh()
              })
            }}
            className="flex flex-col gap-4"
          >
            <DialogHeader>
              <DialogTitle>Renombrar documento</DialogTitle>
              <DialogDescription>El enlace permanente no cambia.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`ren-${doc.id}`}>Nombre que verán los ciudadanos</Label>
              <Input
                id={`ren-${doc.id}`}
                name="name"
                defaultValue={doc.name}
                required
                minLength={2}
                maxLength={200}
                autoFocus
                className="h-11 text-base"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenaming(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </li>
  )
}
