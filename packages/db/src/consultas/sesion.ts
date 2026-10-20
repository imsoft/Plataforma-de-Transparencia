/** Lecturas de sesión/membresías. No llevan RLS (tablas de auth), por eso pueden usar el cliente del panel directo. */
import { eq, sql } from 'drizzle-orm'
import { dbPanel } from '../cliente'
import * as s from '../schema'

export type MembresiaConMunicipio = {
  memberId: string
  municipioId: string
  organizationId: string
  rol: string
  municipio: {
    id: string
    slug: string
    nombre: string
    nombreOficial: string
    estatus: 'activo' | 'panel_suspendido'
  }
  alcances: { sujetoObligadoId: string | null; nodoId: string | null }[]
}

export async function membresiasDeUsuario(usuarioId: string): Promise<MembresiaConMunicipio[]> {
  const filas = await dbPanel().transaction(async (tx) => {
    // la política `panel_select_miembro` deja leer los municipios donde el usuario es miembro
    await tx.execute(sql`SELECT set_config('app.usuario_id', ${usuarioId}, true)`)
    return tx
      .select({
        memberId: s.member.id,
        organizationId: s.member.organizationId,
        rol: s.member.role,
        municipioId: s.municipios.id,
        slug: s.municipios.slug,
        nombre: s.municipios.nombre,
        nombreOficial: s.municipios.nombreOficial,
        estatus: s.municipios.estatus,
      })
      .from(s.member)
      .innerJoin(s.municipios, eq(s.municipios.organizationId, s.member.organizationId))
      .where(eq(s.member.userId, usuarioId))
  })
  if (filas.length === 0) return []
  // alcances_miembro sí tiene RLS; se leen con el contexto del propio usuario más abajo (panel) — aquí solo los ids.
  return filas.map((f) => ({
    memberId: f.memberId,
    municipioId: f.municipioId,
    organizationId: f.organizationId,
    rol: f.rol,
    municipio: {
      id: f.municipioId,
      slug: f.slug,
      nombre: f.nombre,
      nombreOficial: f.nombreOficial,
      estatus: f.estatus,
    },
    alcances: [],
  }))
}

/** Municipios del superadmin (todos). */
export async function todosLosMunicipios() {
  return dbPanel().transaction(async (tx) => {
    // el superadmin lee con su rol; RLS lo deja pasar
    await tx.execute(
      sql`SELECT set_config('app.rol', 'superadmin', true), set_config('app.usuario_id', 'lectura', true)`,
    )
    return tx
      .select({
        id: s.municipios.id,
        slug: s.municipios.slug,
        nombre: s.municipios.nombre,
        nombreOficial: s.municipios.nombreOficial,
        estatus: s.municipios.estatus,
      })
      .from(s.municipios)
      .orderBy(s.municipios.nombre)
  })
}
