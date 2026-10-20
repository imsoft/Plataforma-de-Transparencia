'use server'
import { exigir } from '@plataforma/auth'
import {
  abortarMultipart,
  borrar,
  cabecera,
  completarMultipart,
  contentDisposition,
  definicion,
  detectarTipo,
  firmarParte,
  hashDeObjeto,
  iniciarMultipart,
  leerInicio,
  listarPartes,
  mover,
  nuevoIdCorto,
  nuevoIdDocumento,
  rutaDeArchivo,
  rutaDeMiniatura,
  subirDesdeServidor,
  tipoPorExtension,
} from '@plataforma/archivos'
import { conUsuario, documentoVersiones, documentos, eq } from '@plataforma/db'
import { nodosDe, rutaDeAncestros, versionVigente } from '@plataforma/db/consultas/indice'
import { encolarRevalidacion } from '@plataforma/db/consultas/revalidacion'
import { etiquetasDeDocumento } from '@plataforma/transparencia/etiquetas'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { contextoMunicipio } from '@/lib/municipio'
import { procesarRevalidaciones } from '@/lib/revalidar'
import { accion, ErrorUsuario } from './comun'

/** Tamaño de cada parte: 16 MB (mínimo S3 5 MB). Un video de 2 GB son 125 partes. */
const TAMANO_PARTE = 16 * 1024 * 1024

const base = z.object({
  slug: z.string(),
  sujetoObligadoId: z.string().uuid(),
  nodoId: z.string().uuid(),
})
const rutaTemporalSchema = z.string().regex(/^[a-z0-9-]+\/_subidas\/[a-z0-9]+\.[a-z0-9]+$/)

export async function iniciarSubidaVideo(
  entrada: z.infer<typeof base> & { nombreArchivo: string; tamano: number },
) {
  return accion(async () => {
    const e = base
      .extend({ nombreArchivo: z.string().min(1).max(255), tamano: z.number().int().positive() })
      .parse(entrada)
    const c = await contextoMunicipio(e.slug)
    exigir(c.sesion, 'documento:subir', {
      municipioId: c.municipio.id,
      sujetoObligadoId: e.sujetoObligadoId,
      nodoRuta: [e.nodoId],
    })
    const def = tipoPorExtension(e.nombreArchivo)
    if (!def || def.tipo !== 'video')
      throw new ErrorUsuario('Sube un video MP4 (recomendado), WebM o MOV.')
    if (e.tamano > def.tamanoMaximo)
      throw new ErrorUsuario(
        `El video pesa ${gb(e.tamano)} y el máximo es ${gb(def.tamanoMaximo)}. Comprímelo o súbelo a YouTube y pega el enlace.`,
      )
    const ext = e.nombreArchivo.split('.').pop()!.toLowerCase()
    const rutaTemporal = `${c.municipio.slug}/_subidas/${nuevoIdCorto()}${nuevoIdCorto()}.${ext}`
    const contentType = def.mimes[['mp4', 'webm', 'mov'].indexOf(ext)] ?? def.mimes[0]!
    const uploadId = await iniciarMultipart(rutaTemporal, {
      contentType,
      contentDisposition: 'inline',
    })
    return {
      rutaTemporal,
      uploadId,
      tamanoParte: TAMANO_PARTE,
      partes: Math.ceil(e.tamano / TAMANO_PARTE),
    }
  })
}

export async function firmarParteVideo(
  slug: string,
  rutaTemporal: string,
  uploadId: string,
  numero: number,
) {
  return accion(async () => {
    const c = await contextoMunicipio(slug)
    const ruta = rutaTemporalSchema.parse(rutaTemporal)
    if (!ruta.startsWith(`${c.municipio.slug}/_subidas/`))
      throw new ErrorUsuario('Subida inválida.')
    return {
      url: await firmarParte(
        ruta,
        z.string().min(1).parse(uploadId),
        z.number().int().min(1).max(10000).parse(numero),
      ),
    }
  })
}

/** Para reanudar: qué partes ya están en el bucket. */
export async function partesSubidas(slug: string, rutaTemporal: string, uploadId: string) {
  return accion(async () => {
    const c = await contextoMunicipio(slug)
    const ruta = rutaTemporalSchema.parse(rutaTemporal)
    if (!ruta.startsWith(`${c.municipio.slug}/_subidas/`))
      throw new ErrorUsuario('Subida inválida.')
    try {
      return await listarPartes(ruta, uploadId)
    } catch {
      return [] // la subida ya no existe (expiró o se abortó): empezar de nuevo
    }
  })
}

export async function cancelarSubidaVideo(slug: string, rutaTemporal: string, uploadId: string) {
  return accion(async () => {
    const c = await contextoMunicipio(slug)
    const ruta = rutaTemporalSchema.parse(rutaTemporal)
    if (!ruta.startsWith(`${c.municipio.slug}/_subidas/`))
      throw new ErrorUsuario('Subida inválida.')
    await abortarMultipart(ruta, uploadId).catch(() => {})
  })
}

const publicarSchema = base.extend({
  rutaTemporal: rutaTemporalSchema,
  uploadId: z.string().min(1),
  partes: z
    .array(z.object({ PartNumber: z.number().int().min(1), ETag: z.string().min(1) }))
    .min(1),
  nombreOriginal: z.string().min(1).max(255),
  nombre: z.string().trim().min(2).max(200),
  periodo: z.object({
    etiqueta: z.string().nullable(),
    inicio: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    fin: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    carpeta: z.string().regex(/^[a-z0-9-]+$/),
  }),
  duracionSeg: z.number().int().nonnegative().nullable(),
  /** JPEG en base64 (sin prefijo data:), generado en el navegador; máx. ~400 KB. */
  miniaturaBase64: z.string().max(600_000).nullable(),
})

