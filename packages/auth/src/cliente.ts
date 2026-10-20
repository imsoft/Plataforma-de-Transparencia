'use client'
import { adminClient, organizationClient, twoFactorClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { ac, acGlobal, roles, rolesGlobales } from './roles'

/** Cliente de Better Auth para componentes del panel. */
export function crearAuthCliente(baseURL?: string) {
  return createAuthClient({
    ...(baseURL ? { baseURL } : {}),
    plugins: [
      adminClient({ ac: acGlobal, roles: rolesGlobales }),
      organizationClient({ ac, roles }),
      twoFactorClient({ onTwoFactorRedirect: () => window.location.assign('/verificar') }),
    ],
  })
}
