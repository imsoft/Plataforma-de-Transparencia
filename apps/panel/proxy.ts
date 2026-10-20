import { construirCsp, nuevoNonce } from '@plataforma/config/csp'
import { getSessionCookie } from 'better-auth/cookies'
import { NextResponse, type NextRequest } from 'next/server'

const PROTEGIDAS = ['/municipios', '/m/', '/admin', '/supervisor', '/cuenta']

/** CSP con nonce en toda petición y redirección rápida por cookie en rutas protegidas (la sesión real se valida en cada página y acción). */
export function proxy(request: NextRequest) {
  const ruta = request.nextUrl.pathname
  if (
    PROTEGIDAS.some((p) => ruta === p.replace(/\/$/, '') || ruta.startsWith(p)) &&
    !getSessionCookie(request, { cookiePrefix: 'pt' })
  ) {
    const destino = new URL('/iniciar-sesion', request.url)
    destino.searchParams.set('volver', ruta)
    return NextResponse.redirect(destino)
  }
  const nonce = nuevoNonce()
  const archivos = [process.env.ARCHIVOS_URL_PUBLICA, process.env.S3_ENDPOINT]
    .filter((x): x is string => Boolean(x))
    .map((u) => new URL(u).origin)
  const csp = construirCsp({ nonce, archivos, dev: process.env.NODE_ENV !== 'production' })
  const headers = new Headers(request.headers)
  headers.set('x-nonce', nonce)
  headers.set('content-security-policy', csp)
  const respuesta = NextResponse.next({ request: { headers } })
  respuesta.headers.set('content-security-policy', csp)
  return respuesta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
