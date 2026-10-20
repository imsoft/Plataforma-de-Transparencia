import 'server-only'
import type { Membresia, Sesion } from '@plataforma/auth'
import { membresiasDeUsuario, type MembresiaConMunicipio } from '@plataforma/db/consultas/sesion'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { auth } from './auth'

export type SesionPanel = Sesion & {
  nombre: string
  email: string
  twoFactorEnabled: boolean
  municipios: MembresiaConMunicipio[]
}

/** Sesión actual con sus membresías. Cacheada por petición. null si no hay sesión. */
export const obtenerSesion = cache(async (): Promise<SesionPanel | null> => {
  const s = await auth.api.getSession({ headers: await headers() })
  if (!s) return null
  const esSuperadmin = (s.user.role ?? '').split(',').includes('superadmin')
  const municipios = await membresiasDeUsuario(s.user.id)
  const membresias: Membresia[] = municipios.map((m) => ({
    municipioId: m.municipioId,
    organizationId: m.organizationId,
    rol: m.rol as Membresia['rol'],
    alcances: m.alcances,
  }))
  return {
    usuarioId: s.user.id,
    esSuperadmin,
    membresias,
    nombre: s.user.name,
    email: s.user.email,
    twoFactorEnabled: Boolean(s.user.twoFactorEnabled),
    municipios,
  }
})

/** Redirige al inicio de sesión si no hay sesión. */
export async function exigirSesion(): Promise<SesionPanel> {
  const s = await obtenerSesion()
  if (!s) redirect('/iniciar-sesion')
  return s
}
