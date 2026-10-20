'use server'
import { exigir } from '@plataforma/auth'
import {
  borrar,
  cabecera,
  detectarTipo,
  firmarSubida,
  leerInicio,
  mover,
  nuevoIdCorto,
  rutaDeTema,
} from '@plataforma/archivos'
import { conUsuario, eq, municipioTema, municipios, sql } from '@plataforma/db'
import { encolarRevalidacion } from '@plataforma/db/consultas/revalidacion'
import { TIPOGRAFIAS, temaSchema } from '@plataforma/tema'
import { etiquetasDeMunicipio } from '@plataforma/transparencia/etiquetas'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { contextoMunicipio } from '@/lib/municipio'
import { procesarRevalidaciones } from '@/lib/revalidar'
import { accion, ErrorUsuario } from './comun'

const identidadSchema = temaSchema.extend({
  tipografia: z.enum(TIPOGRAFIAS),
  datosContacto: z.object({
    direccion: z.string().trim().max(200).optional(),
    telefono: z.string().trim().max(30).optional(),
    correo: z.string().trim().email().optional().or(z.literal('')),
    horario: z.string().trim().max(120).optional(),
  }),
})

export async function guardarIdentidad(slug: string, entrada: z.infer<typeof identidadSchema>) {
  return accion(async () => {
    const c = await contextoMunicipio(slug)
    exigir(c.sesion, 'identidad:editar', { municipioId: c.municipio.id })
    const e = identidadSchema.parse(entrada)
    await conUsuario(c.ctx, async (tx) => {
      await tx
        .update(municipioTema)
        .set({
          colorPrimario: e.colorPrimario,
          colorSecundario: e.colorSecundario,
          colorAcento: e.colorAcento,
          tipografia: e.tipografia,
          version: sql`${municipioTema.version} + 1`,
          actualizadoEn: new Date(),
        })
        .where(eq(municipioTema.municipioId, c.municipio.id))
      await tx
        .update(municipios)
        .set({
          datosContacto: { ...e.datosContacto, correo: e.datosContacto.correo || undefined },
          actualizadoEn: new Date(),
        })
        .where(eq(municipios.id, c.municipio.id))
      await encolarRevalidacion(tx, c.municipio.id, etiquetasDeMunicipio())
    })
    revalidatePath(`/m/${slug}`, 'layout')
    after(() => procesarRevalidaciones(c.ctx, c.municipio))
  })
}

const imagenSchema = z.object({
  slug: z.string(),
  campo: z.enum(['escudo', 'logoAdministracion']),
  nombreArchivo: z.string().min(1).max(255),
  tamano: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024, 'La imagen debe pesar menos de 5 MB.'),
})

export async function prepararImagenIdentidad(entrada: z.infer<typeof imagenSchema>) {
  return accion(async () => {
    const e = imagenSchema.parse(entrada)
    const c = await contextoMunicipio(e.slug)
    exigir(c.sesion, 'identidad:editar', { municipioId: c.municipio.id })
    const ext = e.nombreArchivo.split('.').pop()?.toLowerCase() ?? ''
    if (!['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext))
      throw new ErrorUsuario('Sube una imagen PNG, JPG, WebP o SVG.')
    const rutaTemporal = `${c.municipio.slug}/_subidas/${nuevoIdCorto()}${nuevoIdCorto()}.${ext}`
    const contentType =
      ext === 'svg'
        ? 'image/svg+xml'
        : ext === 'png'
          ? 'image/png'
          : ext === 'webp'
            ? 'image/webp'
            : 'image/jpeg'
    const url = await firmarSubida(rutaTemporal, e.tamano, {
      contentType,
      contentDisposition: 'inline',
    })
    return { rutaTemporal, url, contentType }
  })
}

export async function confirmarImagenIdentidad(
  slug: string,
  campo: 'escudo' | 'logoAdministracion',
  rutaTemporal: string,
) {
  return accion(async () => {
    const c = await contextoMunicipio(slug)
    exigir(c.sesion, 'identidad:editar', { municipioId: c.municipio.id })
    if (!rutaTemporal.startsWith(`${c.municipio.slug}/_subidas/`))
      throw new ErrorUsuario('Subida inválida.')
    const cab = await cabecera(rutaTemporal)
    if (!cab) throw new ErrorUsuario('La imagen no terminó de subir.')
    const ext = rutaTemporal.split('.').pop()!
    if (ext !== 'svg') {
      const det = await detectarTipo(await leerInicio(rutaTemporal), `imagen.${ext}`)
      if (!det.ok || det.tipo.tipo !== 'imagen') {
        await borrar(rutaTemporal)
        throw new ErrorUsuario('El archivo no es una imagen válida.')
      }
    } else {
      const inicio = new TextDecoder().decode(await leerInicio(rutaTemporal, 2000)).toLowerCase()
      if (!inicio.includes('<svg') || inicio.includes('<script')) {
        await borrar(rutaTemporal)
        throw new ErrorUsuario('El SVG no es válido o contiene scripts.')
      }
    }
    const destino = rutaDeTema(c.municipio.slug, campo, nuevoIdCorto(), ext)
    await mover(rutaTemporal, destino, {
      contentType: cab.contentType,
      contentDisposition: 'inline',
    })
    await conUsuario(c.ctx, async (tx) => {
      await tx
        .update(municipioTema)
        .set(
          campo === 'escudo'
            ? { escudoRuta: destino, version: sql`${municipioTema.version} + 1` }
            : { logoAdministracionRuta: destino, version: sql`${municipioTema.version} + 1` },
        )
        .where(eq(municipioTema.municipioId, c.municipio.id))
      await encolarRevalidacion(tx, c.municipio.id, etiquetasDeMunicipio())
    })
    revalidatePath(`/m/${slug}`, 'layout')
    after(() => procesarRevalidaciones(c.ctx, c.municipio))
    return { ruta: destino }
  })
}
