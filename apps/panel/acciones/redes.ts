'use server'
import { exigir } from '@plataforma/auth'
import { and, conUsuario, eq, redesSociales } from '@plataforma/db'
import { encolarRevalidacion } from '@plataforma/db/consultas/revalidacion'
import { REDES, enlaceWhatsApp, validarEnlace } from '@plataforma/redes'
import { etiquetasDeMunicipio } from '@plataforma/transparencia/etiquetas'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { contextoMunicipio } from '@/lib/municipio'
import { procesarRevalidaciones } from '@/lib/revalidar'
import { accion, ErrorUsuario } from './comun'

const redSchema = z.object({
  id: z.string().uuid().optional(),
  sujetoObligadoId: z.string().uuid().nullable(),
  red: z.enum(REDES.map((r) => r.slug) as [string, ...string[]]),
  nombreOtra: z.string().trim().max(40).nullable(),
  url: z.string().trim().max(500),
  whatsapp: z.object({ numero: z.string(), mensaje: z.string().max(200).optional() }).optional(),
  texto: z.string().trim().max(80).nullable(),
  visible: z.boolean().default(true),
  ocultarEnVeda: z.boolean().default(false),
})

export async function guardarRed(slug: string, entrada: z.input<typeof redSchema>) {
  return accion(async () => {
    const c = await contextoMunicipio(slug)
    exigir(c.sesion, 'redes_sociales:editar', { municipioId: c.municipio.id })
    const e = redSchema.parse(entrada)
    let url = e.url
    if (e.red === 'whatsapp' && e.whatsapp) {
      const wa = enlaceWhatsApp(e.whatsapp.numero, e.whatsapp.mensaje)
      if (!wa) throw new ErrorUsuario('Escribe el número de WhatsApp a 10 dígitos.')
      url = wa
    }
    const v = validarEnlace(url, e.red)
    if (!v.ok) throw new ErrorUsuario(v.error)
    await conUsuario(c.ctx, async (tx) => {
      if (e.id) {
        await tx
          .update(redesSociales)
          .set({
            sujetoObligadoId: e.sujetoObligadoId,
            red: e.red,
            nombreOtra: e.nombreOtra,
            url,
            texto: e.texto,
            visible: e.visible,
            ocultarEnVeda: e.ocultarEnVeda,
            actualizadoEn: new Date(),
          })
          .where(and(eq(redesSociales.id, e.id), eq(redesSociales.municipioId, c.municipio.id)))
      } else {
        const existentes = await tx.query.redesSociales.findMany({
          where: eq(redesSociales.municipioId, c.municipio.id),
          columns: { orden: true },
        })
        await tx.insert(redesSociales).values({
          municipioId: c.municipio.id,
          sujetoObligadoId: e.sujetoObligadoId,
          red: e.red,
          nombreOtra: e.nombreOtra,
          url,
          texto: e.texto,
          visible: e.visible,
          ocultarEnVeda: e.ocultarEnVeda,
          orden: existentes.length,
        })
      }
      await encolarRevalidacion(tx, c.municipio.id, etiquetasDeMunicipio())
    })
    revalidatePath(`/m/${slug}/redes-sociales`)
    after(() => procesarRevalidaciones(c.ctx, c.municipio))
    return { aviso: v.aviso }
  })
}

export async function eliminarRed(slug: string, id: string) {
  return accion(async () => {
    const c = await contextoMunicipio(slug)
    exigir(c.sesion, 'redes_sociales:editar', { municipioId: c.municipio.id })
    await conUsuario(c.ctx, async (tx) => {
      await tx
        .delete(redesSociales)
        .where(
          and(
            eq(redesSociales.id, z.string().uuid().parse(id)),
            eq(redesSociales.municipioId, c.municipio.id),
          ),
        )
      await encolarRevalidacion(tx, c.municipio.id, etiquetasDeMunicipio())
    })
    revalidatePath(`/m/${slug}/redes-sociales`)
    after(() => procesarRevalidaciones(c.ctx, c.municipio))
  })
}

export async function reordenarRedes(slug: string, idsEnOrden: string[]) {
  return accion(async () => {
    const c = await contextoMunicipio(slug)
    exigir(c.sesion, 'redes_sociales:editar', { municipioId: c.municipio.id })
    const ids = z.array(z.string().uuid()).parse(idsEnOrden)
    await conUsuario(c.ctx, async (tx) => {
      for (const [i, id] of ids.entries())
        await tx
          .update(redesSociales)
          .set({ orden: i })
          .where(and(eq(redesSociales.id, id), eq(redesSociales.municipioId, c.municipio.id)))
      await encolarRevalidacion(tx, c.municipio.id, etiquetasDeMunicipio())
    })
    revalidatePath(`/m/${slug}/redes-sociales`)
    after(() => procesarRevalidaciones(c.ctx, c.municipio))
  })
}
