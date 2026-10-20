/** Operaciones sobre el bucket: URLs firmadas (subida directa), multipart, mover/copiar, leer cabecera, borrar. */
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { clienteS3, type ConfigArchivos } from './cliente'

const EXPIRA_SUBIDA = 15 * 60 // 15 min por URL firmada
const EXPIRA_LECTURA = 5 * 60

type Opciones = { config?: ConfigArchivos }
const ctx = (o?: Opciones) => clienteS3(o?.config)

export type MetadatosObjeto = { contentType: string; contentDisposition: string }

/** URL firmada para subir un archivo pequeño (≤ 50 MB) con PUT directo desde el navegador. */
export async function firmarSubida(
  ruta: string,
  tamano: number,
  meta: MetadatosObjeto,
  o?: Opciones,
): Promise<string> {
  const { s3, config } = ctx(o)
  const cmd = new PutObjectCommand({
    Bucket: config.bucket,
    Key: ruta,
    ContentLength: tamano,
    ContentType: meta.contentType,
    ContentDisposition: meta.contentDisposition,
  })
  return getSignedUrl(s3, cmd, { expiresIn: EXPIRA_SUBIDA })
}

/** Subida multipart (videos grandes): iniciar → firmar cada parte → completar/abortar. */
export async function iniciarMultipart(
  ruta: string,
  meta: MetadatosObjeto,
  o?: Opciones,
): Promise<string> {
  const { s3, config } = ctx(o)
  const r = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: config.bucket,
      Key: ruta,
      ContentType: meta.contentType,
      ContentDisposition: meta.contentDisposition,
    }),
  )
  if (!r.UploadId) throw new Error('No se pudo iniciar la subida multipart')
  return r.UploadId
}

export async function firmarParte(
  ruta: string,
  uploadId: string,
  numeroParte: number,
  o?: Opciones,
): Promise<string> {
  const { s3, config } = ctx(o)
  return getSignedUrl(
    s3,
    new UploadPartCommand({
      Bucket: config.bucket,
      Key: ruta,
      UploadId: uploadId,
      PartNumber: numeroParte,
    }),
    {
      expiresIn: EXPIRA_SUBIDA,
    },
  )
}

export async function completarMultipart(
  ruta: string,
  uploadId: string,
  partes: { PartNumber: number; ETag: string }[],
  o?: Opciones,
) {
  const { s3, config } = ctx(o)
  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: config.bucket,
      Key: ruta,
      UploadId: uploadId,
      MultipartUpload: { Parts: partes },
    }),
  )
}

export async function abortarMultipart(ruta: string, uploadId: string, o?: Opciones) {
  const { s3, config } = ctx(o)
  await s3.send(
    new AbortMultipartUploadCommand({ Bucket: config.bucket, Key: ruta, UploadId: uploadId }),
  )
}

/** Cabecera del objeto (tamaño, tipo) tras la subida. Devuelve null si no existe. */
export async function cabecera(
  ruta: string,
  o?: Opciones,
): Promise<{ tamano: number; contentType: string } | null> {
  const { s3, config } = ctx(o)
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: config.bucket, Key: ruta }))
    return {
      tamano: r.ContentLength ?? 0,
      contentType: r.ContentType ?? 'application/octet-stream',
    }
  } catch (e) {
    if ((e as { name?: string }).name === 'NotFound') return null
    throw e
  }
}

/** Primeros N bytes del objeto (para detectar el tipo real por firma). */
export async function leerInicio(ruta: string, bytes = 4100, o?: Opciones): Promise<Uint8Array> {
  const { s3, config } = ctx(o)
  const r = await s3.send(
    new GetObjectCommand({ Bucket: config.bucket, Key: ruta, Range: `bytes=0-${bytes - 1}` }),
  )
  return r.Body ? new Uint8Array(await r.Body.transformToByteArray()) : new Uint8Array()
}

/** R2/S3 no renombran: copiar y borrar. Conserva o reemplaza metadatos. */
export async function mover(origen: string, destino: string, meta?: MetadatosObjeto, o?: Opciones) {
  const { s3, config } = ctx(o)
  await s3.send(
    new CopyObjectCommand({
      Bucket: config.bucket,
      CopySource: `${config.bucket}/${origen.split('/').map(encodeURIComponent).join('/')}`,
      Key: destino,
      ...(meta
        ? {
            MetadataDirective: 'REPLACE',
            ContentType: meta.contentType,
            ContentDisposition: meta.contentDisposition,
          }
        : { MetadataDirective: 'COPY' }),
    }),
  )
  await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: origen }))
}

