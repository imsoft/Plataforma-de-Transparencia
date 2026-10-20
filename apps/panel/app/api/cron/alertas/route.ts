import { timingSafeEqual } from 'node:crypto'
import { revisarAlertas } from '@/lib/alertas'

export const dynamic = 'force-dynamic'

/** Vercel Cron cada 10 min: busca comportamiento anómalo y avisa al superadmin. */
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
  const r = await revisarAlertas({
    usuarioId: 'sistema:cron',
    rol: 'superadmin',
    municipiosPermitidos: [],
    origen: 'cron',
  })
  return Response.json({ ok: true, ...r })
}
