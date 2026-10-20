'use server'
import { exigir } from '@plataforma/auth'
import {
  borrar,
  cabecera,
  contentDisposition,
  definicion,
  detectarTipo,
  hashDeObjeto,
  firmarSubida,
  leerInicio,
  mover,
  nuevoIdCorto,
  rutaDeVersionAnterior,
  tipoPorExtension,
} from '@plataforma/archivos'
import { conUsuario, documentoVersiones, documentos, eq } from '@plataforma/db'
import { documentoPorId } from '@plataforma/db/consultas/documentos'
import { nodosDe, rutaDeAncestros, versionVigente } from '@plataforma/db/consultas/indice'
import { encolarRevalidacion } from '@plataforma/db/consultas/revalidacion'
import { etiquetasDeDocumento } from '@plataforma/transparencia/etiquetas'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { contextoMunicipio } from '@/lib/municipio'
import { procesarRevalidaciones } from '@/lib/revalidar'
import { accion, ErrorUsuario } from './comun'

const prepararSchema = z.object({
  slug: z.string(),
  documentoId: z.string().min(6),
  nombreArchivo: z.string().min(1).max(255),
  tamano: z.number().int().positive(),
})

export async function prepararReemplazo(entrada: z.infer<typeof prepararSchema>) {
  return accion(async () => {
    const e = prepararSchema.parse(entrada)
    const c = await contextoMunicipio(e.slug)
    const doc = await conUsuario(c.ctx, (tx) => documentoPorId(tx, e.documentoId))
    if (!doc || doc.municipioId !== c.municipio.id || !doc.versionActual)
      throw new ErrorUsuario('Ese documento no existe o no tiene archivo.')
    exigir(c.sesion, 'documento:reemplazar', {
      municipioId: c.municipio.id,
      sujetoObligadoId: doc.sujetoObligadoId,
      nodoRuta: [doc.nodoId],
    })
    const def = tipoPorExtension(e.nombreArchivo)
    if (!def || def.tipo === 'video')
      throw new ErrorUsuario('Ese tipo de archivo no se puede publicar.')
    if (e.tamano > def.tamanoMaximo)
      throw new ErrorUsuario(
        `Pesa ${Math.round(e.tamano / 1048576)} MB y el máximo es ${Math.round(def.tamanoMaximo / 1048576)} MB.`,
      )
    const ext = e.nombreArchivo.split('.').pop()!.toLowerCase()
    const rutaTemporal = `${c.municipio.slug}/_subidas/${nuevoIdCorto()}${nuevoIdCorto()}.${ext}`
    const url = await firmarSubida(rutaTemporal, e.tamano, {
      contentType: def.mimes[0]!,
      contentDisposition: 'attachment',
    })
    return { rutaTemporal, url, contentType: def.mimes[0]! }
  })
}

const reemplazarSchema = z.object({
  slug: z.string(),
  documentoId: z.string().min(6),
  rutaTemporal: z.string().regex(/^[a-z0-9-]+\/_subidas\/[a-z0-9]+\.[a-z0-9]+$/),
  nombreOriginal: z.string().min(1).max(255),
})

export async function reemplazarArchivo(entrada: z.infer<typeof reemplazarSchema>) {
  return accion(async () => {
    const e = reemplazarSchema.parse(entrada)
    const c = await contextoMunicipio(e.slug)
    if (!e.rutaTemporal.startsWith(`${c.municipio.slug}/_subidas/`))
      throw new ErrorUsuario('Subida inválida.')
    await conUsuario(c.ctx, async (tx) => {
      const doc = await documentoPorId(tx, e.documentoId)
      if (!doc || doc.municipioId !== c.municipio.id || !doc.versionActual)
        throw new ErrorUsuario('Ese documento no existe o no tiene archivo.')
      exigir(c.sesion, 'documento:reemplazar', {
        municipioId: c.municipio.id,
        sujetoObligadoId: doc.sujetoObligadoId,
        nodoRuta: [doc.nodoId],
      })
      const cab = await cabecera(e.rutaTemporal)
      if (!cab) throw new ErrorUsuario('El archivo no terminó de subir. Inténtalo de nuevo.')
      const det = await detectarTipo(await leerInicio(e.rutaTemporal), e.nombreOriginal)
      if (!det.ok) {
        await borrar(e.rutaTemporal)
        throw new ErrorUsuario(det.motivo)
      }
      const def = definicion(det.tipo.tipo)
      const anterior = doc.versionActual
      const numero = anterior.numero + 1
      // 1. la versión vigente se va a _versiones/ con sufijo __vN
      const rutaAnterior = rutaDeVersionAnterior(anterior.rutaR2, anterior.numero)
      await mover(anterior.rutaR2, rutaAnterior)
      // 2. el archivo nuevo toma la ruta vigente (misma carpeta y nombre, nueva extensión si cambió)
      const ext = e.nombreOriginal.split('.').pop()!.toLowerCase()
      const rutaNueva = anterior.rutaR2.replace(/\.[^.]+$/, `.${ext}`)
      await mover(e.rutaTemporal, rutaNueva, {
        contentType: det.mime,
        contentDisposition: contentDisposition(def.disposicion, doc.nombre, ext),
      })
      const hashSha256 = await hashDeObjeto(rutaNueva)
      await tx
        .update(documentoVersiones)
        .set({ vigente: false, rutaR2: rutaAnterior })
        .where(eq(documentoVersiones.id, anterior.id))
      const [v] = await tx
        .insert(documentoVersiones)
        .values({
          documentoId: doc.id,
          numero,
          rutaR2: rutaNueva,
          nombreOriginal: e.nombreOriginal,
          mime: det.mime,
          tipoArchivo: def.tipo,
          tamano: cab.tamano,
          hashSha256,
          subidoPor: c.sesion.usuarioId,
        })
        .returning()
      await tx
        .update(documentos)
        .set({ versionActualId: v!.id, actualizadoEn: new Date() })
        .where(eq(documentos.id, doc.id))
      const version = await versionVigente(tx, c.municipio.estadoId)
      const nodos = version ? await nodosDe(tx, version.id, doc.nodo.tipoSujetoId) : []
      const ruta = rutaDeAncestros(nodos, doc.nodoId).map((n) => n.clave ?? n.rutaSlug ?? '')
      await encolarRevalidacion(
        tx,
        c.municipio.id,
        etiquetasDeDocumento(doc.id, { prefijo: doc.sujetoObligado.prefijo, rutaClaves: ruta }),
      )
    })
    revalidatePath(`/m/${e.slug}`, 'layout')
    after(() => procesarRevalidaciones(c.ctx, c.municipio))
  })
}
