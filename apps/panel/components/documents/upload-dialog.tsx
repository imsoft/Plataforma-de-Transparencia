'use client'
import {
  videoFormatWarning,
  ALLOWED_EXTENSIONS,
  suggestedName,
  readableSize,
  typeByExtension,
} from '@platform/files/client-types'
import type { Frequency, PeriodicFrequency } from '@platform/law-index'
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
import { Input } from '@platform/ui/components/input'
import { Label } from '@platform/ui/components/label'
import { Progress } from '@platform/ui/components/progress'
import { cn } from '@platform/ui/lib/utils'
import {
  CheckCircle2Icon,
  FileUpIcon,
  LinkIcon,
  Loader2Icon,
  UploadIcon,
  XIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createExternalVideo, prepareUpload, publishDocuments } from '@/actions/uploads'
import { publishVideo } from '@/actions/videos'
import {
  analyzeVideo,
  forgetUpload,
  uploadVideoInParts,
  type UploadState,
} from '@/lib/video-upload'
import { CopyLink } from '@/components/copy-link'
import { chosenPeriod, PeriodSelector, NO_PERIOD, type ChosenPeriod } from './period-selector'

type UploadFile = {
  id: string
  file: File
  name: string
  year: number
  part: number
  progress: number
  status: 'waiting' | 'uploading' | 'ready' | 'error'
  error?: string
  tempPath?: string
  video?: {
    upload: UploadState
    durationSec: number | null
    thumbnailBase64: string | null
    warning: string | null
  }
}

const hasPeriod = (p: Frequency): p is PeriodicFrequency => p !== 'permanent'

