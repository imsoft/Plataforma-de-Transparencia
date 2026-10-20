import { buildCsp, newNonce } from '@platform/config/csp'
import { getSessionCookie } from 'better-auth/cookies'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED = ['/municipios', '/m/', '/admin', '/supervisor', '/cuenta']

/** CSP con nonce en toda petición y redirección rápida por cookie en rutas protegidas (la sesión real se valida en cada página y acción). */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (
    PROTECTED.some((p) => path === p.replace(/\/$/, '') || path.startsWith(p)) &&
    !getSessionCookie(request, { cookiePrefix: 'pt' })
  ) {
    const target = new URL('/iniciar-sesion', request.url)
    target.searchParams.set('returnTo', path)
    return NextResponse.redirect(target)
  }
  const nonce = newNonce()
  const files = [process.env.FILES_PUBLIC_URL, process.env.S3_ENDPOINT]
    .filter((x): x is string => Boolean(x))
    .map((u) => new URL(u).origin)
  const csp = buildCsp({ nonce, files, dev: process.env.NODE_ENV !== 'production' })
  const headers = new Headers(request.headers)
  headers.set('x-nonce', nonce)
  headers.set('content-security-policy', csp)
  const response = NextResponse.next({ request: { headers } })
  response.headers.set('content-security-policy', csp)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
