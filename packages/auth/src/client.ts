'use client'
import { adminClient, organizationClient, twoFactorClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { ac, acGlobal, roles, globalRoles } from './roles'

/** Cliente de Better Auth para componentes del panel. */
export function createPlatformAuthClient(baseURL?: string) {
  return createAuthClient({
    ...(baseURL ? { baseURL } : {}),
    plugins: [
      adminClient({ ac: acGlobal, roles: globalRoles }),
      organizationClient({ ac, roles }),
      twoFactorClient({ onTwoFactorRedirect: () => window.location.assign('/verificar') }),
    ],
  })
}
