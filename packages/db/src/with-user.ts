import { eq, sql } from 'drizzle-orm'
import { dbMigrator, dbPanel, dbPublic, type Db, type Tx } from './client'
import { municipalities } from './schema/municipalities'

export type { Tx }

export const ROLES = ['superadmin', 'supervisor', 'municipal_admin', 'uploader'] as const
export type Role = (typeof ROLES)[number]

export type UserContext = {
  userId: string
  role: Role
  /** Municipios donde el usuario tiene membresía. Vacío para superadmin (ve todo por rol). */
  allowedMunicipalities: string[]
  origin?: 'panel' | 'migration' | 'generator' | 'cron'
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Única puerta de escritura del panel. Abre una transacción y fija las variables de sesión que leen
 * los triggers de bitácora y las políticas RLS. Sin ellas, Postgres rechaza cualquier escritura.
 */
export function withUser<T>(
  ctx: UserContext,
  fn: (tx: Tx) => PromiseLike<T>,
  db: Db = dbPanel(),
): Promise<T> {
  if (!ctx.userId) throw new Error('withUser: falta usuarioId')
  if (!ROLES.includes(ctx.role)) throw new Error(`withUser: rol inválido "${ctx.role}"`)
  for (const m of ctx.allowedMunicipalities) {
    if (!UUID.test(m)) throw new Error(`withUser: id de municipio inválido "${m}"`)
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT set_config('app.user_id', ${ctx.userId}, true),
             set_config('app.role', ${ctx.role}, true),
             set_config('app.allowed_municipalities', ${ctx.allowedMunicipalities.join(',')}, true),
             set_config('app.origin', ${ctx.origin ?? 'panel'}, true)
    `)
    return await fn(tx)
  })
}

/** Lecturas del sitio público: solo ve lo publicado del municipio indicado. */
export function asPublic<T>(
  municipalityId: string,
  fn: (tx: Tx) => PromiseLike<T>,
  db: Db = dbPublic(),
): Promise<T> {
  if (!UUID.test(municipalityId))
    throw new Error(`asPublic: id de municipio inválido "${municipalityId}"`)
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.municipality_id', ${municipalityId}, true)`)
    return await fn(tx)
  })
}

/** Scripts con el rol de migraciones (seed, importaciones). Registra en bitácora con el actor indicado. */
export function asSystem<T>(
  actor: string,
  fn: (tx: Tx) => PromiseLike<T>,
  origin: UserContext['origin'] = 'migration',
) {
  return withUser(
    { userId: actor, role: 'superadmin', allowedMunicipalities: [], origin },
    fn,
    dbMigrator(),
  )
}

/**
 * Lecturas del sitio público a partir del slug del municipio (la app solo conoce MUNICIPALITY_SLUG).
 * Resuelve el id con la política `publico_select_slug` y luego fija `app.municipio_id`.
 */
export function asPublicBySlug<T>(
  slug: string,
  fn: (tx: Tx, municipalityId: string) => PromiseLike<T>,
  db: Db = dbPublic(),
): Promise<T | null> {
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) throw new Error(`asPublicBySlug: slug inválido "${slug}"`)
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.municipality_slug', ${slug}, true)`)
    // la política `publico_select_slug` deja ver solo el municipio de ese slug
    const m = await tx.query.municipalities.findFirst({
      where: eq(municipalities.slug, slug),
      columns: { id: true },
    })
    const id = m?.id
    if (!id) return null
    await tx.execute(sql`SELECT set_config('app.municipality_id', ${id}, true)`)
    return await fn(tx, id)
  })
}