export async function publicarVideo(entrada: z.infer<typeof publicarSchema>) {
  return accion(async () => {
    const e = publicarSchema.parse(entrada)
    const c = await contextoMunicipio(e.slug)
    exigir(c.sesion, 'documento:subir', {
      municipioId: c.municipio.id,
      sujetoObligadoId: e.sujetoObligadoId,
      nodoRuta: [e.nodoId],
    })
    if (!e.rutaTemporal.startsWith(`${c.municipio.slug}/_subidas/`))
      throw new ErrorUsuario('Subida inválida.')
    const so = c.municipio.sujetosObligados.find((x) => x.id === e.sujetoObligadoId)
    if (!so) throw new ErrorUsuario('El sujeto obligado no existe.')

    await completarMultipart(
      e.rutaTemporal,
      e.uploadId,
      e.partes.sort((a, b) => a.PartNumber - b.PartNumber),
    )
    const cab = await cabecera(e.rutaTemporal)
    if (!cab) throw new ErrorUsuario('El video no terminó de subir. Inténtalo de nuevo.')
    const det = await detectarTipo(await leerInicio(e.rutaTemporal), e.nombreOriginal)
    if (!det.ok || det.tipo.tipo !== 'video') {
      await borrar(e.rutaTemporal)
      throw new ErrorUsuario(det.ok ? 'El archivo no es un video.' : det.motivo)
    }
    const def = definicion('video')
    if (cab.tamano > def.tamanoMaximo) {
      await borrar(e.rutaTemporal)
      throw new ErrorUsuario(
        `El video pesa ${gb(cab.tamano)} y el máximo es ${gb(def.tamanoMaximo)}.`,
      )
    }

    const id = nuevoIdDocumento()
    await conUsuario(c.ctx, async (tx) => {
      const version = await versionVigente(tx, c.municipio.estadoId)
      if (!version) throw new ErrorUsuario('No hay una versión vigente del índice.')
      const nodos = await nodosDe(tx, version.id, so.tipoSujetoId)
      const nodo = nodos.find((n) => n.id === e.nodoId)
      if (!nodo) throw new ErrorUsuario('La sección del índice no existe.')
      const ext = e.nombreOriginal.split('.').pop()!.toLowerCase()
      const rutaFinal = rutaDeArchivo({
        municipioSlug: c.municipio.slug,
        sujetoObligadoSlug: so.prefijo || so.tipo.slug,
        versionCarpeta: version.carpetaR2,
        nodoCarpeta: nodo.carpetaR2,
        periodoCarpeta: e.periodo.carpeta,
        nombreVisible: e.nombre,
        idCorto: id.slice(0, 6),
        extension: ext,
      })
      await mover(e.rutaTemporal, rutaFinal, {
        contentType: det.mime,
        contentDisposition: contentDisposition('inline', e.nombre, ext),
      })
      let miniaturaRuta: string | null = null
      if (e.miniaturaBase64) {
        miniaturaRuta = rutaDeMiniatura(rutaFinal)
        await subirDesdeServidor(miniaturaRuta, Buffer.from(e.miniaturaBase64, 'base64'), {
          contentType: 'image/jpeg',
          contentDisposition: 'inline',
        })
      }
      const ultimoOrden = (
        await tx.query.documentos.findMany({
          where: eq(documentos.nodoId, nodo.id),
          columns: { orden: true },
        })
      ).reduce((m, d) => Math.max(m, d.orden), -1)
      await tx.insert(documentos).values({
        id,
        municipioId: c.municipio.id,
        sujetoObligadoId: so.id,
        nodoId: nodo.id,
        nombre: e.nombre,
        periodoEtiqueta: e.periodo.etiqueta,
        periodoInicio: e.periodo.inicio,
        periodoFin: e.periodo.fin,
        carpetaPeriodo: e.periodo.carpeta,
        orden: ultimoOrden + 1,
        estado: 'publicado',
        tipo: 'archivo',
        publicadoEn: new Date(),
        creadoPor: c.sesion.usuarioId,
      })
      const [ver] = await tx
        .insert(documentoVersiones)
        .values({
          documentoId: id,
          numero: 1,
          rutaR2: rutaFinal,
          nombreOriginal: e.nombreOriginal,
          mime: det.mime,
          tipoArchivo: 'video',
          tamano: cab.tamano,
          duracionSeg: e.duracionSeg,
          miniaturaRuta,
          subidoPor: c.sesion.usuarioId,
        })
        .returning()
      await tx.update(documentos).set({ versionActualId: ver!.id }).where(eq(documentos.id, id))
      const rutaClaves = rutaDeAncestros(nodos, nodo.id).map((n) => n.clave ?? n.rutaSlug ?? '')
      await encolarRevalidacion(
        tx,
        c.municipio.id,
        etiquetasDeDocumento(id, { prefijo: so.prefijo, rutaClaves }),
      )
    })
    revalidatePath(`/m/${e.slug}`, 'layout')
    after(async () => {
      await procesarRevalidaciones(c.ctx, c.municipio)
      // el hash de un video de varios GB se calcula después de responder
      const v = await conUsuario(c.ctx, (tx) =>
        tx.query.documentoVersiones.findFirst({ where: eq(documentoVersiones.documentoId, id) }),
      )
      if (v) {
        const h = await hashDeObjeto(v.rutaR2).catch(() => null)
        if (h)
          await conUsuario(c.ctx, (tx) =>
            tx
              .update(documentoVersiones)
              .set({ hashSha256: h })
              .where(eq(documentoVersiones.id, v.id)),
          )
      }
    })
    return { id, nombre: e.nombre }
  })
}

const gb = (b: number) =>
  b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.round(b / 1024 ** 2)} MB`
