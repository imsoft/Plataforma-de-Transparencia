import 'server-only'
import type { Membership, Session } from '@platform/auth'
import { userMemberships, type MembershipWithMunicipality } from '@platform/db/queries/session'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { auth } from './auth'

export type PanelSession = Session & {
  name: string
  email: string
  twoFactorEnabled: boolean
  municipalities: MembershipWithMunicipality[]
}

/** Sesión actual con sus membresías. Cacheada por petición. null si no hay sesión. */
export const getSession = cache(async (): Promise<PanelSession | null> => {
  const s = await auth.api.getSession({ headers: await headers() })
  if (!s) return null
  const isSuperadmin = (s.user.role ?? '').split(',').includes('superadmin')
  const municipalities = await userMemberships(s.user.id)
  const memberships: Membership[] = municipalities.map((m) => ({
    municipalityId: m.municipalityId,
    organizationId: m.organizationId,
    role: m.role as Membership['role'],
    scopes: m.scopes,
  }))
  return {
    userId: s.user.id,
    isSuperadmin,
    memberships,
    name: s.user.name,
    email: s.user.email,
    twoFactorEnabled: Boolean(s.user.twoFactorEnabled),
    municipalities,
  }
})

/** Redirige al inicio de sesión si no hay sesión. */
export async function requireSession(): Promise<PanelSession> {
  const s = await getSession()
  if (!s) redirect('/iniciar-sesion')
  return s
}
