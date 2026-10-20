'use client'
import { tamanoLegible, type TipoArchivo } from '@plataforma/archivos/tipos-cliente'
import { campo } from '@/lib/formulario'
import { Badge } from '@plataforma/ui/components/badge'
import { Button } from '@plataforma/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@plataforma/ui/components/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@plataforma/ui/components/dropdown-menu'
import { Input } from '@plataforma/ui/components/input'
import { Label } from '@plataforma/ui/components/label'
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
import { cambiarEstadoDocumento, renombrarDocumento } from '@/acciones/documentos'
import { CopiarEnlace } from '@/components/copiar-enlace'
import { IconoArchivo } from '@/components/icono-archivo'

export type DocFila = {
  id: string
  nombre: string
  estado: 'publicado' | 'oculto' | 'historico' | 'papelera'
  tipo: 'archivo' | 'video_externo'
  tipoArchivo: TipoArchivo | null
  tamano: number | null
  periodoEtiqueta: string | null
  publicadoEn: string
  urlExterna: string | null
}

const ETIQUETA_TIPO: Record<TipoArchivo, string> = {
  pdf: 'PDF',
  word: 'Word',
  excel: 'Excel',
  powerpoint: 'PowerPoint',
  zip: 'ZIP',
  video: 'Video',
  imagen: 'Imagen',
}

export function FilaDocumento({
  slug,
  doc,
  sitio,
  puedeEditar,
}: {
  slug: string
  doc: DocFila
  sitio: string
  puedeEditar: boolean
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [renombrando, setRenombrando] = useState(false)
  const url = `${sitio}/d/${doc.id}`

  function cambiarEstado(estado: DocFila['estado'], mensaje: string) {
    iniciar(async () => {
      const r = await cambiarEstadoDocumento(slug, doc.id, estado)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      const anterior = r.datos.estadoAnterior
      toast(mensaje, {
        duration: 8000,
        action: {
          label: 'Deshacer',
          onClick: () => {
            void cambiarEstadoDocumento(slug, doc.id, anterior).then((u) => {
              if (!u.ok) toast.error(u.error)
              else router.refresh()
            })
          },
        },
      })
      router.refresh()
    })
  }

  const fecha = new Date(doc.publicadoEn).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  })

  return (
    <li className={pendiente ? 'opacity-60' : undefined}>
      <div className="flex items-center gap-3 p-3">
        <IconoArchivo tipo={doc.tipoArchivo} externo={doc.tipo === 'video_externo'} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            <Link href={`/m/${slug}/documentos/${doc.id}`} className="hover:underline">
              {doc.nombre}
            </Link>
          </p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>
              {doc.tipo === 'video_externo'
                ? 'Video (enlace)'
                : doc.tipoArchivo
                  ? ETIQUETA_TIPO[doc.tipoArchivo]
                  : 'Archivo'}
              {doc.tamano ? ` · ${tamanoLegible(doc.tamano)}` : ''}
            </span>
            {doc.periodoEtiqueta && <span>· {doc.periodoEtiqueta}</span>}
            <span>· {fecha}</span>
            {doc.estado === 'oculto' && <Badge variant="secondary">Oculto</Badge>}
            {doc.estado === 'historico' && <Badge variant="secondary">Histórico</Badge>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <CopiarEnlace url={url} size="sm" variant="outline" soloIcono={false} />
          {puedeEditar && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Más opciones de ${doc.nombre}`}
                  />
                }
              >
                <MoreHorizontalIcon aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setRenombrando(true)}>
                  <PencilIcon aria-hidden /> Renombrar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/m/${slug}/documentos/${doc.id}`)}>
                  <HistoryIcon aria-hidden /> Historial y reemplazar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {doc.estado === 'publicado' ? (
                  <DropdownMenuItem
                    onClick={() => cambiarEstado('oculto', 'Documento oculto del sitio público')}
                  >
                    <EyeOffIcon aria-hidden /> Ocultar del sitio
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => cambiarEstado('publicado', 'Documento publicado de nuevo')}
                  >
                    <EyeIcon aria-hidden /> Volver a publicar
                  </DropdownMenuItem>
                )}
                {doc.estado !== 'historico' && (
                  <DropdownMenuItem
                    onClick={() => cambiarEstado('historico', 'Documento marcado como histórico')}
                  >
                    <HistoryIcon aria-hidden /> Mandar a histórico
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => cambiarEstado('papelera', 'Se mandó a la papelera')}
                >
                  <Trash2Icon aria-hidden /> Mandar a la papelera
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <Dialog open={renombrando} onOpenChange={setRenombrando}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const nombre = campo(new FormData(e.currentTarget), 'nombre')
              iniciar(async () => {
                const r = await renombrarDocumento(slug, doc.id, nombre)
                if (!r.ok) {
                  toast.error(r.error)
                  return
                }
                toast.success('Nombre actualizado. El enlace sigue siendo el mismo.')
                setRenombrando(false)
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
                name="nombre"
                defaultValue={doc.nombre}
                required
                minLength={2}
                maxLength={200}
                autoFocus
                className="h-11 text-base"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenombrando(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pendiente}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </li>
  )
}
