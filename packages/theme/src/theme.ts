/**
 * Identidad del municipio (BD) → tokens CSS. Los tokens alimentan las variables de shadcn (`--primary`, …)
 * para que todos los componentes tomen el acento del municipio sin tocar cada componente.
 * Fondo claro: blanco. Fondo oscuro del panel: #171717 (neutral-900 de shadcn).
 */
import { z } from 'zod'
import { contrastRatio, HEX, readableOn, mix, normalizeHex, textOn } from './color'

export const TYPEFACES = ['Inter', 'Source Sans 3', 'Merriweather', 'Roboto', 'Montserrat'] as const
export type Typeface = (typeof TYPEFACES)[number]

export const themeSchema = z.object({
  primaryColor: z.string().regex(HEX, 'Color inválido'),
  secondaryColor: z.string().regex(HEX, 'Color inválido'),
  accentColor: z.string().regex(HEX, 'Color inválido'),
  typeface: z.enum(TYPEFACES).default('Inter'),
})
export type Theme = z.infer<typeof themeSchema>

/** Paleta de la plataforma y valores por defecto: neutra a propósito, sin colores de partidos políticos mexicanos. */
export const PLATFORM_THEME: Theme = {
  primaryColor: '#125c6a',
  secondaryColor: '#35505e',
  accentColor: '#5b7a8c',
  typeface: 'Inter',
}

const LIGHT_BACKGROUND = '#ffffff'
const DARK_BACKGROUND = '#171717'

export type ThemeTokens = {
  primary: string
  primaryReadable: string
  onPrimary: string
  primarySoft: string
  secondary: string
  secondaryReadable: string
  onSecondary: string
  accent: string
  accentReadable: string
  onAccent: string
}

export function themeTokens(theme: Theme, mode: 'light' | 'dark' = 'light'): ThemeTokens {
  const background = mode === 'light' ? LIGHT_BACKGROUND : DARK_BACKGROUND
  const t = (c: string) => {
    const readable = readableOn(c, background, 4.5)
    return {
      base: normalizeHex(c),
      readable,
      on: textOn(readable),
      soft: mix(readable, background, mode === 'light' ? 0.9 : 0.85),
    }
  }
  const p = t(theme.primaryColor),
    s = t(theme.secondaryColor),
    a = t(theme.accentColor)
  return {
    primary: p.base,
    primaryReadable: p.readable,
    onPrimary: p.on,
    primarySoft: p.soft,
    secondary: s.base,
    secondaryReadable: s.readable,
    onSecondary: s.on,
    accent: a.base,
    accentReadable: a.readable,
    onAccent: a.on,
  }
}

/** ¿Hubo que ajustar algún color para que fuera legible? (para avisar en el panel) */
export function adjustments(
  theme: Theme,
): { field: keyof Theme; original: string; adjusted: string; originalContrast: number }[] {
  const r: { field: keyof Theme; original: string; adjusted: string; originalContrast: number }[] =
    []
  for (const field of ['primaryColor', 'secondaryColor', 'accentColor'] as const) {
    const original = normalizeHex(theme[field])
    const adjusted = readableOn(original, LIGHT_BACKGROUND)
    if (adjusted !== original)
      r.push({
        field,
        original,
        adjusted,
        originalContrast: Math.round(contrastRatio(original, LIGHT_BACKGROUND) * 100) / 100,
      })
  }
  return r
}

function variables(t: ThemeTokens): string {
  return [
    `--t-primario:${t.primary}`,
    `--t-primario-legible:${t.primaryReadable}`,
    `--t-sobre-primario:${t.onPrimary}`,
    `--t-primario-suave:${t.primarySoft}`,
    `--t-secundario:${t.secondary}`,
    `--t-secundario-legible:${t.secondaryReadable}`,
    `--t-sobre-secundario:${t.onSecondary}`,
    `--t-acento:${t.accent}`,
    `--t-acento-legible:${t.accentReadable}`,
    `--t-sobre-acento:${t.onAccent}`,
    // shadcn toma el acento del municipio
    `--primary:${t.primaryReadable}`,
    `--primary-foreground:${t.onPrimary}`,
    `--ring:${t.primaryReadable}`,
    `--sidebar-primary:${t.primaryReadable}`,
    `--sidebar-primary-foreground:${t.onPrimary}`,
    `--accent:${t.primarySoft}`,
    `--accent-foreground:${t.primaryReadable}`,
  ].join(';')
}

/** CSS listo para inyectar en <style>: variables para modo claro y, si se pide, oscuro. */
export function themeCss(
  theme: Theme,
  options: { dark?: boolean; selector?: string } = {},
): string {
  const selector = options.selector ?? ':root'
  let css = `${selector}{${variables(themeTokens(theme, 'light'))}}`
  if (options.dark)
    css += `.dark${selector === ':root' ? '' : ` ${selector}`},${selector}.dark{${variables(themeTokens(theme, 'dark'))}}`
  return css
}

/** Versión corta para la URL de las imágenes OG: cambia si cambia cualquier color o la tipografía. */
export function themeFingerprint(theme: Theme): string {
  let h = 0
  for (const ch of JSON.stringify(themeSchema.parse(theme))) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h.toString(36)
}
