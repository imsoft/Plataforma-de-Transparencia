import { timingSafeEqual } from 'node:crypto'
import { checkAlerts } from '@/lib/alerts'

export const dynamic = 'force-dynamic'

/** Vercel Cron cada 10 min: busca comportamiento anómalo y avisa al superadmin. */
export async function GET(req: Request): Promise<Response> {
  const expected = process.env.CRON_SECRET ?? ''
  const received = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (
    !expected ||
    received.length !== expected.length ||
    !timingSafeEqual(Buffer.from(received), Buffer.from(expected))
  ) {
    return Response.json({ ok: false }, { status: 401 })
  }
  const r = await checkAlerts({
    userId: 'sistema:cron',
    role: 'superadmin',
    allowedMunicipalities: [],
    origin: 'cron',
  })
  return Response.json({ ok: true, ...r })
}
