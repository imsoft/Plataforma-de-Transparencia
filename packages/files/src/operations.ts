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
import { s3Client, type FilesConfig } from './client'

const UPLOAD_EXPIRY = 15 * 60 // 15 min por URL firmada
const READ_EXPIRY = 5 * 60

type Options = { config?: FilesConfig }
const ctx = (o?: Options) => s3Client(o?.config)

export type ObjectMetadata = { contentType: string; contentDisposition: string }

/** URL firmada para subir un archivo pequeño (≤ 50 MB) con PUT directo desde el navegador. */
export async function signUpload(
  path: string,
  size: number,
  meta: ObjectMetadata,
  o?: Options,
): Promise<string> {
  const { s3, config } = ctx(o)
  const cmd = new PutObjectCommand({
    Bucket: config.bucket,
    Key: path,
    ContentLength: size,
    ContentType: meta.contentType,
    ContentDisposition: meta.contentDisposition,
  })
  return getSignedUrl(s3, cmd, { expiresIn: UPLOAD_EXPIRY })
}

/** Subida multipart (videos grandes): iniciar → firmar cada parte → completar/abortar. */
export async function startMultipart(
  path: string,
  meta: ObjectMetadata,
  o?: Options,
): Promise<string> {
  const { s3, config } = ctx(o)
  const r = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: config.bucket,
      Key: path,
      ContentType: meta.contentType,
      ContentDisposition: meta.contentDisposition,
    }),
  )
  if (!r.UploadId) throw new Error('No se pudo iniciar la subida multipart')
  return r.UploadId
}

export async function signPart(
  path: string,
  uploadId: string,
  partNumber: number,
  o?: Options,
): Promise<string> {
  const { s3, config } = ctx(o)
  return getSignedUrl(
    s3,
    new UploadPartCommand({
      Bucket: config.bucket,
      Key: path,
      UploadId: uploadId,
      PartNumber: partNumber,
    }),
    {
      expiresIn: UPLOAD_EXPIRY,
    },
  )
}

export async function completeMultipart(
  path: string,
  uploadId: string,
  parts: { PartNumber: number; ETag: string }[],
  o?: Options,
) {
  const { s3, config } = ctx(o)
  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: config.bucket,
      Key: path,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    }),
  )
}

export async function abortMultipart(path: string, uploadId: string, o?: Options) {
  const { s3, config } = ctx(o)
  await s3.send(
    new AbortMultipartUploadCommand({ Bucket: config.bucket, Key: path, UploadId: uploadId }),
  )
}

/** Cabecera del objeto (tamaño, tipo) tras la subida. Devuelve null si no existe. */
export async function headObject(
  path: string,
  o?: Options,
): Promise<{ size: number; contentType: string } | null> {
  const { s3, config } = ctx(o)
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: config.bucket, Key: path }))
    return {
      size: r.ContentLength ?? 0,
      contentType: r.ContentType ?? 'application/octet-stream',
    }
  } catch (e) {
    if ((e as { name?: string }).name === 'NotFound') return null
    throw e
  }
}

/** Primeros N bytes del objeto (para detectar el tipo real por firma). */
export async function readHead(path: string, bytes = 4100, o?: Options): Promise<Uint8Array> {
  const { s3, config } = ctx(o)
  const r = await s3.send(
    new GetObjectCommand({ Bucket: config.bucket, Key: path, Range: `bytes=0-${bytes - 1}` }),
  )
  return r.Body ? new Uint8Array(await r.Body.transformToByteArray()) : new Uint8Array()
}

/** R2/S3 no renombran: copiar y borrar. Conserva o reemplaza metadatos. */
export async function move(origin: string, target: string, meta?: ObjectMetadata, o?: Options) {
  const { s3, config } = ctx(o)
  await s3.send(
    new CopyObjectCommand({
      Bucket: config.bucket,
      CopySource: `${config.bucket}/${origin.split('/').map(encodeURIComponent).join('/')}`,
      Key: target,
      ...(meta
        ? {
            MetadataDirective: 'REPLACE',
            ContentType: meta.contentType,
            ContentDisposition: meta.contentDisposition,
          }
        : { MetadataDirective: 'COPY' }),
    }),
  )
  await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: origin }))
}

