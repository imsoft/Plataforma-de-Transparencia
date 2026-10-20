'use client'
/**
 * Subida reanudable de videos desde el navegador: partes de 16 MB firmadas una por una,
 * progreso agregado y reanudación tras cerrar la pestaña (el uploadId se guarda en localStorage).
 */
import { signVideoPart, startVideoUpload, uploadedParts } from '@/actions/videos'

export type UploadState = {
  tempPath: string
  uploadId: string
  partSize: number
  parts: { PartNumber: number; ETag: string }[]
}

const key = (slug: string, f: File) => `subida-video:${slug}:${f.name}:${f.size}:${f.lastModified}`

export function recoverUpload(slug: string, f: File): UploadState | null {
  try {
    const v = localStorage.getItem(key(slug, f))
    return v ? (JSON.parse(v) as UploadState) : null
  } catch {
    return null
  }
}
export function saveUpload(slug: string, f: File, e: UploadState) {
  try {
    localStorage.setItem(key(slug, f), JSON.stringify(e))
  } catch {
    /* sin almacenamiento */
  }
}
export function forgetUpload(slug: string, f: File) {
  try {
    localStorage.removeItem(key(slug, f))
  } catch {
    /* nada */
  }
}

/** Sube el archivo completo; llama a onProgreso con 0–100. Devuelve el estado listo para publicar. */
export async function uploadVideoInParts(opts: {
  slug: string
  obligatedSubjectId: string
  nodeId: string
  file: File
  onProgress: (p: number) => void
  signal?: AbortSignal
}): Promise<UploadState> {
  const { slug, file } = opts
  let status = recoverUpload(slug, file)
  if (status) {
    const r = await uploadedParts(slug, status.tempPath, status.uploadId)
    if (r.ok && r.data.length > 0)
      status.parts = r.data.map((p) => ({ PartNumber: p.PartNumber, ETag: p.ETag }))
    else status = null
  }
  if (!status) {
    const r = await startVideoUpload({
      slug,
      obligatedSubjectId: opts.obligatedSubjectId,
      nodeId: opts.nodeId,
      fileName: file.name,
      size: file.size,
    })
    if (!r.ok) throw new Error(r.error)
    status = {
      tempPath: r.data.tempPath,
      uploadId: r.data.uploadId,
      partSize: r.data.partSize,
      parts: [],
    }
  }
  const total = Math.ceil(file.size / status.partSize)
  const done = new Set(status.parts.map((p) => p.PartNumber))
  const advance = (extra = 0) =>
    opts.onProgress(
      Math.min(99, Math.round(((done.size * status.partSize + extra) / file.size) * 100)),
    )
  advance()
  for (let n = 1; n <= total; n++) {
    if (done.has(n)) continue
    if (opts.signal?.aborted) throw new Error('canceled')
    const start = (n - 1) * status.partSize
    const chunk = file.slice(start, Math.min(start + status.partSize, file.size))
    let etag: string | null = null
    for (let attempt = 0; attempt < 4 && !etag; attempt++) {
      const f = await signVideoPart(slug, status.tempPath, status.uploadId, n)
      if (!f.ok) throw new Error(f.error)
      try {
        etag = await putPart(f.data.url, chunk, (loaded) => advance(loaded), opts.signal)
      } catch (e) {
        if (opts.signal?.aborted) throw e
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))) // reintento con espera
      }
    }
    if (!etag)
      throw new Error(
        'Se perdió la conexión al subir. Puedes cerrar y volver a intentar: la subida continúa donde se quedó.',
      )
    status.parts.push({ PartNumber: n, ETag: etag })
    done.add(n)
    saveUpload(slug, file, status)
    advance()
  }
  return status
}

function putPart(
  url: string,
  chunk: Blob,
  onLoaded: (bytes: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.upload.onprogress = (e) => e.lengthComputable && onLoaded(e.loaded)
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
    xhr.onabort = () => reject(new Error('canceled'))
    signal?.addEventListener('abort', () => xhr.abort())
    xhr.send(chunk)
  })
}

/** Miniatura y duración del video en el navegador (sin costo de servidor). */
export function analyzeVideo(
  file: File,
): Promise<{ durationSec: number | null; thumbnailBase64: string | null; playable: boolean }> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    const url = URL.createObjectURL(file)
    const finish = (r: {
      durationSec: number | null
      thumbnailBase64: string | null
      playable: boolean
    }) => {
      URL.revokeObjectURL(url)
      resolve(r)
    }
    const timer = setTimeout(
      () => finish({ durationSec: null, thumbnailBase64: null, playable: false }),
      15000,
    )
    video.onerror = () => {
      clearTimeout(timer)
      finish({ durationSec: null, thumbnailBase64: null, playable: false })
    }
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, video.duration / 2 || 0)
    }
    video.onseeked = () => {
      clearTimeout(timer)
      try {
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, 1280 / (video.videoWidth || 1280))
        canvas.width = Math.round((video.videoWidth || 1280) * scale)
        canvas.height = Math.round((video.videoHeight || 720) * scale)
        canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        finish({
          durationSec: Number.isFinite(video.duration) ? Math.round(video.duration) : null,
          thumbnailBase64: dataUrl.split(',')[1] ?? null,
          playable: true,
        })
      } catch {
        finish({
          durationSec: Number.isFinite(video.duration) ? Math.round(video.duration) : null,
          thumbnailBase64: null,
          playable: true,
        })
      }
    }
    video.src = url
  })
}
