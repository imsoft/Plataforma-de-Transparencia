import 'server-only'
import {
  contextoDb,
  puede,
  ROLES_CON_2FA_OBLIGATORIA,
  type Accion,
  type Objetivo,
} from '@plataforma/auth'
import { conUsuario, type ContextoUsuario } from '@plataforma/db'
import { municipioPorSlug, type MunicipioCompleto } from '@plataforma/db/consultas/municipio'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import { exigirSesion, type SesionPanel } from './sesion'

export type ContextoMunicipio = {
  sesion: SesionPanel
  municipio: MunicipioCompleto
  ctx: ContextoUsuario
  /** Rol efectivo en este municipio. */
  rol: string
  puede: (accion: Accion, objetivo?: Omit<Objetivo, 'municipioId'>) => boolean
}

/** Carga sesión + municipio para las páginas bajo /m/[slug]. 404 si el usuario no pertenece. */
export const contextoMunicipio = cache(async (slug: string): Promise<ContextoMunicipio> => {
  const sesion = await exigirSesion()
  const membresia = sesion.municipios.find((m) => m.municipio.slug === slug)
  if (!membresia && !sesion.esSuperadmin) notFound()
  exigirDosPasos(sesion, `/m/${slug}`)
  const ctxBase = contextoDb(sesion, membresia?.municipioId)
  const municipio = await conUsuario(ctxBase, (tx) => municipioPorSlug(tx, slug))
  if (!municipio) notFound()
  const ctx = contextoDb(sesion, municipio.id)
  return {
    sesion,
    municipio,
    ctx,
    rol: sesion.esSuperadmin ? 'superadmin' : (membresia?.rol ?? 'capturista'),
    puede: (accion, objetivo) => puede(sesion, accion, { municipioId: municipio.id, ...objetivo }),
  }
})

/** 2FA obligatoria para superadmin, supervisor y admin municipal (sección 9.1). */
export function exigirDosPasos(sesion: SesionPanel, volver: string): void {
  if (sesion.twoFactorEnabled) return
  const requiere =
    sesion.esSuperadmin ||
    sesion.membresias.some((m) => (ROLES_CON_2FA_OBLIGATORIA as readonly string[]).includes(m.rol))
  if (requiere) redirect(`/cuenta/dos-pasos?volver=${encodeURIComponent(volver)}`)
}
