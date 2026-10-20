import 'server-only'
import { crearAuth } from '@plataforma/auth'
import { nextCookies } from 'better-auth/next-js'
import { enviarCorreo } from './correo'
import { env } from './env'

export const auth = crearAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  nombrePlataforma: env.NEXT_PUBLIC_PLATFORM_NAME,
  enviarCorreo,
  plugins: [nextCookies()], // debe ir al final: fija cookies desde Server Actions
})
