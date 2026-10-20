import 'server-only'
import { signLongRead, readStream, newShortId, exportPath, uploadStream } from '@platform/files'
import {
  and,
  withUser,
  desc,
  documents as documentsTable,
  eq,
  exportJobs,
  noInformationNotices,
  auditLog as auditLogTable,
  type UserContext,
} from '@platform/db'
import { ZipArchive } from 'archiver'
import { PassThrough } from 'node:stream'
import { sendEmail } from './email'
import { env } from './env'

type Municipality = { id: string; slug: string; name: string; officialName: string }

const csv = (rows: (string | number | null | undefined)[][]) =>
  rows.map((f) => f.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n') +
  '\n'

/**
 * Genera el ZIP completo de un municipio (archivos + metadatos + bitácora), lo sube al bucket y avisa por correo.
 * Corre en segundo plano (after()) tras solicitarlo. El ZIP se arma en streaming: no carga archivos en memoria.
 */
export async function generateExport(
  ctx: UserContext,
  municipality: Municipality,
  exportId: string,
  recipientEmail: string,
) {
  const start = Date.now()
  try {
    const data = await withUser(ctx, async (tx) => {
      await tx.update(exportJobs).set({ status: 'generating' }).where(eq(exportJobs.id, exportId))
      const docs = await tx.query.documents.findMany({
        where: eq(documentsTable.municipalityId, municipality.id),
        with: {
          versions: { orderBy: (v, { asc: a }) => [a(v.number)] },
          node: true,
          obligatedSubject: { with: { type: true } },
        },
        orderBy: (d, { asc: a }) => [a(d.createdAt)],
      })
      const notices = await tx.query.noInformationNotices.findMany({
        where: eq(noInformationNotices.municipalityId, municipality.id),
      })
      const auditRows = await tx
        .select()
        .from(auditLogTable)
        .where(and(eq(auditLogTable.municipalityId, municipality.id)))
        .orderBy(desc(auditLogTable.occurredAt))
        .limit(200_000)
      return { docs, notices, auditRows }
    })

    const zip = new ZipArchive({ zlib: { level: 6 } })
    const output = new PassThrough()
    zip.pipe(output)
    const path = exportPath(municipality.slug, new Date().toISOString(), newShortId())
    const upload = uploadStream(path, output, {
      contentType: 'application/zip',
      contentDisposition: `attachment; filename="exportacion-${municipality.slug}.zip"`,
    })

    const prefix = `${municipality.slug}/`
    const missing: string[] = []
    const docRows: (string | number | null)[][] = [
      [
        'id',
        'enlace_permanente',
        'obligated_subject',
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
    for (const d of data.docs) {
      const current = d.versions.find((v) => v.isCurrent) ?? d.versions.at(-1)
      docRows.push([
        d.id,
        `/d/${d.id}`,
        d.obligatedSubject.name,
        d.node.key ?? d.node.routeSlug,
        d.node.title,
        d.name,
        d.periodLabel,
        d.status,
        d.type,
        d.externalUrl,
        current ? current.storagePath.replace(prefix, '') : null,
        d.publishedAt?.toISOString() ?? null,
        d.updatedAt.toISOString(),
      ])
      for (const v of d.versions) {
        const stream = await readStream(v.storagePath)
        if (!stream) {
          missing.push(v.storagePath)
          continue
        }
        zip.append(stream as never, { name: v.storagePath.replace(prefix, '') })
      }
    }
    zip.append(csv(docRows), { name: '_metadatos/documentos.csv' })
    zip.append(
      csv([
        ['id', 'obligated_subject', 'clave', 'periodo', 'texto', 'creada_en'],
        ...data.notices.map((l) => [
          l.id,
          l.obligatedSubjectId,
          l.nodeId,
          l.periodLabel,
          l.text,
          l.createdAt.toISOString(),
        ]),
      ]),
      { name: '_metadatos/leyendas-sin-informacion.csv' },
    )
    zip.append(
      csv([
        ['fecha', 'actor', 'rol', 'entidad', 'id', 'accion', 'cambios'],
        ...data.auditRows.map((b) => [
          b.occurredAt.toISOString(),
          b.actorId,
          b.actorRole,
          b.entity,
          b.entityId,
          b.action,
          JSON.stringify(b.changes ?? {}),
        ]),
      ]),
      { name: '_metadatos/bitacora.csv' },
    )
    zip.append(
      JSON.stringify(
        {
          municipality,
          generatedAt: new Date().toISOString(),
          documents: data.docs.length,
          missingFiles: missing,
          note: 'Los archivos conservan la estructura de carpetas del bucket: sujeto obligado / versión del índice / artículo / fracción / inciso / periodo. Las versiones anteriores están en _versiones/.',
        },
        null,
        2,
      ),
      { name: '_metadatos/exportacion.json' },
    )
    await zip.finalize()
    await upload

    await withUser(ctx, (tx) =>
      tx
        .update(exportJobs)
        .set({ status: 'ready', storagePath: path, finishedAt: new Date() })
        .where(eq(exportJobs.id, exportId)),
    )
    const link = await signLongRead(path)
    await sendEmail({
      to: recipientEmail,
      emailSubject: `Exportación completa de ${municipality.name} lista · ${env.NEXT_PUBLIC_PLATFORM_NAME}`,
      html: `<p>La exportación de <strong>${municipality.officialName}</strong> está lista (${data.docs.length} documentos${missing.length ? `, ${missing.length} archivos no encontrados` : ''}).</p><p><a href="${link}">Descargar ZIP</a> (el enlace vence en 7 días; también puedes bajarlo desde el panel).</p>`,
      text: `La exportación de ${municipality.officialName} está lista. Descárgala aquí (vence en 7 días): ${link}`,
    })
    console.info(`exportación ${exportId} lista en ${Math.round((Date.now() - start) / 1000)} s`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('exportación fallida', exportId, msg)
    await withUser(ctx, (tx) =>
      tx
        .update(exportJobs)
        .set({ status: 'error', errorMessage: msg.slice(0, 500), finishedAt: new Date() })
        .where(eq(exportJobs.id, exportId)),
    ).catch(() => {})
  }
}
