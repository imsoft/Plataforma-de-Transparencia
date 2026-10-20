import { timingSafeEqual } from 'node:crypto'
import { conUsuario } from '@plataforma/db'
import { todosLosMunicipios } from '@plataforma/db/consultas/sesion'
import { procesarRevalidaciones } from '@/lib/revalidar'

export const dynamic = 'force-dynamic'

/** Reintenta las revalidaciones pendientes de todos los municipios (Vercel Cron cada 5 min). */
export async function GET(req: Request): Promise<Response> {
  const esperado = process.env.CRON_SECRET ?? ''
  const recibido = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (
    !esperado ||
    recibido.length !== esperado.length ||
    !timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado))
  ) {
    return Response.json({ ok: false }, { status: 401 })
  }
  const ctx = {
    usuarioId: 'sistema:cron',
    rol: 'superadmin' as const,
    municipiosPermitidos: [],
    origen: 'cron' as const,
  }
  const municipios = await todosLosMunicipios()
  let procesados = 0
  for (const m of municipios) {
    const completo = await conUsuario(ctx, (tx) =>
      tx.query.municipios.findFirst({
        where: (t, { eq }) => eq(t.id, m.id),
        columns: { id: true, slug: true, urlRevalidacion: true },
      }),
    )
    if (completo) {
      await procesarRevalidaciones(ctx, completo)
      procesados++
    }
  }
  return Response.json({ ok: true, procesados })
}