export async function borrar(ruta: string, o?: Opciones) {
  const { s3, config } = ctx(o)
  await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: ruta }))
}

/** Subida directa desde el servidor (scripts de migración, miniaturas, exportaciones). */
export async function subirDesdeServidor(
  ruta: string,
  cuerpo: Uint8Array | Buffer | string,
  meta: MetadatosObjeto,
  o?: Opciones,
) {
  const { s3, config } = ctx(o)
  await s3.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: ruta,
      Body: cuerpo,
      ContentType: meta.contentType,
      ContentDisposition: meta.contentDisposition,
    }),
  )
}

/** URL firmada de lectura (panel: previsualizar archivos no publicados o versiones anteriores). */
export async function firmarLectura(ruta: string, o?: Opciones): Promise<string> {
  const { s3, config } = ctx(o)
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: config.bucket, Key: ruta }), {
    expiresIn: EXPIRA_LECTURA,
  })
}

/** Partes ya subidas de un multipart (para reanudar una subida interrumpida). */
export async function listarPartes(
  ruta: string,
  uploadId: string,
  o?: Opciones,
): Promise<{ PartNumber: number; ETag: string; Size: number }[]> {
  const { s3, config } = ctx(o)
  const { ListPartsCommand } = await import('@aws-sdk/client-s3')
  const salida: { PartNumber: number; ETag: string; Size: number }[] = []
  let marker: string | undefined
  do {
    const r = await s3.send(
      new ListPartsCommand({
        Bucket: config.bucket,
        Key: ruta,
        UploadId: uploadId,
        PartNumberMarker: marker,
      }),
    )
    for (const p of r.Parts ?? [])
      if (p.PartNumber && p.ETag)
        salida.push({ PartNumber: p.PartNumber, ETag: p.ETag, Size: p.Size ?? 0 })
    marker = r.IsTruncated ? r.NextPartNumberMarker : undefined
  } while (marker)
  return salida
}

/** URL firmada de lectura de larga duración (exportaciones enviadas por correo: 7 días). */
export async function firmarLecturaLarga(ruta: string, o?: Opciones): Promise<string> {
  const { s3, config } = ctx(o)
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: config.bucket, Key: ruta }), {
    expiresIn: 7 * 24 * 3600,
  })
}

/** Flujo de lectura de un objeto (para empaquetar exportaciones sin cargarlo en memoria). */
export async function flujoDeLectura(
  ruta: string,
  o?: Opciones,
): Promise<NodeJS.ReadableStream | null> {
  const { s3, config } = ctx(o)
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: config.bucket, Key: ruta }))
    return (r.Body as NodeJS.ReadableStream | undefined) ?? null
  } catch (e) {
    if ((e as { name?: string }).name === 'NoSuchKey') return null
    throw e
  }
}

/** Subida en streaming de tamaño desconocido (ZIP de exportación) con multipart automático. */
export async function subirFlujo(
  ruta: string,
  cuerpo: NodeJS.ReadableStream,
  meta: MetadatosObjeto,
  o?: Opciones,
): Promise<void> {
  const { s3, config } = ctx(o)
  const { Upload } = await import('@aws-sdk/lib-storage')
  await new Upload({
    client: s3,
    params: {
      Bucket: config.bucket,
      Key: ruta,
      Body: cuerpo as never,
      ContentType: meta.contentType,
      ContentDisposition: meta.contentDisposition,
    },
    partSize: 16 * 1024 * 1024,
    queueSize: 3,
  }).done()
}

/** SHA-256 (hex) de un objeto del bucket, en streaming (sirve para videos de varios GB). */
export async function hashDeObjeto(ruta: string, o?: Opciones): Promise<string | null> {
  const flujo = await flujoDeLectura(ruta, o)
  if (!flujo) return null
  const { createHash } = await import('node:crypto')
  const h = createHash('sha256')
  for await (const trozo of flujo as AsyncIterable<Uint8Array>) h.update(trozo)
  return h.digest('hex')
}
