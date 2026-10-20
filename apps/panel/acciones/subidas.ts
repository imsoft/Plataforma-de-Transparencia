'use server'
import { exigir } from '@plataforma/auth'
import {
  cabecera,
  contentDisposition,
  definicion,
  detectarTipo,
  hashDeObjeto,
  firmarSubida,
  leerInicio,
  mover,
  nuevoIdCorto,
  nuevoIdDocumento,
  rutaDeArchivo,
  tipoPorExtension,
  borrar,
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

const base = z.object({
  slug: z.string(),
  sujetoObligadoId: z.string().uuid(),
  nodoId: z.string().uuid(),
})

const prepararSchema = base.extend({
  nombreArchivo: z.string().min(1).max(255),
  tamano: z.number().int().positive(),
})

/** Paso 1: URL firmada para subir directo al bucket, a una ruta temporal. */
export async function prepararSubida(entrada: z.infer<typeof prepararSchema>) {
  return accion(async () => {
    const e = prepararSchema.parse(entrada)
    const c = await contextoMunicipio(e.slug)
    exigir(c.sesion, 'documento:subir', {
      municipioId: c.municipio.id,
      sujetoObligadoId: e.sujetoObligadoId,
      nodoRuta: [e.nodoId],
    })
    const def = tipoPorExtension(e.nombreArchivo)
    if (!def)
      throw new ErrorUsuario(
        'Ese tipo de archivo no se puede publicar. Sube PDF, Word, Excel, PowerPoint, ZIP, imagen o video.',
      )
    if (e.tamano > def.tamanoMaximo) {
      throw new ErrorUsuario(
        `Este archivo pesa ${mb(e.tamano)} y el máximo para ${def.nombre} es ${mb(def.tamanoMaximo)}. Intenta comprimirlo o dividirlo.`,
      )
    }
    if (def.tipo === 'video')
      throw new ErrorUsuario(
        'Por ahora los videos se publican con su enlace de YouTube o Facebook. La subida directa de videos llega pronto.',
      )
    const ext = e.nombreArchivo.split('.').pop()!.toLowerCase()
    const subidaId = nuevoIdCorto() + nuevoIdCorto()
    const rutaTemporal = `${c.municipio.slug}/_subidas/${subidaId}.${ext}`
    const contentType = def.mimes[0]!
    const url = await firmarSubida(rutaTemporal, e.tamano, {
      contentType,
      contentDisposition: 'attachment',
    })
    return { subidaId, rutaTemporal, url, contentType }
  })
}

const archivoConfirmado = z.object({
  rutaTemporal: z.string().regex(/^[a-z0-9-]+\/_subidas\/[a-z0-9]+\.[a-z0-9]+$/),
  nombreOriginal: z.string().min(1).max(255),
  nombre: z.string().trim().min(2, 'El nombre es muy corto.').max(200),
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
})
const publicarSchema = base.extend({ archivos: z.array(archivoConfirmado).min(1).max(20) })

/** Paso 3: valida el archivo real, lo mueve a su carpeta definitiva y crea el documento. */
export async function publicarDocumentos(entrada: z.infer<typeof publicarSchema>) {
  return accion(async () => {
    const e = publicarSchema.parse(entrada)
    const c = await contextoMunicipio(e.slug)
    exigir(c.sesion, 'documento:subir', {
      municipioId: c.municipio.id,
      sujetoObligadoId: e.sujetoObligadoId,
      nodoRuta: [e.nodoId],
    })
    const so = c.municipio.sujetosObligados.find((x) => x.id === e.sujetoObligadoId)
    if (!so) throw new ErrorUsuario('El sujeto obligado no existe.')
    for (const a of e.archivos)
      if (!a.rutaTemporal.startsWith(`${c.municipio.slug}/_subidas/`))
        throw new ErrorUsuario('Subida inválida.')

    const creados: { id: string; nombre: string }[] = []
    await conUsuario(c.ctx, async (tx) => {
      const version = await versionVigente(tx, c.municipio.estadoId)
      if (!version) throw new ErrorUsuario('No hay una versión vigente del índice.')
      const nodos = await nodosDe(tx, version.id, so.tipoSujetoId)
      const nodo = nodos.find((n) => n.id === e.nodoId)
      if (!nodo) throw new ErrorUsuario('La sección del índice no existe.')
      const rutaClaves = rutaDeAncestros(nodos, nodo.id).map((n) => n.clave ?? n.rutaSlug ?? '')
      const ultimoOrden = (
        await tx.query.documentos.findMany({
          where: eq(documentos.nodoId, nodo.id),
          columns: { orden: true },
        })
      ).reduce((m, d) => Math.max(m, d.orden), -1)

      for (const [i, a] of e.archivos.entries()) {
        const cab = await cabecera(a.rutaTemporal)
        if (!cab)
          throw new ErrorUsuario(
            `El archivo "${a.nombreOriginal}" no terminó de subir. Inténtalo de nuevo.`,
          )
        const deteccion = await detectarTipo(await leerInicio(a.rutaTemporal), a.nombreOriginal)
        if (!deteccion.ok) {
          await borrar(a.rutaTemporal)
          throw new ErrorUsuario(`"${a.nombreOriginal}": ${deteccion.motivo}`)
        }
        const def = definicion(deteccion.tipo.tipo)
        if (cab.tamano > def.tamanoMaximo) {
          await borrar(a.rutaTemporal)
          throw new ErrorUsuario(
            `"${a.nombreOriginal}" pesa ${mb(cab.tamano)} y el máximo es ${mb(def.tamanoMaximo)}.`,
          )
        }
        const ext = a.nombreOriginal.split('.').pop()!.toLowerCase()
        const id = nuevoIdDocumento()
        const rutaFinal = rutaDeArchivo({
          municipioSlug: c.municipio.slug,
          sujetoObligadoSlug: so.prefijo || so.tipo.slug,
          versionCarpeta: version.carpetaR2,
          nodoCarpeta: nodo.carpetaR2,
          periodoCarpeta: a.periodo.carpeta,
          nombreVisible: a.nombre,
          idCorto: id.slice(0, 6),
          extension: ext,
        })
        await mover(a.rutaTemporal, rutaFinal, {
          contentType: deteccion.mime,
          contentDisposition: contentDisposition(def.disposicion, a.nombre, ext),
        })
        const hashSha256 = await hashDeObjeto(rutaFinal)

        const [doc] = await tx
          .insert(documentos)
          .values({
            id,
            municipioId: c.municipio.id,
            sujetoObligadoId: so.id,
            nodoId: nodo.id,
            nombre: a.nombre,
            periodoEtiqueta: a.periodo.etiqueta,
            periodoInicio: a.periodo.inicio,
            periodoFin: a.periodo.fin,
            carpetaPeriodo: a.periodo.carpeta,
            orden: ultimoOrden + 1 + i,
            estado: 'publicado',
            tipo: 'archivo',
            publicadoEn: new Date(),
            creadoPor: c.sesion.usuarioId,
          })
          .returning()
        const [ver] = await tx
          .insert(documentoVersiones)
          .values({
            documentoId: id,
            numero: 1,
            rutaR2: rutaFinal,
            nombreOriginal: a.nombreOriginal,
            mime: deteccion.mime,
            tipoArchivo: def.tipo,
            tamano: cab.tamano,
            hashSha256,
            subidoPor: c.sesion.usuarioId,
          })
          .returning()
        await tx.update(documentos).set({ versionActualId: ver!.id }).where(eq(documentos.id, id))
        await encolarRevalidacion(
          tx,
          c.municipio.id,
          etiquetasDeDocumento(id, { prefijo: so.prefijo, rutaClaves }),
        )
        creados.push({ id: doc!.id, nombre: doc!.nombre })
      }
    })
    revalidatePath(`/m/${e.slug}`, 'layout')
    after(() => procesarRevalidaciones(c.ctx, c.municipio))
    return creados
  })
}

const videoExternoSchema = base.extend({
  url: z.string().url('Pega un enlace válido (debe empezar con https://).'),
  nombre: z.string().trim().min(2).max(200),
  periodo: archivoConfirmado.shape.periodo,
})

const PATRONES_VIDEO = [
  /^https:\/\/(www\.|m\.)?youtube\.com\/(watch\?v=|live\/|shorts\/)[\w-]+/,
  /^https:\/\/youtu\.be\/[\w-]+/,
  /^https:\/\/(www\.|m\.|web\.)?facebook\.com\/.+\/videos\/\d+/,
  /^https:\/\/(www\.)?facebook\.com\/watch\/?\?v=\d+/,
  /^https:\/\/fb\.watch\/[\w-]+/,
]

export async function crearVideoExterno(entrada: z.infer<typeof videoExternoSchema>) {
  return accion(async () => {
    const e = videoExternoSchema.parse(entrada)
    if (!PATRONES_VIDEO.some((p) => p.test(e.url)))
      throw new ErrorUsuario('Solo se aceptan enlaces de videos de YouTube o Facebook.')
    const c = await contextoMunicipio(e.slug)
    exigir(c.sesion, 'documento:subir', {
      municipioId: c.municipio.id,
      sujetoObligadoId: e.sujetoObligadoId,
      nodoRuta: [e.nodoId],
    })
    const so = c.municipio.sujetosObligados.find((x) => x.id === e.sujetoObligadoId)
    if (!so) throw new ErrorUsuario('El sujeto obligado no existe.')
    const id = nuevoIdDocumento()
    await conUsuario(c.ctx, async (tx) => {
      const version = await versionVigente(tx, c.municipio.estadoId)
      const nodos = version ? await nodosDe(tx, version.id, so.tipoSujetoId) : []
      const rutaClaves = rutaDeAncestros(nodos, e.nodoId).map((n) => n.clave ?? n.rutaSlug ?? '')
      await tx.insert(documentos).values({
        id,
        municipioId: c.municipio.id,
        sujetoObligadoId: so.id,
        nodoId: e.nodoId,
        nombre: e.nombre,
        periodoEtiqueta: e.periodo.etiqueta,
        periodoInicio: e.periodo.inicio,
        periodoFin: e.periodo.fin,
        carpetaPeriodo: e.periodo.carpeta,
        estado: 'publicado',
        tipo: 'video_externo',
        urlExterna: e.url,
        publicadoEn: new Date(),
        creadoPor: c.sesion.usuarioId,
      })
      await encolarRevalidacion(
        tx,
        c.municipio.id,
        etiquetasDeDocumento(id, { prefijo: so.prefijo, rutaClaves }),
      )
    })
    revalidatePath(`/m/${e.slug}`, 'layout')
    after(() => procesarRevalidaciones(c.ctx, c.municipio))
    return { id, nombre: e.nombre }
  })
}

const mb = (b: number) => `${Math.round(b / 1024 / 1024)} MB`
