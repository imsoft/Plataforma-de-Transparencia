import { createAccessControl } from 'better-auth/plugins/access'
import { adminAc, defaultStatements, memberAc } from 'better-auth/plugins/organization/access'

/**
 * Recursos y acciones dentro de un municipio (organización de Better Auth).
 * El superadmin es un rol GLOBAL (plugin admin, `user.role = 'superadmin'`), no de organización.
 */
export const statement = {
  ...defaultStatements,
  document: ['view', 'upload', 'rename', 'reorder', 'replace', 'hide', 'delete', 'restore'],
  notice: ['view', 'mark', 'unmark'],
  user: ['view', 'invite', 'change_role', 'remove', 'assign_scope'],
  socialNetworks: ['view', 'edit'],
  identity: ['view', 'edit'],
  auditLog: ['view'],
  exportJob: ['view', 'request'],
  dashboard: ['view'],
} as const

export const ac = createAccessControl(statement)

const allDocumentActions = {
  document: [...statement.document],
  notice: [...statement.notice],
} as const

export const uploader = ac.newRole({
  ...allDocumentActions,
  auditLog: ['view'],
  ...memberAc.statements,
})

export const supervisor = ac.newRole({
  ...allDocumentActions,
  auditLog: ['view'],
  exportJob: ['view'],
  dashboard: ['view'],
  user: ['view'],
  socialNetworks: ['view'],
  identity: ['view'],
  ...memberAc.statements,
})

export const municipal_admin = ac.newRole({
  ...allDocumentActions,
  user: [...statement.user],
  socialNetworks: ['view', 'edit'],
  identity: ['view'],
  auditLog: ['view'],
  exportJob: ['view', 'request'],
  ...adminAc.statements,
})

export const roles = { uploader, supervisor, municipal_admin } as const
export type MunicipalityRole = keyof typeof roles
export const MUNICIPALITY_ROLES = Object.keys(roles) as MunicipalityRole[]
/** Roles que deben tener verificación en dos pasos activa. */
export const ROLES_REQUIRING_2FA: ReadonlyArray<MunicipalityRole | 'superadmin'> = [
  'superadmin',
  'supervisor',
  'municipal_admin',
]

// ─── Roles globales (plugin admin) ─────────────────────────────────────────────
import { createAccessControl as crearAcGlobal } from 'better-auth/plugins/access'
import {
  adminAc as adminGlobalAc,
  defaultStatements as statementsGlobal,
} from 'better-auth/plugins/admin/access'

export const statementGlobal = {
  ...statementsGlobal,
  platform: ['manage'], // alta de municipios, versiones del índice, supervisores
} as const

export const acGlobal = crearAcGlobal(statementGlobal)

export const user = acGlobal.newRole({})
export const superadmin = acGlobal.newRole({
  platform: ['manage'],
  ...adminGlobalAc.statements,
})

export const globalRoles = { user, superadmin } as const
