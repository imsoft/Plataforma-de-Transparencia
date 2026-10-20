/**
 * Capa central de autorización del panel. Denegar por defecto.
 * Toda Server Action llama a `require()` antes de abrir `withUser()`.
 * RLS en Postgres es la segunda red; esta es la primera y la más fina (alcances).
 */
import type { UserContext } from '@platform/db'
import { roles, type MunicipalityRole, type statement } from './roles'

type Statement = typeof statement
export type Resource = keyof Statement
export type Action = { [R in Resource]: `${R}:${Statement[R][number]}` }[Resource]

export type Scope = { obligatedSubjectId: string | null; nodeId: string | null }

export type Membership = {
  municipalityId: string
  organizationId: string
  role: MunicipalityRole
  /** Vacío = sin restricción dentro del municipio. */
  scopes: Scope[]
}

export type Session = {
  userId: string
  isSuperadmin: boolean
  memberships: Membership[]
}

export type Target = {
  municipalityId: string
  obligatedSubjectId?: string
  /** Ids del nodo y sus ancestros (raíz → nodo). Sirve para alcances por fracción. */
  nodePath?: string[]
}

export class PermissionError extends Error {
  constructor(
    public readonly action: Action,
    public readonly target: Target,
  ) {
    super(`No tienes permiso para ${action.replace(':', ' › ')}`)
    this.name = 'ErrorPermiso'
  }
}

const SCOPED_RESOURCES: ReadonlySet<Resource> = new Set(['document', 'notice'])

export function membershipOf(session: Session, municipalityId: string): Membership | undefined {
  return session.memberships.find((m) => m.municipalityId === municipalityId)
}

/** ¿El rol tiene la acción? (una sola fuente: los roles de Better Auth) */
export function roleAllows(role: MunicipalityRole, action: Action): boolean {
  const [resource, verb] = action.split(':') as [Resource, string]
  const r = roles[role]
  if (!r) return false
  return r.authorize({ [resource]: [verb] }).success
}

function scopeCovers(scopes: Scope[], target: Target): boolean {
  if (scopes.length === 0) return true
  return scopes.some((a) => {
    const subjectOk =
      a.obligatedSubjectId === null || a.obligatedSubjectId === target.obligatedSubjectId
    const nodeOk = a.nodeId === null || (target.nodePath?.includes(a.nodeId) ?? false)
    return subjectOk && nodeOk
  })
}

export function can(session: Session, action: Action, target: Target): boolean {
  if (session.isSuperadmin) return true
  const m = membershipOf(session, target.municipalityId)
  if (!m) return false
  if (!roleAllows(m.role, action)) return false
  const resource = action.split(':')[0] as Resource
  if (SCOPED_RESOURCES.has(resource) && !scopeCovers(m.scopes, target)) return false
  return true
}

export function require(session: Session, action: Action, target: Target): void {
  if (!can(session, action, target)) throw new PermissionError(action, target)
}

/** Acciones globales de plataforma (alta de municipios, índice, supervisores). */
export function requireSuperadmin(session: Session): void {
  if (!session.isSuperadmin) throw new PermissionError('dashboard:view', { municipalityId: '*' })
}

/** Contexto para `withUser()` a partir de la sesión y el municipio activo. */
export function dbContext(session: Session, activeMunicipalityId?: string): UserContext {
  const role = session.isSuperadmin
    ? 'superadmin'
    : (activeMunicipalityId && membershipOf(session, activeMunicipalityId)?.role) || 'uploader'
  return {
    userId: session.userId,
    role,
    allowedMunicipalities: session.memberships.map((m) => m.municipalityId),
    origin: 'panel',
  }
}