export async function remove(path: string, o?: Options) {
  const { s3, config } = ctx(o)
  await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: path }))
}

/** Subida directa desde el servidor (scripts de migración, miniaturas, exportaciones). */
export async function uploadFromServer(
  path: string,
  body: Uint8Array | Buffer | string,
  meta: ObjectMetadata,
  o?: Options,
) {
  const { s3, config } = ctx(o)
  await s3.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: path,
      Body: body,
      ContentType: meta.contentType,
      ContentDisposition: meta.contentDisposition,
    }),
  )
}

/** URL firmada de lectura (panel: previsualizar archivos no publicados o versiones anteriores). */
export async function signRead(path: string, o?: Options): Promise<string> {
  const { s3, config } = ctx(o)
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: config.bucket, Key: path }), {
    expiresIn: READ_EXPIRY,
  })
}

/** Partes ya subidas de un multipart (para reanudar una subida interrumpida). */
export async function listParts(
  path: string,
  uploadId: string,
  o?: Options,
): Promise<{ PartNumber: number; ETag: string; Size: number }[]> {
  const { s3, config } = ctx(o)
  const { ListPartsCommand } = await import('@aws-sdk/client-s3')
  const output: { PartNumber: number; ETag: string; Size: number }[] = []
  let marker: string | undefined
  do {
    const r = await s3.send(
      new ListPartsCommand({
        Bucket: config.bucket,
        Key: path,
        UploadId: uploadId,
        PartNumberMarker: marker,
      }),
    )
    for (const p of r.Parts ?? [])
      if (p.PartNumber && p.ETag)
        output.push({ PartNumber: p.PartNumber, ETag: p.ETag, Size: p.Size ?? 0 })
    marker = r.IsTruncated ? r.NextPartNumberMarker : undefined
  } while (marker)
  return output
}

/** URL firmada de lectura de larga duración (exportaciones enviadas por correo: 6 días). */
export async function signLongRead(path: string, o?: Options): Promise<string> {
  const { s3, config } = ctx(o)
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: config.bucket, Key: path }), {
    expiresIn: 7 * 24 * 3600,
  })
}

/** Flujo de lectura de un objeto (para empaquetar exportaciones sin cargarlo en memoria). */
export async function readStream(path: string, o?: Options): Promise<NodeJS.ReadableStream | null> {
  const { s3, config } = ctx(o)
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: config.bucket, Key: path }))
    return (r.Body as NodeJS.ReadableStream | undefined) ?? null
  } catch (e) {
    if ((e as { name?: string }).name === 'NoSuchKey') return null
    throw e
  }
}

/** Subida en streaming de tamaño desconocido (ZIP de exportación) con multipart automático. */
export async function uploadStream(
  path: string,
  body: NodeJS.ReadableStream,
  meta: ObjectMetadata,
  o?: Options,
): Promise<void> {
  const { s3, config } = ctx(o)
  const { Upload } = await import('@aws-sdk/lib-storage')
  await new Upload({
    client: s3,
    params: {
      Bucket: config.bucket,
      Key: path,
      Body: body as never,
      ContentType: meta.contentType,
      ContentDisposition: meta.contentDisposition,
    },
    partSize: 16 * 1024 * 1024,
    queueSize: 3,
  }).done()
}

/** SHA-256 (hex) de un objeto del bucket, en streaming (sirve para videos de varios GB). */
export async function objectHash(path: string, o?: Options): Promise<string | null> {
  const stream = await readStream(path, o)
  if (!stream) return null
  const { createHash } = await import('node:crypto')
  const h = createHash('sha256')
  for await (const chunk of stream as AsyncIterable<Uint8Array>) h.update(chunk)
  return h.digest('hex')
}
