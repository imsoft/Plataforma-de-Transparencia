import { createAccessControl } from 'better-auth/plugins/access'
import { adminAc, defaultStatements, memberAc } from 'better-auth/plugins/organization/access'

/**
 * Recursos y acciones dentro de un municipio (organización de Better Auth).
 * El superadmin es un rol GLOBAL (plugin admin, `user.role = 'superadmin'`), no de organización.
 */
export const statement = {
  ...defaultStatements,
  documento: [
    'ver',
    'subir',
    'renombrar',
    'reordenar',
    'reemplazar',
    'ocultar',
    'eliminar',
    'restaurar',
  ],
  leyenda: ['ver', 'marcar', 'desmarcar'],
  usuario: ['ver', 'invitar', 'cambiar_rol', 'dar_de_baja', 'asignar_alcance'],
  redes_sociales: ['ver', 'editar'],
  identidad: ['ver', 'editar'],
  bitacora: ['ver'],
  exportacion: ['ver', 'solicitar'],
  tablero: ['ver'],
} as const

export const ac = createAccessControl(statement)

const todoDocumentos = {
  documento: [...statement.documento],
  leyenda: [...statement.leyenda],
} as const

export const capturista = ac.newRole({
  ...todoDocumentos,
  bitacora: ['ver'],
  ...memberAc.statements,
})

export const supervisor = ac.newRole({
  ...todoDocumentos,
  bitacora: ['ver'],
  exportacion: ['ver'],
  tablero: ['ver'],
  usuario: ['ver'],
  redes_sociales: ['ver'],
  identidad: ['ver'],
  ...memberAc.statements,
})

export const admin_municipal = ac.newRole({
  ...todoDocumentos,
  usuario: [...statement.usuario],
  redes_sociales: ['ver', 'editar'],
  identidad: ['ver'],
  bitacora: ['ver'],
  exportacion: ['ver', 'solicitar'],
  ...adminAc.statements,
})

export const roles = { capturista, supervisor, admin_municipal } as const
export type RolMunicipio = keyof typeof roles
export const ROLES_MUNICIPIO = Object.keys(roles) as RolMunicipio[]
/** Roles que deben tener verificación en dos pasos activa. */
export const ROLES_CON_2FA_OBLIGATORIA: ReadonlyArray<RolMunicipio | 'superadmin'> = [
  'superadmin',
  'supervisor',
  'admin_municipal',
]

// ─── Roles globales (plugin admin) ─────────────────────────────────────────────
import { createAccessControl as crearAcGlobal } from 'better-auth/plugins/access'
import {
  adminAc as adminGlobalAc,
  defaultStatements as statementsGlobal,
} from 'better-auth/plugins/admin/access'

export const statementGlobal = {
  ...statementsGlobal,
  plataforma: ['administrar'], // alta de municipios, versiones del índice, supervisores
} as const

export const acGlobal = crearAcGlobal(statementGlobal)

export const usuario = acGlobal.newRole({})
export const superadmin = acGlobal.newRole({
  plataforma: ['administrar'],
  ...adminGlobalAc.statements,
})

export const rolesGlobales = { usuario, superadmin } as const
