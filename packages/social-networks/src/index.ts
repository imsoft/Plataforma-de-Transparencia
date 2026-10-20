/** Catálogo único de redes sociales (sección 5.7). Agregar una red = una línea aquí. */
export type SocialNetwork = {
  slug: string
  name: string
  /** Dominios que identifican la red al pegar un enlace. */
  domains: string[]
  /** Nombre del ícono en el set compartido (simple-icons / lucide). */
  icon: string
}

export const NETWORKS: readonly SocialNetwork[] = [
  {
    slug: 'facebook',
    name: 'Facebook',
    domains: ['facebook.com', 'fb.com', 'fb.me', 'fb.watch'],
    icon: 'facebook',
  },
  { slug: 'instagram', name: 'Instagram', domains: ['instagram.com'], icon: 'instagram' },
  { slug: 'x', name: 'X', domains: ['x.com', 'twitter.com'], icon: 'x' },
  { slug: 'tiktok', name: 'TikTok', domains: ['tiktok.com'], icon: 'tiktok' },
  { slug: 'youtube', name: 'YouTube', domains: ['youtube.com', 'youtu.be'], icon: 'youtube' },
  { slug: 'whatsapp', name: 'WhatsApp', domains: ['wa.me', 'whatsapp.com'], icon: 'whatsapp' },
  {
    slug: 'threads',
    name: 'Threads',
    domains: ['threads.net', 'threads.com'],
    icon: 'threads',
  },
  {
    slug: 'telegram',
    name: 'Telegram',
    domains: ['t.me', 'telegram.me', 'telegram.org'],
    icon: 'telegram',
  },
  { slug: 'linkedin', name: 'LinkedIn', domains: ['linkedin.com'], icon: 'linkedin' },
  { slug: 'spotify', name: 'Spotify', domains: ['spotify.com'], icon: 'spotify' },
  { slug: 'sitio', name: 'Sitio web', domains: [], icon: 'globe' },
  { slug: 'otra', name: 'Otra', domains: [], icon: 'link' },
] as const

export function networkBySlug(slug: string): SocialNetwork {
  return NETWORKS.find((r) => r.slug === slug) ?? NETWORKS[NETWORKS.length - 1]!
}

/** Detecta la red a partir del dominio del enlace. null si no coincide con ninguna del catálogo. */
export function detectNetwork(url: string): SocialNetwork | null {
  let host: string
  try {
    host = new URL(url).hostname
      .toLowerCase()
      .replace(/^www\./, '')
      .replace(/^m\./, '')
  } catch {
    return null
  }
  return NETWORKS.find((r) => r.domains.some((d) => host === d || host.endsWith(`.${d}`))) ?? null
}

/** Enlace de WhatsApp a partir de un número de 10 dígitos (México) y un mensaje opcional. */
export function whatsappLink(number: string, message?: string): string | null {
  const digits = number.replace(/\D/g, '')
  const national = digits.length === 12 && digits.startsWith('52') ? digits.slice(2) : digits
  if (national.length !== 10) return null
  const base = `https://wa.me/52${national}`
  return message?.trim() ? `${base}?text=${encodeURIComponent(message.trim())}` : base
}

export type LinkValidation =
  { ok: true; network: SocialNetwork; warning: string | null } | { ok: false; error: string }

/** Validación amable: https obligatorio; si el dominio no corresponde a la red elegida, avisa sin bloquear. */
export function validateLink(url: string, chosenNetwork: string): LinkValidation {
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
  const chosen = networkBySlug(chosenNetwork)
  const detected = detectNetwork(url)
  if (chosen.domains.length > 0 && detected?.slug !== chosen.slug) {
    return {
      ok: true,
      network: chosen,
      warning: `Este enlace no parece de ${chosen.name}, ¿es correcto?`,
    }
  }
  return { ok: true, network: chosen, warning: null }
}

/** aria-label accesible: "Facebook del H. Ayuntamiento de Tuxcacuesco" o el texto propio. */
export function accessibleLabel(
  network: SocialNetwork,
  text: string | null,
  subjectName: string,
): string {
  return text?.trim() || `${network.name} de ${subjectName}`
}
