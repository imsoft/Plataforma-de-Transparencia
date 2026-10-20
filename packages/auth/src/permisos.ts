/**
 * Capa central de autorización del panel. Denegar por defecto.
 * Toda Server Action llama a `exigir()` antes de abrir `conUsuario()`.
 * RLS en Postgres es la segunda red; esta es la primera y la más fina (alcances).
 */
import type { ContextoUsuario } from '@plataforma/db'
import { roles, type RolMunicipio, type statement } from './roles'

type Statement = typeof statement
export type Recurso = keyof Statement
export type Accion = { [R in Recurso]: `${R}:${Statement[R][number]}` }[Recurso]

export type Alcance = { sujetoObligadoId: string | null; nodoId: string | null }

export type Membresia = {
  municipioId: string
  organizationId: string
  rol: RolMunicipio
  /** Vacío = sin restricción dentro del municipio. */
  alcances: Alcance[]
}

export type Sesion = {
  usuarioId: string
  esSuperadmin: boolean
  membresias: Membresia[]
}

export type Objetivo = {
  municipioId: string
  sujetoObligadoId?: string
  /** Ids del nodo y sus ancestros (raíz → nodo). Sirve para alcances por fracción. */
  nodoRuta?: string[]
}

export class ErrorPermiso extends Error {
  constructor(
    public readonly accion: Accion,
    public readonly objetivo: Objetivo,
  ) {
    super(`No tienes permiso para ${accion.replace(':', ' › ')}`)
    this.name = 'ErrorPermiso'
  }
}

const ACCIONES_CON_ALCANCE: ReadonlySet<Recurso> = new Set(['documento', 'leyenda'])

export function membresiaDe(sesion: Sesion, municipioId: string): Membresia | undefined {
  return sesion.membresias.find((m) => m.municipioId === municipioId)
}

/** ¿El rol tiene la acción? (una sola fuente: los roles de Better Auth) */
export function rolPermite(rol: RolMunicipio, accion: Accion): boolean {
  const [recurso, verbo] = accion.split(':') as [Recurso, string]
  const r = roles[rol]
  if (!r) return false
  return r.authorize({ [recurso]: [verbo] }).success
}

function alcanceCubre(alcances: Alcance[], objetivo: Objetivo): boolean {
  if (alcances.length === 0) return true
  return alcances.some((a) => {
    const soOk = a.sujetoObligadoId === null || a.sujetoObligadoId === objetivo.sujetoObligadoId
    const nodoOk = a.nodoId === null || (objetivo.nodoRuta?.includes(a.nodoId) ?? false)
    return soOk && nodoOk
  })
}

export function puede(sesion: Sesion, accion: Accion, objetivo: Objetivo): boolean {
  if (sesion.esSuperadmin) return true
  const m = membresiaDe(sesion, objetivo.municipioId)
  if (!m) return false
  if (!rolPermite(m.rol, accion)) return false
  const recurso = accion.split(':')[0] as Recurso
  if (ACCIONES_CON_ALCANCE.has(recurso) && !alcanceCubre(m.alcances, objetivo)) return false
  return true
}

export function exigir(sesion: Sesion, accion: Accion, objetivo: Objetivo): void {
  if (!puede(sesion, accion, objetivo)) throw new ErrorPermiso(accion, objetivo)
}

/** Acciones globales de plataforma (alta de municipios, índice, supervisores). */
export function exigirSuperadmin(sesion: Sesion): void {
  if (!sesion.esSuperadmin) throw new ErrorPermiso('tablero:ver', { municipioId: '*' })
}

/** Contexto para `conUsuario()` a partir de la sesión y el municipio activo. */
export function contextoDb(sesion: Sesion, municipioActivoId?: string): ContextoUsuario {
  const rol = sesion.esSuperadmin
    ? 'superadmin'
    : (municipioActivoId && membresiaDe(sesion, municipioActivoId)?.rol) || 'capturista'
  return {
    usuarioId: sesion.usuarioId,
    rol,
    municipiosPermitidos: sesion.membresias.map((m) => m.municipioId),
    origen: 'panel',
  }
}
