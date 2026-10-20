'use server'
import { exigir } from '@plataforma/auth'
import { contentDisposition, definicion, mover, rutaDeArchivo } from '@plataforma/archivos'
import {
  and,
  conUsuario,
  documentoVersiones,
  documentos,
  eq,
  leyendasSinInformacion,
} from '@plataforma/db'
import { documentoPorId } from '@plataforma/db/consultas/documentos'
import { nodosDe, rutaDeAncestros, versionVigente } from '@plataforma/db/consultas/indice'
import { encolarRevalidacion } from '@plataforma/db/consultas/revalidacion'
import { periodoDe } from '@plataforma/indice'
import { etiquetasDeDocumento, etiquetasDeNodo } from '@plataforma/transparencia/etiquetas'
import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { contextoMunicipio } from '@/lib/municipio'
import { procesarRevalidaciones } from '@/lib/revalidar'
import { accion, ErrorUsuario } from './comun'

const idDocumento = z.string().min(6).max(40)
const periodoSchema = z.object({
  etiqueta: z.string().trim().min(1).max(60).nullable(),
  inicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  fin: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  carpeta: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .default('permanente'),
})
export type Periodo = z.infer<typeof periodoSchema>

/** Etiquetas de caché del documento + su nodo y ancestros. */
async function etiquetasDe(
  tx: Parameters<Parameters<typeof conUsuario>[1]>[0],
  estadoId: string,
  doc: {
    id: string
    nodoId: string
    sujetoObligado: { prefijo: string }
    nodo: { tipoSujetoId: string }
  },
) {
  const version = await versionVigente(tx, estadoId)
  const nodos = version ? await nodosDe(tx, version.id, doc.nodo.tipoSujetoId) : []
  const ruta = rutaDeAncestros(nodos, doc.nodoId).map((n) => n.clave ?? n.rutaSlug ?? '')
  return etiquetasDeDocumento(doc.id, { prefijo: doc.sujetoObligado.prefijo, rutaClaves: ruta })
}

async function cargar(slug: string, id: string) {
  const c = await contextoMunicipio(slug)
  const doc = await conUsuario(c.ctx, (tx) => documentoPorId(tx, id))
  if (!doc || doc.municipioId !== c.municipio.id)
    throw new ErrorUsuario('Ese documento ya no existe.')
  return { c, doc }
}

/**
 * Renombrar o cambiar de periodo mueve el archivo a su nueva carpeta/nombre en el bucket (sección 7.5).
 * El enlace /d/<id> no cambia porque apunta al documento, no a la ruta.
 */
async function reubicarArchivo(
  tx: Parameters<Parameters<typeof conUsuario>[1]>[0],
  c: Awaited<ReturnType<typeof contextoMunicipio>>,
  docId: string,
) {
  const doc = await documentoPorId(tx, docId)
  if (!doc?.versionActual || doc.tipo !== 'archivo') return
  const so = c.municipio.sujetosObligados.find((x) => x.id === doc.sujetoObligadoId)
  const version = await versionVigente(tx, c.municipio.estadoId)
  if (!so || !version) return
  const ext = doc.versionActual.rutaR2.split('.').pop() ?? 'pdf'
  const nueva = rutaDeArchivo({
    municipioSlug: c.municipio.slug,
    sujetoObligadoSlug: so.prefijo || so.tipo.slug,
    versionCarpeta: version.carpetaR2,
    nodoCarpeta: doc.nodo.carpetaR2,
    periodoCarpeta: doc.carpetaPeriodo,
    nombreVisible: doc.nombre,
    idCorto: doc.id.slice(0, 6),
    extension: ext,
  })
  if (nueva === doc.versionActual.rutaR2) return
  const def = definicion(doc.versionActual.tipoArchivo)
  await mover(doc.versionActual.rutaR2, nueva, {
    contentType: doc.versionActual.mime,
    contentDisposition: contentDisposition(def.disposicion, doc.nombre, ext),
  })
  await tx
    .update(documentoVersiones)
    .set({ rutaR2: nueva })
    .where(eq(documentoVersiones.id, doc.versionActual.id))
}

