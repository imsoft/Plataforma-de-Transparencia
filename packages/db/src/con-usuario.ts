import { eq, sql } from 'drizzle-orm'
import { dbMigraciones, dbPanel, dbPublico, type Db, type Tx } from './cliente'
import { municipios } from './schema/municipios'

export type { Tx }

export const ROLES = ['superadmin', 'supervisor', 'admin_municipal', 'capturista'] as const
export type Rol = (typeof ROLES)[number]

export type ContextoUsuario = {
  usuarioId: string
  rol: Rol
  /** Municipios donde el usuario tiene membresía. Vacío para superadmin (ve todo por rol). */
  municipiosPermitidos: string[]
  origen?: 'panel' | 'migracion' | 'generador' | 'cron'
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Única puerta de escritura del panel. Abre una transacción y fija las variables de sesión que leen
 * los triggers de bitácora y las políticas RLS. Sin ellas, Postgres rechaza cualquier escritura.
 */
export function conUsuario<T>(
  ctx: ContextoUsuario,
  fn: (tx: Tx) => PromiseLike<T>,
  db: Db = dbPanel(),
): Promise<T> {
  if (!ctx.usuarioId) throw new Error('conUsuario: falta usuarioId')
  if (!ROLES.includes(ctx.rol)) throw new Error(`conUsuario: rol inválido "${ctx.rol}"`)
  for (const m of ctx.municipiosPermitidos) {
    if (!UUID.test(m)) throw new Error(`conUsuario: id de municipio inválido "${m}"`)
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT set_config('app.usuario_id', ${ctx.usuarioId}, true),
             set_config('app.rol', ${ctx.rol}, true),
             set_config('app.municipios_permitidos', ${ctx.municipiosPermitidos.join(',')}, true),
             set_config('app.origen', ${ctx.origen ?? 'panel'}, true)
    `)
    return await fn(tx)
  })
}

/** Lecturas del sitio público: solo ve lo publicado del municipio indicado. */
export function comoPublico<T>(
  municipioId: string,
  fn: (tx: Tx) => PromiseLike<T>,
  db: Db = dbPublico(),
): Promise<T> {
  if (!UUID.test(municipioId))
    throw new Error(`comoPublico: id de municipio inválido "${municipioId}"`)
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.municipio_id', ${municipioId}, true)`)
    return await fn(tx)
  })
}

/** Scripts con el rol de migraciones (seed, importaciones). Registra en bitácora con el actor indicado. */
export function comoSistema<T>(
  actor: string,
  fn: (tx: Tx) => PromiseLike<T>,
  origen: ContextoUsuario['origen'] = 'migracion',
) {
  return conUsuario(
    { usuarioId: actor, rol: 'superadmin', municipiosPermitidos: [], origen },
    fn,
    dbMigraciones(),
  )
}

/**
 * Lecturas del sitio público a partir del slug del municipio (la app solo conoce MUNICIPIO_SLUG).
 * Resuelve el id con la política `publico_select_slug` y luego fija `app.municipio_id`.
 */
export function comoPublicoPorSlug<T>(
  slug: string,
  fn: (tx: Tx, municipioId: string) => PromiseLike<T>,
  db: Db = dbPublico(),
): Promise<T | null> {
  if (!/^[a-z0-9-]{2,60}$/.test(slug))
    throw new Error(`comoPublicoPorSlug: slug inválido "${slug}"`)
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.municipio_slug', ${slug}, true)`)
    // la política `publico_select_slug` deja ver solo el municipio de ese slug
    const m = await tx.query.municipios.findFirst({
      where: eq(municipios.slug, slug),
      columns: { id: true },
    })
    const id = m?.id
    if (!id) return null
    await tx.execute(sql`SELECT set_config('app.municipio_id', ${id}, true)`)
    return await fn(tx, id)
  })
}
