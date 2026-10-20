'use client'
import {
  avisoFormatoVideo,
  EXTENSIONES_PERMITIDAS,
  nombreSugerido,
  tamanoLegible,
  tipoPorExtension,
} from '@plataforma/archivos/tipos-cliente'
import type { Periodicidad, PeriodicidadConPeriodo } from '@plataforma/indice'
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
import { Input } from '@plataforma/ui/components/input'
import { Label } from '@plataforma/ui/components/label'
import { Progress } from '@plataforma/ui/components/progress'
import { cn } from '@plataforma/ui/lib/utils'
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
import { crearVideoExterno, prepararSubida, publicarDocumentos } from '@/acciones/subidas'
import { publicarVideo } from '@/acciones/videos'
import {
  analizarVideo,
  olvidarSubida,
  subirVideoPorPartes,
  type EstadoSubida,
} from '@/lib/subida-video'
import { CopiarEnlace } from '@/components/copiar-enlace'
import {
  periodoElegido,
  SelectorPeriodo,
  SIN_PERIODO,
  type PeriodoElegido,
} from './selector-periodo'

type Archivo = {
  id: string
  file: File
  nombre: string
  anio: number
  parte: number
  progreso: number
  estado: 'esperando' | 'subiendo' | 'listo' | 'error'
  error?: string
  rutaTemporal?: string
  video?: {
    subida: EstadoSubida
    duracionSeg: number | null
    miniaturaBase64: string | null
    aviso: string | null
  }
}

const esConPeriodo = (p: Periodicidad): p is PeriodicidadConPeriodo => p !== 'permanente'

