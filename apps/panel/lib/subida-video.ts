'use client'
/**
 * Subida reanudable de videos desde el navegador: partes de 16 MB firmadas una por una,
 * progreso agregado y reanudación tras cerrar la pestaña (el uploadId se guarda en localStorage).
 */
import { firmarParteVideo, iniciarSubidaVideo, partesSubidas } from '@/acciones/videos'

export type EstadoSubida = {
  rutaTemporal: string
  uploadId: string
  tamanoParte: number
  partes: { PartNumber: number; ETag: string }[]
}

const clave = (slug: string, f: File) =>
  `subida-video:${slug}:${f.name}:${f.size}:${f.lastModified}`

export function recuperarSubida(slug: string, f: File): EstadoSubida | null {
  try {
    const v = localStorage.getItem(clave(slug, f))
    return v ? (JSON.parse(v) as EstadoSubida) : null
  } catch {
    return null
  }
}
export function guardarSubida(slug: string, f: File, e: EstadoSubida) {
  try {
    localStorage.setItem(clave(slug, f), JSON.stringify(e))
  } catch {
    /* sin almacenamiento */
  }
}
export function olvidarSubida(slug: string, f: File) {
  try {
    localStorage.removeItem(clave(slug, f))
  } catch {
    /* nada */
  }
}

/** Sube el archivo completo; llama a onProgreso con 0–100. Devuelve el estado listo para publicar. */
export async function subirVideoPorPartes(opts: {
  slug: string
  sujetoObligadoId: string
  nodoId: string
  file: File
  onProgreso: (p: number) => void
  senal?: AbortSignal
}): Promise<EstadoSubida> {
  const { slug, file } = opts
  let estado = recuperarSubida(slug, file)
  if (estado) {
    const r = await partesSubidas(slug, estado.rutaTemporal, estado.uploadId)
    if (r.ok && r.datos.length > 0)
      estado.partes = r.datos.map((p) => ({ PartNumber: p.PartNumber, ETag: p.ETag }))
    else estado = null
  }
  if (!estado) {
    const r = await iniciarSubidaVideo({
      slug,
      sujetoObligadoId: opts.sujetoObligadoId,
      nodoId: opts.nodoId,
      nombreArchivo: file.name,
      tamano: file.size,
    })
    if (!r.ok) throw new Error(r.error)
    estado = {
      rutaTemporal: r.datos.rutaTemporal,
      uploadId: r.datos.uploadId,
      tamanoParte: r.datos.tamanoParte,
      partes: [],
    }
  }
  const total = Math.ceil(file.size / estado.tamanoParte)
  const hechas = new Set(estado.partes.map((p) => p.PartNumber))
  const avanzar = (extra = 0) =>
    opts.onProgreso(
      Math.min(99, Math.round(((hechas.size * estado.tamanoParte + extra) / file.size) * 100)),
    )
  avanzar()
  for (let n = 1; n <= total; n++) {
    if (hechas.has(n)) continue
    if (opts.senal?.aborted) throw new Error('cancelada')
    const inicio = (n - 1) * estado.tamanoParte
    const trozo = file.slice(inicio, Math.min(inicio + estado.tamanoParte, file.size))
    let etag: string | null = null
    for (let intento = 0; intento < 4 && !etag; intento++) {
      const f = await firmarParteVideo(slug, estado.rutaTemporal, estado.uploadId, n)
      if (!f.ok) throw new Error(f.error)
      try {
        etag = await putParte(f.datos.url, trozo, (cargado) => avanzar(cargado), opts.senal)
      } catch (e) {
        if (opts.senal?.aborted) throw e
        await new Promise((r) => setTimeout(r, 1500 * (intento + 1))) // reintento con espera
      }
    }
    if (!etag)
      throw new Error(
        'Se perdió la conexión al subir. Puedes cerrar y volver a intentar: la subida continúa donde se quedó.',
      )
    estado.partes.push({ PartNumber: n, ETag: etag })
    hechas.add(n)
    guardarSubida(slug, file, estado)
    avanzar()
  }
  return estado
}

function putParte(
  url: string,
  trozo: Blob,
  onCargado: (bytes: number) => void,
  senal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.upload.onprogress = (e) => e.lengthComputable && onCargado(e.loaded)
    xhr.onload = () => {
      const etag = xhr.getResponseHeader('ETag')
      if (xhr.status >= 200 && xhr.status < 300 && etag) resolve(etag)
      else
        reject(
          new Error(
            etag
              ? `HTTP ${xhr.status}`
              : 'El bucket no devolvió ETag: revisa la configuración CORS (ExposeHeaders: ETag).',
          ),
        )
    }
    xhr.onerror = () => reject(new Error('red'))
    xhr.onabort = () => reject(new Error('cancelada'))
    senal?.addEventListener('abort', () => xhr.abort())
    xhr.send(trozo)
  })
}

/** Miniatura y duración del video en el navegador (sin costo de servidor). */
export function analizarVideo(
  file: File,
): Promise<{ duracionSeg: number | null; miniaturaBase64: string | null; reproducible: boolean }> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    const url = URL.createObjectURL(file)
    const terminar = (r: {
      duracionSeg: number | null
      miniaturaBase64: string | null
      reproducible: boolean
    }) => {
      URL.revokeObjectURL(url)
      resolve(r)
    }
    const temporizador = setTimeout(
      () => terminar({ duracionSeg: null, miniaturaBase64: null, reproducible: false }),
      15000,
    )
    video.onerror = () => {
      clearTimeout(temporizador)
      terminar({ duracionSeg: null, miniaturaBase64: null, reproducible: false })
    }
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, video.duration / 2 || 0)
    }
    video.onseeked = () => {
      clearTimeout(temporizador)
      try {
        const canvas = document.createElement('canvas')
        const escala = Math.min(1, 1280 / (video.videoWidth || 1280))
        canvas.width = Math.round((video.videoWidth || 1280) * escala)
        canvas.height = Math.round((video.videoHeight || 720) * escala)
        canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        terminar({
          duracionSeg: Number.isFinite(video.duration) ? Math.round(video.duration) : null,
          miniaturaBase64: dataUrl.split(',')[1] ?? null,
          reproducible: true,
        })
      } catch {
        terminar({
          duracionSeg: Number.isFinite(video.duration) ? Math.round(video.duration) : null,
          miniaturaBase64: null,
          reproducible: true,
        })
      }
    }
    video.src = url
  })
}
