'use client'
import { ALLOWED_EXTENSIONS, readableSize, typeByExtension } from '@platform/files/client-types'
import { Button } from '@platform/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@platform/ui/components/dialog'
import { Progress } from '@platform/ui/components/progress'
import { Loader2Icon, RefreshCwIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { prepareReplacement, replaceFile } from '@/actions/replacement'

export function ReplaceFile({
  slug,
  documentId,
  currentName,
}: {
  slug: string
  documentId: string
  currentName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function send() {
    if (!file) return
    const def = typeByExtension(file.name)
    if (!def) return toast.error('Ese tipo de archivo no se puede publicar.')
    if (file.size > def.maxSize)
      return toast.error(
        `Pesa ${readableSize(file.size)} y el máximo es ${readableSize(def.maxSize)}.`,
      )
    setBusy(true)
    const p = await prepareReplacement({
      slug,
      documentId,
      fileName: file.name,
      size: file.size,
    })
    if (!p.ok) return (setBusy(false), toast.error(p.error))
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', p.data.url)
        xhr.setRequestHeader('Content-Type', p.data.contentType)
        xhr.setRequestHeader('Content-Disposition', 'attachment')
        xhr.upload.onprogress = (e) =>
          e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100))
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(String(xhr.status))))
        xhr.onerror = () => reject(new Error('red'))
        xhr.send(file)
      })
    } catch {
      setBusy(false)
      return toast.error('Se perdió la conexión al subir. Intenta de nuevo.')
    }
    const r = await replaceFile({
      slug,
      documentId,
      tempPath: p.data.tempPath,
      originalName: file.name,
    })
    setBusy(false)
    if (!r.ok) return toast.error(r.error)
    toast.success(
      'Archivo reemplazado. La versión anterior se conserva en el historial y el enlace sigue igual.',
    )
    setOpen(false)
    setFile(null)
    setProgress(null)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <RefreshCwIcon aria-hidden /> Reemplazar archivo
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reemplazar archivo</DialogTitle>
          <DialogDescription>
            Sube la versión nueva de <strong>{currentName}</strong>. La anterior se guarda y el
            enlace permanente no cambia.
          </DialogDescription>
        </DialogHeader>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')}
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="secondary"
          className="h-11"
          onClick={() => inputRef.current?.click()}
        >
          {file ? `${file.name} · ${readableSize(file.size)}` : 'Elegir archivo'}
        </Button>
        {progress !== null && <Progress value={progress} className="h-2" aria-label="Subiendo" />}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={send} disabled={!file || busy}>
            {busy && <Loader2Icon className="animate-spin" aria-hidden />} Reemplazar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
