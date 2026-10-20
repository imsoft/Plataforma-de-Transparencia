import 'server-only'
import {
  firmarLecturaLarga,
  flujoDeLectura,
  nuevoIdCorto,
  rutaDeExportacion,
  subirFlujo,
} from '@plataforma/archivos'
import {
  and,
  conUsuario,
  desc,
  documentos as tablaDocumentos,
  eq,
  exportaciones,
  leyendasSinInformacion,
  bitacora as tablaBitacora,
  type ContextoUsuario,
} from '@plataforma/db'
import { ZipArchive } from 'archiver'
import { PassThrough } from 'node:stream'
import { enviarCorreo } from './correo'
import { env } from './env'

type Municipio = { id: string; slug: string; nombre: string; nombreOficial: string }

const csv = (filas: (string | number | null | undefined)[][]) =>
  filas.map((f) => f.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n') +
  '\n'

/**
 * Genera el ZIP completo de un municipio (archivos + metadatos + bitácora), lo sube al bucket y avisa por correo.
 * Corre en segundo plano (after()) tras solicitarlo. El ZIP se arma en streaming: no carga archivos en memoria.
 */
export async function generarExportacion(
  ctx: ContextoUsuario,
  municipio: Municipio,
  exportacionId: string,
  correoDestino: string,
) {
  const inicio = Date.now()
  try {
    const datos = await conUsuario(ctx, async (tx) => {
      await tx
        .update(exportaciones)
        .set({ estado: 'generando' })
        .where(eq(exportaciones.id, exportacionId))
      const docs = await tx.query.documentos.findMany({
        where: eq(tablaDocumentos.municipioId, municipio.id),
        with: {
          versiones: { orderBy: (v, { asc: a }) => [a(v.numero)] },
          nodo: true,
          sujetoObligado: { with: { tipo: true } },
        },
        orderBy: (d, { asc: a }) => [a(d.creadoEn)],
      })
      const leyendas = await tx.query.leyendasSinInformacion.findMany({
        where: eq(leyendasSinInformacion.municipioId, municipio.id),
      })
      const bit = await tx
        .select()
        .from(tablaBitacora)
        .where(and(eq(tablaBitacora.municipioId, municipio.id)))
        .orderBy(desc(tablaBitacora.ocurridoEn))
        .limit(200_000)
      return { docs, leyendas, bit }
    })

    const zip = new ZipArchive({ zlib: { level: 6 } })
    const salida = new PassThrough()
    zip.pipe(salida)
    const ruta = rutaDeExportacion(municipio.slug, new Date().toISOString(), nuevoIdCorto())
    const subida = subirFlujo(ruta, salida, {
      contentType: 'application/zip',
      contentDisposition: `attachment; filename="exportacion-${municipio.slug}.zip"`,
    })

    const prefijo = `${municipio.slug}/`
    const faltantes: string[] = []
    const filasDocs: (string | number | null)[][] = [
      [
        'id',
        'enlace_permanente',
        'sujeto_obligado',
        'clave',
        'seccion',
        'nombre',
        'periodo',
        'estado',
        'tipo',
        'url_externa',
        'archivo_actual',
        'publicado_en',
        'actualizado_en',
      ],
    ]
    for (const d of datos.docs) {
      const actual = d.versiones.find((v) => v.vigente) ?? d.versiones.at(-1)
      filasDocs.push([
        d.id,
        `/d/${d.id}`,
        d.sujetoObligado.nombre,
        d.nodo.clave ?? d.nodo.rutaSlug,
        d.nodo.titulo,
        d.nombre,
        d.periodoEtiqueta,
        d.estado,
        d.tipo,
        d.urlExterna,
        actual ? actual.rutaR2.replace(prefijo, '') : null,
        d.publicadoEn?.toISOString() ?? null,
        d.actualizadoEn.toISOString(),
      ])
      for (const v of d.versiones) {
        const flujo = await flujoDeLectura(v.rutaR2)
        if (!flujo) {
          faltantes.push(v.rutaR2)
          continue
        }
        zip.append(flujo as never, { name: v.rutaR2.replace(prefijo, '') })
      }
    }
    zip.append(csv(filasDocs), { name: '_metadatos/documentos.csv' })
    zip.append(
      csv([
        ['id', 'sujeto_obligado', 'clave', 'periodo', 'texto', 'creada_en'],
        ...datos.leyendas.map((l) => [
          l.id,
          l.sujetoObligadoId,
          l.nodoId,
          l.periodoEtiqueta,
          l.texto,
          l.creadoEn.toISOString(),
        ]),
      ]),
      { name: '_metadatos/leyendas-sin-informacion.csv' },
    )
    zip.append(
      csv([
        ['fecha', 'actor', 'rol', 'entidad', 'id', 'accion', 'cambios'],
        ...datos.bit.map((b) => [
          b.ocurridoEn.toISOString(),
          b.actorId,
          b.actorRol,
          b.entidad,
          b.entidadId,
          b.accion,
          JSON.stringify(b.cambios ?? {}),
        ]),
      ]),
      { name: '_metadatos/bitacora.csv' },
    )
    zip.append(
      JSON.stringify(
        {
          municipio,
          generadoEn: new Date().toISOString(),
          documentos: datos.docs.length,
          archivosFaltantes: faltantes,
          nota: 'Los archivos conservan la estructura de carpetas del bucket: sujeto obligado / versión del índice / artículo / fracción / inciso / periodo. Las versiones anteriores están en _versiones/.',
        },
        null,
        2,
      ),
      { name: '_metadatos/exportacion.json' },
    )
    await zip.finalize()
    await subida

    await conUsuario(ctx, (tx) =>
      tx
        .update(exportaciones)
        .set({ estado: 'lista', rutaR2: ruta, terminadaEn: new Date() })
        .where(eq(exportaciones.id, exportacionId)),
    )
    const enlace = await firmarLecturaLarga(ruta)
    await enviarCorreo({
      para: correoDestino,
      asunto: `Exportación completa de ${municipio.nombre} lista · ${env.NEXT_PUBLIC_PLATFORM_NAME}`,
      html: `<p>La exportación de <strong>${municipio.nombreOficial}</strong> está lista (${datos.docs.length} documentos${faltantes.length ? `, ${faltantes.length} archivos no encontrados` : ''}).</p><p><a href="${enlace}">Descargar ZIP</a> (el enlace vence en 7 días; también puedes bajarlo desde el panel).</p>`,
      texto: `La exportación de ${municipio.nombreOficial} está lista. Descárgala aquí (vence en 7 días): ${enlace}`,
    })
    console.info(
      `exportación ${exportacionId} lista en ${Math.round((Date.now() - inicio) / 1000)} s`,
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('exportación fallida', exportacionId, msg)
    await conUsuario(ctx, (tx) =>
      tx
        .update(exportaciones)
        .set({ estado: 'error', mensajeError: msg.slice(0, 500), terminadaEn: new Date() })
        .where(eq(exportaciones.id, exportacionId)),
    ).catch(() => {})
  }
}
