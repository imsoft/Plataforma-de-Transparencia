import 'server-only'
import { createAuth } from '@platform/auth'
import { nextCookies } from 'better-auth/next-js'
import { sendEmail } from './email'
import { env } from './env'

export const auth = createAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  platformName: env.NEXT_PUBLIC_PLATFORM_NAME,
  sendEmail,
  plugins: [nextCookies()], // debe ir al final: fija cookies desde Server Actions
})
