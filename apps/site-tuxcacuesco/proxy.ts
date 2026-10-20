import { buildCsp, newNonce } from '@platform/config/csp'
import { NextResponse, type NextRequest } from 'next/server'

/** CSP con nonce por petición y la ruta pedida para la página 404 (sugerencias de clave). */
export function proxy(request: NextRequest) {
  const nonce = newNonce()
  const files = [process.env.FILES_PUBLIC_URL]
    .filter((x): x is string => Boolean(x))
    .map((u) => new URL(u).origin)
  const csp = buildCsp({
    nonce,
    files,
    externalVideos: true,
    dev: process.env.NODE_ENV !== 'production',
  })
  const headers = new Headers(request.headers)
  headers.set('x-ruta', request.nextUrl.pathname)
  headers.set('x-nonce', nonce)
  headers.set('content-security-policy', csp)
  const response = NextResponse.next({ request: { headers } })
  response.headers.set('content-security-policy', csp)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|og/).*)'],
}
