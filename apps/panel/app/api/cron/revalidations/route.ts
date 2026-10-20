import { timingSafeEqual } from 'node:crypto'
import { withUser } from '@platform/db'
import { allMunicipalities } from '@platform/db/queries/session'
import { processRevalidations } from '@/lib/revalidate'

export const dynamic = 'force-dynamic'

/** Reintenta las revalidaciones pendientes de todos los municipios (Vercel Cron cada 5 min). */
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
  const ctx = {
    userId: 'sistema:cron',
    role: 'superadmin' as const,
    allowedMunicipalities: [],
    origin: 'cron' as const,
  }
  const municipalities = await allMunicipalities()
  let processed = 0
  for (const m of municipalities) {
    const full = await withUser(ctx, (tx) =>
      tx.query.municipalities.findFirst({
        where: (t, { eq }) => eq(t.id, m.id),
        columns: { id: true, slug: true, revalidationUrl: true },
      }),
    )
    if (full) {
      await processRevalidations(ctx, full)
      processed++
    }
  }
  return Response.json({ ok: true, processed })
}