function despues(c: Awaited<ReturnType<typeof contextoMunicipio>>, slug: string) {
  revalidatePath(`/m/${slug}`, 'layout')
  after(() => procesarRevalidaciones(c.ctx, c.municipio))
}

export async function renombrarDocumento(slug: string, id: string, nombre: string) {
  return accion(async () => {
    const { c, doc } = await cargar(slug, idDocumento.parse(id))
    const nuevo = z
      .string()
      .trim()
      .min(2, 'El nombre es muy corto.')
      .max(200, 'El nombre es muy largo (máximo 200 caracteres).')
      .parse(nombre)
    exigir(c.sesion, 'documento:renombrar', {
      municipioId: c.municipio.id,
      sujetoObligadoId: doc.sujetoObligadoId,
    })
    await conUsuario(c.ctx, async (tx) => {
      await tx
        .update(documentos)
        .set({ nombre: nuevo, actualizadoEn: new Date() })
        .where(eq(documentos.id, doc.id))
      await reubicarArchivo(tx, c, doc.id)
      await encolarRevalidacion(
        tx,
        c.municipio.id,
        await etiquetasDe(tx, c.municipio.estadoId, doc),
      )
    })
    despues(c, slug)
  })
}

export async function cambiarPeriodo(slug: string, id: string, periodo: Periodo) {
  return accion(async () => {
    const { c, doc } = await cargar(slug, idDocumento.parse(id))
    const p = periodoSchema.parse(periodo)
    exigir(c.sesion, 'documento:renombrar', {
      municipioId: c.municipio.id,
      sujetoObligadoId: doc.sujetoObligadoId,
    })
    await conUsuario(c.ctx, async (tx) => {
      await tx
        .update(documentos)
        .set({
          periodoEtiqueta: p.etiqueta,
          periodoInicio: p.inicio,
          periodoFin: p.fin,
          carpetaPeriodo: p.carpeta,
          actualizadoEn: new Date(),
        })
        .where(eq(documentos.id, doc.id))
      await reubicarArchivo(tx, c, doc.id)
      await encolarRevalidacion(
        tx,
        c.municipio.id,
        await etiquetasDe(tx, c.municipio.estadoId, doc),
      )
    })
    despues(c, slug)
  })
}

const ESTADOS = z.enum(['publicado', 'oculto', 'historico', 'papelera'])
const ACCION_POR_ESTADO = {
  publicado: 'documento:restaurar',
  oculto: 'documento:ocultar',
  historico: 'documento:ocultar',
  papelera: 'documento:eliminar',
} as const

export async function cambiarEstadoDocumento(
  slug: string,
  id: string,
  estado: z.infer<typeof ESTADOS>,
) {
  return accion(async () => {
    const { c, doc } = await cargar(slug, idDocumento.parse(id))
    const nuevo = ESTADOS.parse(estado)
    exigir(c.sesion, ACCION_POR_ESTADO[nuevo], {
      municipioId: c.municipio.id,
      sujetoObligadoId: doc.sujetoObligadoId,
    })
    await conUsuario(c.ctx, async (tx) => {
      await tx
        .update(documentos)
        .set({
          estado: nuevo,
          eliminadoEn: nuevo === 'papelera' ? new Date() : null,
          actualizadoEn: new Date(),
        })
        .where(eq(documentos.id, doc.id))
      await encolarRevalidacion(
        tx,
        c.municipio.id,
        await etiquetasDe(tx, c.municipio.estadoId, doc),
      )
    })
    despues(c, slug)
    return { estadoAnterior: doc.estado }
  })
}

