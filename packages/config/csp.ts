/**
 * Content-Security-Policy con nonce por petición (sección 9.2). La usan los proxy.ts del panel y de los sitios.
 * Next.js lee el nonce de la cabecera CSP de la petición y lo aplica a sus propios scripts.
 */
export type OpcionesCsp = {
  nonce: string
  /** Hosts extra permitidos para imágenes/medios (bucket público). */
  archivos: string[]
  /** Permitir iframes de video externos (solo sitios). */
  videosExternos?: boolean
  dev: boolean
}

export function construirCsp({
  nonce,
  archivos,
  videosExternos = false,
  dev,
}: OpcionesCsp): string {
  const extra = archivos.join(' ')
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Tailwind y el <style> del tema; sin ejecución
    `img-src 'self' data: blob: https: ${extra}`.trim(),
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src 'self' https: ${extra}${dev ? ' ws: wss:' : ''}`.trim(),
    `media-src 'self' blob: https: ${extra}`.trim(),
    videosExternos
      ? 'frame-src https://www.youtube-nocookie.com https://www.youtube.com https://www.facebook.com'
      : "frame-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ')
}

export function nuevoNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}
