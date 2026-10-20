/** POST /api/revalidate: el panel manda las etiquetas de caché a invalidar. Montar en `app/api/revalidate/route.ts`. */
import { timingSafeEqual } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { siteConfig } from './config'

const body = z.object({ tags: z.array(z.string().min(1).max(120)).min(1).max(100) })

function authorized(req: Request): boolean {
  const secret = siteConfig().revalidationSecret
  if (!secret) return false
  const received = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(received)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: Request): Promise<Response> {
  if (!authorized(req)) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  const r = body.safeParse(await req.json().catch(() => null))
  if (!r.success) return Response.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
  for (const label of r.data.tags) revalidateTag(label, 'max')
  return Response.json({ ok: true, revalidated: r.data.tags.length })
}