export function UploadDocuments(props: {
  slug: string
  obligatedSubjectId: string
  nodeId: string
  nodeTitle: string
  frequency: Frequency
  openInitially?: boolean
  site: string
}) {
  const [open, setOpen] = useState(props.openInitially ?? false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" className="h-11" />}>
        <UploadIcon aria-hidden /> Subir documento
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        {open && <Wizard {...props} close={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function Wizard({
  slug,
  obligatedSubjectId,
  nodeId,
  nodeTitle,
  frequency,
  site,
  close,
}: {
  slug: string
  obligatedSubjectId: string
  nodeId: string
  nodeTitle: string
  frequency: Frequency
  site: string
  close: () => void
}) {
  const router = useRouter()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [mode, setMode] = useState<'files' | 'video'>('files')
  const [publishing, setPublishing] = useState(false)
  const [created, setCreatedItems] = useState<{ id: string; name: string }[] | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const today = new Date()

  const update = (id: string, changes: Partial<UploadFile>) =>
    setFiles((prev) => prev.map((a) => (a.id === id ? { ...a, ...changes } : a)))

  const uploadOne = useCallback(
    async (a: UploadFile) => {
      update(a.id, { status: 'uploading', progress: 0 })
      if (typeByExtension(a.file.name)?.type === 'video') {
        try {
          const [analysis, upload] = await Promise.all([
            analyzeVideo(a.file),
            uploadVideoInParts({
              slug,
              obligatedSubjectId,
              nodeId,
              file: a.file,
              onProgress: (p) => update(a.id, { progress: p }),
            }),
          ])
          const warning =
            videoFormatWarning(a.file.name) ??
            (analysis.playable
              ? null
              : 'Este navegador no pudo reproducir el video; se publicará igual con opción de descarga.')
          update(a.id, {
            status: 'ready',
            progress: 100,
            video: {
              upload,
              durationSec: analysis.durationSec,
              thumbnailBase64: analysis.thumbnailBase64,
              warning,
            },
          })
        } catch (e) {
          update(a.id, {
            status: 'error',
            error: e instanceof Error ? e.message : 'No se pudo subir el video.',
          })
        }
        return
      }
      const r = await prepareUpload({
        slug,
        obligatedSubjectId,
        nodeId,
        fileName: a.file.name,
        size: a.file.size,
      })
      if (!r.ok) return update(a.id, { status: 'error', error: r.error })
      try {
        await putWithProgress(r.data.url, a.file, r.data.contentType, (p) =>
          update(a.id, { progress: p }),
        )
        update(a.id, { status: 'ready', progress: 100, tempPath: r.data.tempPath })
      } catch {
        update(a.id, {
          status: 'error',
          error: 'Se perdió la conexión al subir. Revisa tu internet y vuelve a intentar.',
        })
      }
    },
    [slug, obligatedSubjectId, nodeId],
  )

  const add = (list: FileList | File[]) => {
    const newItems: UploadFile[] = []
    for (const file of Array.from(list)) {
      const def = typeByExtension(file.name)
      const { name, period } = suggestedName(file.name)
      let year = today.getFullYear()
      let part =
        frequency === 'monthly'
          ? today.getMonth() + 1
          : frequency === 'quarterly'
            ? Math.ceil((today.getMonth() + 1) / 3)
            : frequency === 'semiannual'
              ? today.getMonth() < 6
                ? 1
                : 2
              : 1
      if (period) {
        year = period.year
        if (period.type === 'month' && frequency === 'monthly') part = period.month
        if (period.type === 'month' && frequency === 'quarterly') part = Math.ceil(period.month / 3)
        if (period.type === 'quarter' && frequency === 'quarterly') part = period.quarter
      }
      const a: UploadFile = {
        id: crypto.randomUUID(),
        file,
        name,
        year,
        part,
        progress: 0,
        status: 'waiting',
      }
      if (!def) {
        a.status = 'error'
        a.error = `Solo se pueden subir ${ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(', ')}.`
      } else if (file.size > def.maxSize) {
        a.status = 'error'
        a.error = `Pesa ${readableSize(file.size)} y el máximo es ${readableSize(def.maxSize)}. Intenta comprimirlo o dividirlo.`
      }
      newItems.push(a)
    }
    setFiles((prev) => [...prev, ...newItems])
    newItems.filter((a) => a.status === 'waiting').forEach((a) => void uploadOne(a))
  }

  const ready = files.filter((a) => a.status === 'ready')
  const canPublish =
    files.length > 0 &&
    files.every((a) => a.status === 'ready' || a.status === 'error') &&
    ready.length > 0 &&
    ready.every((a) => a.name.trim().length >= 2)

  async function publish() {
    setPublishing(true)
    const periodOf = (a: UploadFile) =>
      hasPeriod(frequency) ? chosenPeriod(frequency, a.year, a.part) : NO_PERIOD
    const videos = ready.filter((a) => a.video)
    const publishedItems: { id: string; name: string }[] = []
    for (const v of videos) {
      const r = await publishVideo({
        slug,
        obligatedSubjectId,
        nodeId,
        tempPath: v.video!.upload.tempPath,
        uploadId: v.video!.upload.uploadId,
        parts: v.video!.upload.parts,
        originalName: v.file.name,
        name: v.name.trim(),
        period: periodOf(v),
        durationSec: v.video!.durationSec,
        thumbnailBase64: v.video!.thumbnailBase64,
      })
      if (!r.ok) {
        setPublishing(false)
        return toast.error(`${v.file.name}: ${r.error}`)
      }
      forgetUpload(slug, v.file)
      publishedItems.push(r.data)
    }
    const regularFiles = ready.filter((a) => !a.video)
    if (regularFiles.length === 0) {
      setPublishing(false)
      setCreatedItems(publishedItems)
      router.refresh()
      return
    }
    const r = await publishDocuments({
      slug,
      obligatedSubjectId,
      nodeId,
      files: regularFiles.map((a) => ({
        tempPath: a.tempPath!,
        originalName: a.file.name,
        name: a.name.trim(),
        period: hasPeriod(frequency) ? chosenPeriod(frequency, a.year, a.part) : NO_PERIOD,
      })),
    })
    setPublishing(false)
    if (!r.ok) return toast.error(r.error)
    setCreatedItems([...publishedItems, ...r.data])
    router.refresh()
  }

  if (created) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2Icon className="text-green-600" aria-hidden /> ¡Listo! Ya está publicado
          </DialogTitle>
          <DialogDescription>
            Comparte el enlace permanente de cada documento. Nunca cambia, aunque lo renombres o
            reemplaces.
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y rounded-lg border">
          {created.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 p-3">
              <span className="min-w-0 truncate text-sm font-medium">{d.name}</span>
              <CopyLink url={`${site}/d/${d.id}`} />
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button onClick={close}>Cerrar</Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Subir a {nodeTitle}</DialogTitle>
        <DialogDescription>
          {mode === 'files'
            ? 'Paso 2 de 3 · Elige el archivo. Mientras sube, confirma su nombre.'
            : 'Pega el enlace del video de YouTube o Facebook.'}
        </DialogDescription>
      </DialogHeader>

      {mode === 'video' ? (
        <VideoForm
          slug={slug}
          obligatedSubjectId={obligatedSubjectId}
          nodeId={nodeId}
          frequency={frequency}
          site={site}
          returnTo={() => setMode('files')}
          close={close}
        />
      ) : (
        <>
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
            onDragOver={(e) => (e.preventDefault(), setDragging(true))}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              add(e.dataTransfer.files)
            }}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors',
              dragging ? 'border-primary bg-primary/5' : 'hover:bg-accent/50',
            )}
          >
            <FileUpIcon className="size-8 text-primary" aria-hidden />
            <p className="font-medium">
              Arrastra aquí tus archivos <span className="text-muted-foreground">o</span>
            </p>
            <Button type="button" variant="secondary" className="pointer-events-none h-11">
              Elegir archivos
            </Button>
            <p className="text-xs text-muted-foreground">
              PDF, Word, Excel, PowerPoint, ZIP, imagen o video · máx. 50 MB (ZIP 200 MB, video 2
              GB)
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')}
              className="sr-only"
              onChange={(e) => e.target.files && (add(e.target.files), (e.target.value = ''))}
            />
          </div>

          <Button
            type="button"
            variant="link"
            className="self-start px-0"
            onClick={() => setMode('video')}
          >
            <LinkIcon aria-hidden /> Agregar enlace de video (YouTube / Facebook)
          </Button>

          {files.length > 0 && (
            <ul className="flex flex-col gap-3">
              {files.map((a) => (
                <li key={a.id} className="rounded-lg border p-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-muted-foreground">
                        {a.file.name} · {readableSize(a.file.size)}
                      </p>
                      {a.status === 'uploading' && (
                        <div className="mt-1 flex items-center gap-2">
                          <Progress
                            value={a.progress}
                            className="h-2"
                            aria-label={`Subiendo ${a.file.name}`}
                          />
                          <span className="w-10 text-right text-xs tabular-nums">
                            {a.progress}%
                          </span>
                        </div>
                      )}
                      {a.status === 'ready' && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-green-700">
                          <CheckCircle2Icon className="size-3.5" aria-hidden />{' '}
                          {a.video ? 'Video subido' : 'Archivo subido'}
                        </p>
                      )}
                      {a.video?.warning && (
                        <p className="mt-1 text-xs text-amber-700">{a.video.warning}</p>
                      )}
                      {a.status === 'uploading' &&
                        a.video === undefined &&
                        typeByExtension(a.file.name)?.type === 'video' && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Los videos suben por partes. Si se corta la conexión, al volver a elegir
                            el archivo continúa donde se quedó.
                          </p>
                        )}
                      {a.status === 'error' && (
                        <p role="alert" className="mt-1 text-xs text-destructive">
                          {a.error}
                          {a.error?.includes('conexión') && (
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="h-auto px-1"
                              onClick={() => void uploadOne(a)}
                            >
                              Reintentar
                            </Button>
                          )}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Quitar ${a.file.name}`}
                      onClick={() => setFiles((prev) => prev.filter((x) => x.id !== a.id))}
                    >
                      <XIcon aria-hidden />
                    </Button>
                  </div>
                  {a.status !== 'error' && (
                    <div className="mt-3 flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`nombre-${a.id}`}>Nombre que verán los ciudadanos</Label>
                        <Input
                          id={`nombre-${a.id}`}
                          value={a.name}
                          onChange={(e) => update(a.id, { name: e.target.value })}
                          className="h-11 text-base"
                          maxLength={200}
                        />
                      </div>
                      {hasPeriod(frequency) && (
                        <PeriodSelector
                          frequency={frequency}
                          year={a.year}
                          part={a.part}
                          onChange={(year, part) => update(a.id, { year, part })}
                        />
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <DialogFooter className="sticky bottom-0 bg-background pt-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={publish}
              disabled={!canPublish || publishing}
              className="h-11"
            >
              {publishing && <Loader2Icon className="animate-spin" aria-hidden />}
              {files.some((a) => a.status === 'uploading')
                ? 'Publicando cuando termine la subida…'
                : `Publicar${ready.length > 1 ? ` ${ready.length} documentos` : ''}`}
            </Button>
          </DialogFooter>
        </>
      )}
    </>
  )
}

function VideoForm({
  slug,
  obligatedSubjectId,
  nodeId,
  frequency,
  site,
  returnTo,
  close,
}: {
  slug: string
  obligatedSubjectId: string
  nodeId: string
  frequency: Frequency
  site: string
  returnTo: () => void
  close: () => void
}) {
  const router = useRouter()
  const today = new Date()
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [year, setYear] = useState(today.getFullYear())
  const [part, setPart] = useState(
    frequency === 'monthly'
      ? today.getMonth() + 1
      : frequency === 'quarterly'
        ? Math.ceil((today.getMonth() + 1) / 3)
        : 1,
  )
  const [sending, setSending] = useState(false)
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    const period: ChosenPeriod = hasPeriod(frequency)
      ? chosenPeriod(frequency, year, part)
      : NO_PERIOD
    const r = await createExternalVideo({
      slug,
      obligatedSubjectId,
      nodeId,
      url: url.trim(),
      name: name.trim(),
      period,
    })
    setSending(false)
    if (!r.ok) return toast.error(r.error)
    setCreated(r.data)
    router.refresh()
  }

  if (created) {
    return (
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-2 font-medium">
          <CheckCircle2Icon className="text-green-600" aria-hidden /> Video publicado
        </p>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <span className="truncate text-sm">{created.name}</span>
          <CopyLink url={`${site}/d/${created.id}`} />
        </div>
        <DialogFooter>
          <Button onClick={close}>Cerrar</Button>
        </DialogFooter>
      </div>
    )
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="video-url">Enlace del video</Label>
        <Input
          id="video-url"
          type="url"
          inputMode="url"
          placeholder="https://www.youtube.com/watch?v=…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          className="h-11 text-base"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="video-nombre">Nombre que verán los ciudadanos</Label>
        <Input
          id="video-nombre"
          placeholder="Sesión ordinaria de cabildo · marzo 2026"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={200}
          className="h-11 text-base"
        />
      </div>
      {hasPeriod(frequency) && (
        <PeriodSelector
          frequency={frequency}
          year={year}
          part={part}
          onChange={(a, p) => (setYear(a), setPart(p))}
        />
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={returnTo}>
          Volver
        </Button>
        <Button type="submit" disabled={sending} className="h-11">
          {sending && <Loader2Icon className="animate-spin" aria-hidden />} Publicar video
        </Button>
      </DialogFooter>
    </form>
  )
}

/** PUT con XMLHttpRequest para tener progreso (fetch no lo expone en subidas). */
function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (p: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.setRequestHeader('Content-Disposition', 'attachment')
    xhr.upload.onprogress = (e) =>
      e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`))
    xhr.onerror = () => reject(new Error('red'))
    xhr.send(file)
  })
}