export function SubirDocumentos(props: {
  slug: string
  sujetoObligadoId: string
  nodoId: string
  nodoTitulo: string
  periodicidad: Periodicidad
  abrirInicial?: boolean
  sitio: string
}) {
  const [abierto, setAbierto] = useState(props.abrirInicial ?? false)
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button size="lg" className="h-11" />}>
        <UploadIcon aria-hidden /> Subir documento
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        {abierto && <Asistente {...props} cerrar={() => setAbierto(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function Asistente({
  slug,
  sujetoObligadoId,
  nodoId,
  nodoTitulo,
  periodicidad,
  sitio,
  cerrar,
}: {
  slug: string
  sujetoObligadoId: string
  nodoId: string
  nodoTitulo: string
  periodicidad: Periodicidad
  sitio: string
  cerrar: () => void
}) {
  const router = useRouter()
  const [archivos, setArchivos] = useState<Archivo[]>([])
  const [modo, setModo] = useState<'archivos' | 'video'>('archivos')
  const [publicando, setPublicando] = useState(false)
  const [creados, setCreados] = useState<{ id: string; nombre: string }[] | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hoy = new Date()

  const actualizar = (id: string, cambios: Partial<Archivo>) =>
    setArchivos((prev) => prev.map((a) => (a.id === id ? { ...a, ...cambios } : a)))

  const subir = useCallback(
    async (a: Archivo) => {
      actualizar(a.id, { estado: 'subiendo', progreso: 0 })
      if (tipoPorExtension(a.file.name)?.tipo === 'video') {
        try {
          const [analisis, subida] = await Promise.all([
            analizarVideo(a.file),
            subirVideoPorPartes({
              slug,
              sujetoObligadoId,
              nodoId,
              file: a.file,
              onProgreso: (p) => actualizar(a.id, { progreso: p }),
            }),
          ])
          const aviso =
            avisoFormatoVideo(a.file.name) ??
            (analisis.reproducible
              ? null
              : 'Este navegador no pudo reproducir el video; se publicará igual con opción de descarga.')
          actualizar(a.id, {
            estado: 'listo',
            progreso: 100,
            video: {
              subida,
              duracionSeg: analisis.duracionSeg,
              miniaturaBase64: analisis.miniaturaBase64,
              aviso,
            },
          })
        } catch (e) {
          actualizar(a.id, {
            estado: 'error',
            error: e instanceof Error ? e.message : 'No se pudo subir el video.',
          })
        }
        return
      }
      const r = await prepararSubida({
        slug,
        sujetoObligadoId,
        nodoId,
        nombreArchivo: a.file.name,
        tamano: a.file.size,
      })
      if (!r.ok) return actualizar(a.id, { estado: 'error', error: r.error })
      try {
        await putConProgreso(r.datos.url, a.file, r.datos.contentType, (p) =>
          actualizar(a.id, { progreso: p }),
        )
        actualizar(a.id, { estado: 'listo', progreso: 100, rutaTemporal: r.datos.rutaTemporal })
      } catch {
        actualizar(a.id, {
          estado: 'error',
          error: 'Se perdió la conexión al subir. Revisa tu internet y vuelve a intentar.',
        })
      }
    },
    [slug, sujetoObligadoId, nodoId],
  )

  const agregar = (lista: FileList | File[]) => {
    const nuevos: Archivo[] = []
    for (const file of Array.from(lista)) {
      const def = tipoPorExtension(file.name)
      const { nombre, periodo } = nombreSugerido(file.name)
      let anio = hoy.getFullYear()
      let parte =
        periodicidad === 'mensual'
          ? hoy.getMonth() + 1
          : periodicidad === 'trimestral'
            ? Math.ceil((hoy.getMonth() + 1) / 3)
            : periodicidad === 'semestral'
              ? hoy.getMonth() < 6
                ? 1
                : 2
              : 1
      if (periodo) {
        anio = periodo.anio
        if (periodo.tipo === 'mes' && periodicidad === 'mensual') parte = periodo.mes
        if (periodo.tipo === 'mes' && periodicidad === 'trimestral')
          parte = Math.ceil(periodo.mes / 3)
        if (periodo.tipo === 'trimestre' && periodicidad === 'trimestral') parte = periodo.trimestre
      }
      const a: Archivo = {
        id: crypto.randomUUID(),
        file,
        nombre,
        anio,
        parte,
        progreso: 0,
        estado: 'esperando',
      }
      if (!def) {
        a.estado = 'error'
        a.error = `Solo se pueden subir ${EXTENSIONES_PERMITIDAS.map((e) => `.${e}`).join(', ')}.`
      } else if (file.size > def.tamanoMaximo) {
        a.estado = 'error'
        a.error = `Pesa ${tamanoLegible(file.size)} y el máximo es ${tamanoLegible(def.tamanoMaximo)}. Intenta comprimirlo o dividirlo.`
      }
      nuevos.push(a)
    }
    setArchivos((prev) => [...prev, ...nuevos])
    nuevos.filter((a) => a.estado === 'esperando').forEach((a) => void subir(a))
  }

  const listos = archivos.filter((a) => a.estado === 'listo')
  const puedePublicar =
    archivos.length > 0 &&
    archivos.every((a) => a.estado === 'listo' || a.estado === 'error') &&
    listos.length > 0 &&
    listos.every((a) => a.nombre.trim().length >= 2)

  async function publicar() {
    setPublicando(true)
    const periodoDe = (a: Archivo) =>
      esConPeriodo(periodicidad) ? periodoElegido(periodicidad, a.anio, a.parte) : SIN_PERIODO
    const videos = listos.filter((a) => a.video)
    const publicados: { id: string; nombre: string }[] = []
    for (const v of videos) {
      const r = await publicarVideo({
        slug,
        sujetoObligadoId,
        nodoId,
        rutaTemporal: v.video!.subida.rutaTemporal,
        uploadId: v.video!.subida.uploadId,
        partes: v.video!.subida.partes,
        nombreOriginal: v.file.name,
        nombre: v.nombre.trim(),
        periodo: periodoDe(v),
        duracionSeg: v.video!.duracionSeg,
        miniaturaBase64: v.video!.miniaturaBase64,
      })
      if (!r.ok) {
        setPublicando(false)
        return toast.error(`${v.file.name}: ${r.error}`)
      }
      olvidarSubida(slug, v.file)
      publicados.push(r.datos)
    }
    const archivosNormales = listos.filter((a) => !a.video)
    if (archivosNormales.length === 0) {
      setPublicando(false)
      setCreados(publicados)
      router.refresh()
      return
    }
    const r = await publicarDocumentos({
      slug,
      sujetoObligadoId,
      nodoId,
      archivos: archivosNormales.map((a) => ({
        rutaTemporal: a.rutaTemporal!,
        nombreOriginal: a.file.name,
        nombre: a.nombre.trim(),
        periodo: esConPeriodo(periodicidad)
          ? periodoElegido(periodicidad, a.anio, a.parte)
          : SIN_PERIODO,
      })),
    })
    setPublicando(false)
    if (!r.ok) return toast.error(r.error)
    setCreados([...publicados, ...r.datos])
    router.refresh()
  }

  if (creados) {
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
          {creados.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 p-3">
              <span className="min-w-0 truncate text-sm font-medium">{d.nombre}</span>
              <CopiarEnlace url={`${sitio}/d/${d.id}`} />
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button onClick={cerrar}>Cerrar</Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Subir a {nodoTitulo}</DialogTitle>
        <DialogDescription>
          {modo === 'archivos'
            ? 'Paso 2 de 3 · Elige el archivo. Mientras sube, confirma su nombre.'
            : 'Pega el enlace del video de YouTube o Facebook.'}
        </DialogDescription>
      </DialogHeader>

      {modo === 'video' ? (
        <FormularioVideo
          slug={slug}
          sujetoObligadoId={sujetoObligadoId}
          nodoId={nodoId}
          periodicidad={periodicidad}
          sitio={sitio}
          volver={() => setModo('archivos')}
          cerrar={cerrar}
        />
      ) : (
        <>
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
            onDragOver={(e) => (e.preventDefault(), setArrastrando(true))}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault()
              setArrastrando(false)
              agregar(e.dataTransfer.files)
            }}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors',
              arrastrando ? 'border-primary bg-primary/5' : 'hover:bg-accent/50',
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
              accept={EXTENSIONES_PERMITIDAS.map((e) => `.${e}`).join(',')}
              className="sr-only"
              onChange={(e) => e.target.files && (agregar(e.target.files), (e.target.value = ''))}
            />
          </div>

          <Button
            type="button"
            variant="link"
            className="self-start px-0"
            onClick={() => setModo('video')}
          >
            <LinkIcon aria-hidden /> Agregar enlace de video (YouTube / Facebook)
          </Button>

          {archivos.length > 0 && (
            <ul className="flex flex-col gap-3">
              {archivos.map((a) => (
                <li key={a.id} className="rounded-lg border p-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-muted-foreground">
                        {a.file.name} · {tamanoLegible(a.file.size)}
                      </p>
                      {a.estado === 'subiendo' && (
                        <div className="mt-1 flex items-center gap-2">
                          <Progress
                            value={a.progreso}
                            className="h-2"
                            aria-label={`Subiendo ${a.file.name}`}
                          />
                          <span className="w-10 text-right text-xs tabular-nums">
                            {a.progreso}%
                          </span>
                        </div>
                      )}
                      {a.estado === 'listo' && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-green-700">
                          <CheckCircle2Icon className="size-3.5" aria-hidden />{' '}
                          {a.video ? 'Video subido' : 'Archivo subido'}
                        </p>
                      )}
                      {a.video?.aviso && (
                        <p className="mt-1 text-xs text-amber-700">{a.video.aviso}</p>
                      )}
                      {a.estado === 'subiendo' &&
                        a.video === undefined &&
                        tipoPorExtension(a.file.name)?.tipo === 'video' && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Los videos suben por partes. Si se corta la conexión, al volver a elegir
                            el archivo continúa donde se quedó.
                          </p>
                        )}
                      {a.estado === 'error' && (
                        <p role="alert" className="mt-1 text-xs text-destructive">
                          {a.error}
                          {a.error?.includes('conexión') && (
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="h-auto px-1"
                              onClick={() => void subir(a)}
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
                      onClick={() => setArchivos((prev) => prev.filter((x) => x.id !== a.id))}
                    >
                      <XIcon aria-hidden />
                    </Button>
                  </div>
                  {a.estado !== 'error' && (
                    <div className="mt-3 flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`nombre-${a.id}`}>Nombre que verán los ciudadanos</Label>
                        <Input
                          id={`nombre-${a.id}`}
                          value={a.nombre}
                          onChange={(e) => actualizar(a.id, { nombre: e.target.value })}
                          className="h-11 text-base"
                          maxLength={200}
                        />
                      </div>
                      {esConPeriodo(periodicidad) && (
                        <SelectorPeriodo
                          periodicidad={periodicidad}
                          anio={a.anio}
                          parte={a.parte}
                          onChange={(anio, parte) => actualizar(a.id, { anio, parte })}
                        />
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <DialogFooter className="sticky bottom-0 bg-background pt-2">
            <Button type="button" variant="outline" onClick={cerrar}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={publicar}
              disabled={!puedePublicar || publicando}
              className="h-11"
            >
              {publicando && <Loader2Icon className="animate-spin" aria-hidden />}
              {archivos.some((a) => a.estado === 'subiendo')
                ? 'Publicando cuando termine la subida…'
                : `Publicar${listos.length > 1 ? ` ${listos.length} documentos` : ''}`}
            </Button>
          </DialogFooter>
        </>
      )}
    </>
  )
}

function FormularioVideo({
  slug,
  sujetoObligadoId,
  nodoId,
  periodicidad,
  sitio,
  volver,
  cerrar,
}: {
  slug: string
  sujetoObligadoId: string
  nodoId: string
  periodicidad: Periodicidad
  sitio: string
  volver: () => void
  cerrar: () => void
}) {
  const router = useRouter()
  const hoy = new Date()
  const [url, setUrl] = useState('')
  const [nombre, setNombre] = useState('')
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [parte, setParte] = useState(
    periodicidad === 'mensual'
      ? hoy.getMonth() + 1
      : periodicidad === 'trimestral'
        ? Math.ceil((hoy.getMonth() + 1) / 3)
        : 1,
  )
  const [enviando, setEnviando] = useState(false)
  const [creado, setCreado] = useState<{ id: string; nombre: string } | null>(null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    const periodo: PeriodoElegido = esConPeriodo(periodicidad)
      ? periodoElegido(periodicidad, anio, parte)
      : SIN_PERIODO
    const r = await crearVideoExterno({
      slug,
      sujetoObligadoId,
      nodoId,
      url: url.trim(),
      nombre: nombre.trim(),
      periodo,
    })
    setEnviando(false)
    if (!r.ok) return toast.error(r.error)
    setCreado(r.datos)
    router.refresh()
  }

  if (creado) {
    return (
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-2 font-medium">
          <CheckCircle2Icon className="text-green-600" aria-hidden /> Video publicado
        </p>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <span className="truncate text-sm">{creado.nombre}</span>
          <CopiarEnlace url={`${sitio}/d/${creado.id}`} />
        </div>
        <DialogFooter>
          <Button onClick={cerrar}>Cerrar</Button>
        </DialogFooter>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
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
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          minLength={2}
          maxLength={200}
          className="h-11 text-base"
        />
      </div>
      {esConPeriodo(periodicidad) && (
        <SelectorPeriodo
          periodicidad={periodicidad}
          anio={anio}
          parte={parte}
          onChange={(a, p) => (setAnio(a), setParte(p))}
        />
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={volver}>
          Volver
        </Button>
        <Button type="submit" disabled={enviando} className="h-11">
          {enviando && <Loader2Icon className="animate-spin" aria-hidden />} Publicar video
        </Button>
      </DialogFooter>
    </form>
  )
}

/** PUT con XMLHttpRequest para tener progreso (fetch no lo expone en subidas). */
function putConProgreso(
  url: string,
  file: File,
  contentType: string,
  onProgreso: (p: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.setRequestHeader('Content-Disposition', 'attachment')
    xhr.upload.onprogress = (e) =>
      e.lengthComputable && onProgreso(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`))
    xhr.onerror = () => reject(new Error('red'))
    xhr.send(file)
  })
}