export async function reordenarDocumentos(
  slug: string,
  nodoId: string,
  sujetoObligadoId: string,
  idsEnOrden: string[],
) {
  return accion(async () => {
    const c = await contextoMunicipio(slug)
    const ids = z.array(idDocumento).min(1).max(500).parse(idsEnOrden)
    exigir(c.sesion, 'documento:reordenar', { municipioId: c.municipio.id, sujetoObligadoId })
    await conUsuario(c.ctx, async (tx) => {
      for (const [i, id] of ids.entries()) {
        await tx
          .update(documentos)
          .set({ orden: i })
          .where(
            and(
              eq(documentos.id, id),
              eq(documentos.nodoId, nodoId),
              eq(documentos.municipioId, c.municipio.id),
            ),
          )
      }
      const primero = await documentoPorId(tx, ids[0]!)
      if (primero)
        await encolarRevalidacion(
          tx,
          c.municipio.id,
          await etiquetasDe(tx, c.municipio.estadoId, primero),
        )
    })
    despues(c, slug)
  })
}

const leyendaSchema = z.object({
  sujetoObligadoId: z.string().uuid(),
  nodoId: z.string().uuid(),
  periodoInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodicidad: z.enum(['mensual', 'trimestral', 'semestral', 'anual']),
  texto: z
    .string()
    .trim()
    .min(10, 'Explica brevemente por qué no se generó información (mínimo 10 letras).')
    .max(1000),
})

export async function marcarLeyenda(slug: string, entrada: z.infer<typeof leyendaSchema>) {
  return accion(async () => {
    const c = await contextoMunicipio(slug)
    const e = leyendaSchema.parse(entrada)
    exigir(c.sesion, 'leyenda:marcar', {
      municipioId: c.municipio.id,
      sujetoObligadoId: e.sujetoObligadoId,
      nodoRuta: [e.nodoId],
    })
    const periodo = periodoDe(e.periodicidad, e.periodoInicio)
    await conUsuario(c.ctx, async (tx) => {
      await tx.insert(leyendasSinInformacion).values({
        municipioId: c.municipio.id,
        sujetoObligadoId: e.sujetoObligadoId,
        nodoId: e.nodoId,
        periodoEtiqueta: periodo.etiqueta,
        periodoInicio: periodo.inicio,
        periodoFin: periodo.fin,
        texto: e.texto,
        creadoPor: c.sesion.usuarioId,
      })
      const so = c.municipio.sujetosObligados.find((x) => x.id === e.sujetoObligadoId)!
      const version = await versionVigente(tx, c.municipio.estadoId)
      const nodos = version ? await nodosDe(tx, version.id, so.tipoSujetoId) : []
      const ruta = rutaDeAncestros(nodos, e.nodoId).map((n) => n.clave ?? n.rutaSlug ?? '')
      await encolarRevalidacion(
        tx,
        c.municipio.id,
        etiquetasDeNodo({ prefijo: so.prefijo, rutaClaves: ruta }),
      )
    })
    despues(c, slug)
  })
}

export async function desmarcarLeyenda(slug: string, leyendaId: string) {
  return accion(async () => {
    const c = await contextoMunicipio(slug)
    const id = z.string().uuid().parse(leyendaId)
    await conUsuario(c.ctx, async (tx) => {
      const l = await tx.query.leyendasSinInformacion.findFirst({
        where: eq(leyendasSinInformacion.id, id),
      })
      if (!l) throw new ErrorUsuario('Esa leyenda ya no existe.')
      exigir(c.sesion, 'leyenda:desmarcar', {
        municipioId: c.municipio.id,
        sujetoObligadoId: l.sujetoObligadoId,
        nodoRuta: [l.nodoId],
      })
      await tx
        .update(leyendasSinInformacion)
        .set({ eliminadoEn: new Date() })
        .where(eq(leyendasSinInformacion.id, id))
      const so = c.municipio.sujetosObligados.find((x) => x.id === l.sujetoObligadoId)!
      const version = await versionVigente(tx, c.municipio.estadoId)
      const nodos = version ? await nodosDe(tx, version.id, so.tipoSujetoId) : []
      const ruta = rutaDeAncestros(nodos, l.nodoId).map((n) => n.clave ?? n.rutaSlug ?? '')
      await encolarRevalidacion(
        tx,
        c.municipio.id,
        etiquetasDeNodo({ prefijo: so.prefijo, rutaClaves: ruta }),
      )
    })
    despues(c, slug)
  })
}
