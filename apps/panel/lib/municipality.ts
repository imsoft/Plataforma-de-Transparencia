import 'server-only'
import { dbContext, can, ROLES_REQUIRING_2FA, type Action, type Target } from '@platform/auth'
import { withUser, type UserContext } from '@platform/db'
import { municipalityBySlug, type FullMunicipality } from '@platform/db/queries/municipality'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import { requireSession, type PanelSession } from './session'

export type MunicipalityContext = {
  session: PanelSession
  municipality: FullMunicipality
  ctx: UserContext
  /** Rol efectivo en este municipio. */
  role: string
  can: (action: Action, target?: Omit<Target, 'municipalityId'>) => boolean
}

/** Carga sesión + municipio para las páginas bajo /m/[slug]. 404 si el usuario no pertenece. */
export const municipalityContext = cache(async (slug: string): Promise<MunicipalityContext> => {
  const session = await requireSession()
  const membership = session.municipalities.find((m) => m.municipality.slug === slug)
  if (!membership && !session.isSuperadmin) notFound()
  requireTwoFactor(session, `/m/${slug}`)
  const baseCtx = dbContext(session, membership?.municipalityId)
  const municipality = await withUser(baseCtx, (tx) => municipalityBySlug(tx, slug))
  if (!municipality) notFound()
  const ctx = dbContext(session, municipality.id)
  return {
    session,
    municipality,
    ctx,
    role: session.isSuperadmin ? 'superadmin' : (membership?.role ?? 'uploader'),
    can: (action, target) => can(session, action, { municipalityId: municipality.id, ...target }),
  }
})

/** 2FA obligatoria para superadmin, supervisor y admin municipal (sección 9.1). */
export function requireTwoFactor(session: PanelSession, returnTo: string): void {
  if (session.twoFactorEnabled) return
  const requires =
    session.isSuperadmin ||
    session.memberships.some((m) => (ROLES_REQUIRING_2FA as readonly string[]).includes(m.role))
  if (requires) redirect(`/cuenta/dos-pasos?returnTo=${encodeURIComponent(returnTo)}`)
}
