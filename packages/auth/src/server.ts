import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { createClient } from '@platform/db/client'
import * as schema from '@platform/db/schema'
import { betterAuth, type BetterAuthPlugin } from 'better-auth'
import { admin, haveIBeenPwned, organization, twoFactor } from 'better-auth/plugins'
import { ac, acGlobal, roles, globalRoles } from './roles'

export type AuthOptions = {
  baseURL?: string
  secret?: string
  platformName?: string
  sendEmail?: (email: {
    to: string
    emailSubject: string
    html: string
    text: string
  }) => Promise<void>
  /** Plugins adicionales del framework (ej. nextCookies). Van al final. */
  plugins?: BetterAuthPlugin[]
}

/** Instancia de Better Auth del panel. Se crea una vez en apps/panel. */
export function createAuth(options: AuthOptions = {}) {
  const name =
    options.platformName ?? process.env.NEXT_PUBLIC_PLATFORM_NAME ?? 'Plataforma de Transparencia'
  const send = options.sendEmail ?? (async () => {})
  const db = createClient({
    url: process.env.DATABASE_URL ?? 'postgres://app_panel:app_panel@localhost:5432/transparencia',
    driver: process.env.DATABASE_DRIVER === 'neon' ? 'neon' : 'postgres',
  })

  return betterAuth({
    appName: name,
    baseURL: options.baseURL ?? process.env.BETTER_AUTH_URL,
    secret: options.secret ?? process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: false, // los usuarios entran por invitación; el correo ya se verificó al aceptar
      sendResetPassword: async ({ user, url }) => {
        await send({
          to: user.email,
          emailSubject: `Restablece tu contraseña · ${name}`,
          html: `<p>Hola ${user.name},</p><p>Para restablecer tu contraseña entra a: <a href="${url}">${url}</a></p><p>Si no lo pediste, ignora este correo.</p>`,
          text: `Hola ${user.name}. Para restablecer tu contraseña entra a: ${url}`,
        })
      },
    },
    user: {
      additionalFields: {
        jobTitle: { type: 'string', required: false, input: true },
        phone: { type: 'string', required: false, input: true },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 días
      updateAge: 60 * 60 * 24, // se renueva a diario
      // sin caché de sesión en cookie: la baja de un usuario revoca su acceso al instante (sección 7.2)
      cookieCache: { enabled: false },
    },
    rateLimit: {
      // solo en producción: en local y en las pruebas E2E se inicia sesión muchas veces seguidas
      enabled: process.env.NODE_ENV === 'production',
      window: 60,
      max: 60,
      customRules: {
        '/sign-in/email': { window: 15 * 60, max: 5 },
        '/request-password-reset': { window: 60 * 60, max: 3 },
        '/two-factor/verify-totp': { window: 15 * 60, max: 5 },
      },
    },
    advanced: {
      cookiePrefix: 'pt',
      useSecureCookies: process.env.NODE_ENV === 'production',
    },
    plugins: [
      admin({
        ac: acGlobal,
        roles: globalRoles,
        defaultRole: 'user',
        adminRoles: ['superadmin'],
        impersonationSessionDuration: 60 * 60, // 1 h para soporte
      }),
      organization({
        ac,
        roles,
        creatorRole: 'municipal_admin',
        allowUserToCreateOrganization: false, // solo el superadmin da de alta municipios
        invitationExpiresIn: 60 * 60 * 72,
        requireEmailVerificationOnInvitation: false,
        sendInvitationEmail: async ({ email, organization: org, inviter, id }) => {
          const base = options.baseURL ?? process.env.BETTER_AUTH_URL ?? ''
          const url = `${base}/invitacion/${id}`
          await send({
            to: email,
            emailSubject: `Te invitaron a ${org.name} · ${name}`,
            html: `<p>${inviter.user.name} te invitó a administrar la transparencia de <strong>${org.name}</strong>.</p><p><a href="${url}">Aceptar invitación</a></p><p>El enlace vence en 72 horas.</p>`,
            text: `${inviter.user.name} te invitó a ${org.name}. Acepta aquí: ${url}`,
          })
        },
      }),
      twoFactor({ issuer: name }),
      haveIBeenPwned({
        customPasswordCompromisedMessage: 'Esa contraseña apareció en una filtración. Elige otra.',
      }),
      ...(options.plugins ?? []),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
