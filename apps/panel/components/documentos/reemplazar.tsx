'use client'
import {
  EXTENSIONES_PERMITIDAS,
  tamanoLegible,
  tipoPorExtension,
} from '@plataforma/archivos/tipos-cliente'
import { Button } from '@plataforma/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@plataforma/ui/components/dialog'
import { Progress } from '@plataforma/ui/components/progress'
import { Loader2Icon, RefreshCwIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { prepararReemplazo, reemplazarArchivo } from '@/acciones/reemplazo'

export function Reemplazar({
  slug,
  documentoId,
  nombreActual,
}: {
  slug: string
  documentoId: string
  nombreActual: string
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [progreso, setProgreso] = useState<number | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function enviar() {
    if (!archivo) return
    const def = tipoPorExtension(archivo.name)
    if (!def) return toast.error('Ese tipo de archivo no se puede publicar.')
    if (archivo.size > def.tamanoMaximo)
      return toast.error(
        `Pesa ${tamanoLegible(archivo.size)} y el máximo es ${tamanoLegible(def.tamanoMaximo)}.`,
      )
    setOcupado(true)
    const p = await prepararReemplazo({
      slug,
      documentoId,
      nombreArchivo: archivo.name,
      tamano: archivo.size,
    })
    if (!p.ok) return (setOcupado(false), toast.error(p.error))
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', p.datos.url)
        xhr.setRequestHeader('Content-Type', p.datos.contentType)
        xhr.setRequestHeader('Content-Disposition', 'attachment')
        xhr.upload.onprogress = (e) =>
          e.lengthComputable && setProgreso(Math.round((e.loaded / e.total) * 100))
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(String(xhr.status))))
        xhr.onerror = () => reject(new Error('red'))
        xhr.send(archivo)
      })
    } catch {
      setOcupado(false)
      return toast.error('Se perdió la conexión al subir. Intenta de nuevo.')
    }
    const r = await reemplazarArchivo({
      slug,
      documentoId,
      rutaTemporal: p.datos.rutaTemporal,
      nombreOriginal: archivo.name,
    })
    setOcupado(false)
    if (!r.ok) return toast.error(r.error)
    toast.success(
      'Archivo reemplazado. La versión anterior se conserva en el historial y el enlace sigue igual.',
    )
    setAbierto(false)
    setArchivo(null)
    setProgreso(null)
    router.refresh()
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button variant="outline" />}>
        <RefreshCwIcon aria-hidden /> Reemplazar archivo
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reemplazar archivo</DialogTitle>
          <DialogDescription>
            Sube la versión nueva de <strong>{nombreActual}</strong>. La anterior se guarda y el
            enlace permanente no cambia.
          </DialogDescription>
        </DialogHeader>
        <input
          ref={inputRef}
          type="file"
          accept={EXTENSIONES_PERMITIDAS.map((e) => `.${e}`).join(',')}
          className="sr-only"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="secondary"
          className="h-11"
          onClick={() => inputRef.current?.click()}
        >
          {archivo ? `${archivo.name} · ${tamanoLegible(archivo.size)}` : 'Elegir archivo'}
        </Button>
        {progreso !== null && <Progress value={progreso} className="h-2" aria-label="Subiendo" />}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={enviar} disabled={!archivo || ocupado}>
            {ocupado && <Loader2Icon className="animate-spin" aria-hidden />} Reemplazar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
