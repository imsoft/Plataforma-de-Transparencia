/** POST /api/revalidar: el panel manda las etiquetas de caché a invalidar. Montar en `app/api/revalidar/route.ts`. */
import { timingSafeEqual } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { configSitio } from './config'

const cuerpo = z.object({ etiquetas: z.array(z.string().min(1).max(120)).min(1).max(100) })

function autorizado(req: Request): boolean {
  const secreto = configSitio().revalidacionSecreto
  if (!secreto) return false
  const recibido = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(recibido)
  const b = Buffer.from(secreto)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: Request): Promise<Response> {
  if (!autorizado(req)) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  const r = cuerpo.safeParse(await req.json().catch(() => null))
  if (!r.success) return Response.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
  for (const etiqueta of r.data.etiquetas) revalidateTag(etiqueta, 'max')
  return Response.json({ ok: true, revalidadas: r.data.etiquetas.length })
}
