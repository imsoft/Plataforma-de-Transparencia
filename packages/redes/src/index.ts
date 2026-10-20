/** Catálogo único de redes sociales (sección 5.7). Agregar una red = una línea aquí. */
export type RedSocial = {
  slug: string
  nombre: string
  /** Dominios que identifican la red al pegar un enlace. */
  dominios: string[]
  /** Nombre del ícono en el set compartido (simple-icons / lucide). */
  icono: string
}

export const REDES: readonly RedSocial[] = [
  {
    slug: 'facebook',
    nombre: 'Facebook',
    dominios: ['facebook.com', 'fb.com', 'fb.me', 'fb.watch'],
    icono: 'facebook',
  },
  { slug: 'instagram', nombre: 'Instagram', dominios: ['instagram.com'], icono: 'instagram' },
  { slug: 'x', nombre: 'X', dominios: ['x.com', 'twitter.com'], icono: 'x' },
  { slug: 'tiktok', nombre: 'TikTok', dominios: ['tiktok.com'], icono: 'tiktok' },
  { slug: 'youtube', nombre: 'YouTube', dominios: ['youtube.com', 'youtu.be'], icono: 'youtube' },
  { slug: 'whatsapp', nombre: 'WhatsApp', dominios: ['wa.me', 'whatsapp.com'], icono: 'whatsapp' },
  {
    slug: 'threads',
    nombre: 'Threads',
    dominios: ['threads.net', 'threads.com'],
    icono: 'threads',
  },
  {
    slug: 'telegram',
    nombre: 'Telegram',
    dominios: ['t.me', 'telegram.me', 'telegram.org'],
    icono: 'telegram',
  },
  { slug: 'linkedin', nombre: 'LinkedIn', dominios: ['linkedin.com'], icono: 'linkedin' },
  { slug: 'spotify', nombre: 'Spotify', dominios: ['spotify.com'], icono: 'spotify' },
  { slug: 'sitio', nombre: 'Sitio web', dominios: [], icono: 'globe' },
  { slug: 'otra', nombre: 'Otra', dominios: [], icono: 'link' },
] as const

export function redPorSlug(slug: string): RedSocial {
  return REDES.find((r) => r.slug === slug) ?? REDES[REDES.length - 1]!
}

/** Detecta la red a partir del dominio del enlace. null si no coincide con ninguna del catálogo. */
export function detectarRed(url: string): RedSocial | null {
  let host: string
  try {
    host = new URL(url).hostname
      .toLowerCase()
      .replace(/^www\./, '')
      .replace(/^m\./, '')
  } catch {
    return null
  }
  return REDES.find((r) => r.dominios.some((d) => host === d || host.endsWith(`.${d}`))) ?? null
}

/** Enlace de WhatsApp a partir de un número de 10 dígitos (México) y un mensaje opcional. */
export function enlaceWhatsApp(numero: string, mensaje?: string): string | null {
  const digitos = numero.replace(/\D/g, '')
  const nacional = digitos.length === 12 && digitos.startsWith('52') ? digitos.slice(2) : digitos
  if (nacional.length !== 10) return null
  const base = `https://wa.me/52${nacional}`
  return mensaje?.trim() ? `${base}?text=${encodeURIComponent(mensaje.trim())}` : base
}

export type ValidacionEnlace =
  { ok: true; red: RedSocial; aviso: string | null } | { ok: false; error: string }

/** Validación amable: https obligatorio; si el dominio no corresponde a la red elegida, avisa sin bloquear. */
export function validarEnlace(url: string, redElegida: string): ValidacionEnlace {
  let u: URL
  try {
    u = new URL(url.trim())
  } catch {
    return {
      ok: false,
      error: 'Ese enlace no es válido. Copia la dirección completa desde el navegador.',
    }
  }
  if (u.protocol !== 'https:') return { ok: false, error: 'El enlace debe empezar con https://' }
  const elegida = redPorSlug(redElegida)
  const detectada = detectarRed(url)
  if (elegida.dominios.length > 0 && detectada?.slug !== elegida.slug) {
    return {
      ok: true,
      red: elegida,
      aviso: `Este enlace no parece de ${elegida.nombre}, ¿es correcto?`,
    }
  }
  return { ok: true, red: elegida, aviso: null }
}

/** aria-label accesible: "Facebook del H. Ayuntamiento de Tuxcacuesco" o el texto propio. */
export function etiquetaAccesible(
  red: RedSocial,
  texto: string | null,
  nombreSujeto: string,
): string {
  return texto?.trim() || `${red.nombre} de ${nombreSujeto}`
}
