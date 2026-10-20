/** Utilidades de color sin dependencias: hex ↔ RGB ↔ HSL, luminancia y contraste WCAG 2.x. */

export type RGB = { r: number; g: number; b: number } // 0–255
export type HSL = { h: number; s: number; l: number } // h 0–360, s/l 0–100

export const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

export function hexToRgb(hex: string): RGB {
  const m = HEX.exec(hex.trim())
  if (!m) throw new Error(`Color inválido: "${hex}"`)
  let h = m[1]!
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  const n = parseInt(h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const R = r / 255,
    G = g / 255,
    B = b / 255
  const max = Math.max(R, G, B),
    min = Math.min(R, G, B)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: l * 100 }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h =
    max === R
      ? ((G - B) / d + (G < B ? 6 : 0)) * 60
      : max === G
        ? ((B - R) / d + 2) * 60
        : ((R - G) / d + 4) * 60
  return { h, s: s * 100, l: l * 100 }
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const S = s / 100,
    L = l / 100
  const c = (1 - Math.abs(2 * L - 1)) * S
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = L - c / 2
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}

/** Luminancia relativa (WCAG). */
export function luminance(rgb: RGB): number {
  const f = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(rgb.r) + 0.7152 * f(rgb.g) + 0.0722 * f(rgb.b)
}

/** Razón de contraste WCAG (1–21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(hexToRgb(a)),
    lb = luminance(hexToRgb(b))
  const [light, dark] = la > lb ? [la, lb] : [lb, la]
  return (light + 0.05) / (dark + 0.05)
}

/** Blanco o negro, el que contraste más con el color dado. */
export function textOn(color: string): '#ffffff' | '#111111' {
  return contrastRatio(color, '#ffffff') >= contrastRatio(color, '#111111') ? '#ffffff' : '#111111'
}

/**
 * Ajusta la luminosidad del color (más oscuro o más claro, según el fondo) hasta alcanzar el contraste objetivo.
 * Conserva tono y saturación: el color sigue "siendo" el del municipio, solo más legible.
 */
export function readableOn(color: string, background: string, target = 4.5): string {
  if (contrastRatio(color, background) >= target) return normalizeHex(color)
  const hsl = rgbToHsl(hexToRgb(color))
  const lightBackground = luminance(hexToRgb(background)) > 0.5
  const step = lightBackground ? -1 : 1
  let l = hsl.l
  for (let i = 0; i < 100; i++) {
    l += step
    if (l < 0 || l > 100) break
    const candidate = rgbToHex(hslToRgb({ ...hsl, l }))
    if (contrastRatio(candidate, background) >= target) return candidate
  }
  return lightBackground ? '#111111' : '#f5f5f5'
}

/** Mezcla `color` con `con` en proporción (0 = color, 1 = con). */
export function mix(color: string, withUser: string, ratio: number): string {
  const a = hexToRgb(color),
    b = hexToRgb(withUser)
  return rgbToHex({
    r: a.r + (b.r - a.r) * ratio,
    g: a.g + (b.g - a.g) * ratio,
    b: a.b + (b.b - a.b) * ratio,
  })
}

export function normalizeHex(hex: string): string {
  return rgbToHex(hexToRgb(hex))
}
