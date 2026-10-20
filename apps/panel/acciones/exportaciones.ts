'use server'
import { exigir } from '@plataforma/auth'
import { firmarLecturaLarga } from '@plataforma/archivos'
import { and, conUsuario, desc, eq, exportaciones } from '@plataforma/db'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { generarExportacion } from '@/lib/exportar'
import { contextoMunicipio } from '@/lib/municipio'
import { accion, ErrorUsuario } from './comun'

export async function solicitarExportacion(slug: string) {
  return accion(async () => {
    const c = await contextoMunicipio(slug)
    exigir(c.sesion, 'exportacion:solicitar', { municipioId: c.municipio.id })
    const id = await conUsuario(c.ctx, async (tx) => {
      const enCurso = await tx.query.exportaciones.findFirst({
        where: and(
          eq(exportaciones.municipioId, c.municipio.id),
          eq(exportaciones.estado, 'generando'),
        ),
      })
      if (enCurso)
        throw new ErrorUsuario(
          'Ya hay una exportación generándose. Te avisamos por correo cuando termine.',
        )
      const [e] = await tx
        .insert(exportaciones)
        .values({ municipioId: c.municipio.id, solicitanteId: c.sesion.usuarioId })
        .returning()
      return e!.id
    })
    revalidatePath(`/m/${slug}/exportaciones`)
    const { id: municipioId, slug: mslug, nombre, nombreOficial } = c.municipio
    after(() =>
      generarExportacion(
        c.ctx,
        { id: municipioId, slug: mslug, nombre, nombreOficial },
        id,
        c.sesion.email,
      ),
    )
    return { id }
  })
}

export async function listarExportaciones(slug: string) {
  const c = await contextoMunicipio(slug)
  exigir(c.sesion, 'exportacion:ver', { municipioId: c.municipio.id })
  const filas = await conUsuario(c.ctx, (tx) =>
    tx.query.exportaciones.findMany({
      where: eq(exportaciones.municipioId, c.municipio.id),
      orderBy: [desc(exportaciones.creadaEn)],
      limit: 20,
    }),
  )
  return Promise.all(
    filas.map(async (f) => ({
      id: f.id,
      estado: f.estado,
      creadaEn: f.creadaEn,
      terminadaEn: f.terminadaEn,
      mensajeError: f.mensajeError,
      enlace: f.estado === 'lista' && f.rutaR2 ? await firmarLecturaLarga(f.rutaR2) : null,
    })),
  )
}
