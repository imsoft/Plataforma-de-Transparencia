import { construirCsp, nuevoNonce } from '@plataforma/config/csp'
import { NextResponse, type NextRequest } from 'next/server'

/** CSP con nonce por petición y la ruta pedida para la página 404 (sugerencias de clave). */
export function proxy(request: NextRequest) {
  const nonce = nuevoNonce()
  const archivos = [process.env.ARCHIVOS_URL_PUBLICA]
    .filter((x): x is string => Boolean(x))
    .map((u) => new URL(u).origin)
  const csp = construirCsp({
    nonce,
    archivos,
    videosExternos: true,
    dev: process.env.NODE_ENV !== 'production',
  })
  const headers = new Headers(request.headers)
  headers.set('x-ruta', request.nextUrl.pathname)
  headers.set('x-nonce', nonce)
  headers.set('content-security-policy', csp)
  const respuesta = NextResponse.next({ request: { headers } })
  respuesta.headers.set('content-security-policy', csp)
  return respuesta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|og/).*)'],
}
