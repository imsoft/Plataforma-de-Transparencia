/**
 * Identidad del municipio (BD) → tokens CSS. Los tokens alimentan las variables de shadcn (`--primary`, …)
 * para que todos los componentes tomen el acento del municipio sin tocar cada componente.
 * Fondo claro: blanco. Fondo oscuro del panel: #171717 (neutral-900 de shadcn).
 */
import { z } from 'zod'
import { contraste, HEX, legibleSobre, mezclar, normalizarHex, textoSobre } from './color'

export const TIPOGRAFIAS = [
  'Inter',
  'Source Sans 3',
  'Merriweather',
  'Roboto',
  'Montserrat',
] as const
export type Tipografia = (typeof TIPOGRAFIAS)[number]

export const temaSchema = z.object({
  colorPrimario: z.string().regex(HEX, 'Color inválido'),
  colorSecundario: z.string().regex(HEX, 'Color inválido'),
  colorAcento: z.string().regex(HEX, 'Color inválido'),
  tipografia: z.enum(TIPOGRAFIAS).default('Inter'),
})
export type Tema = z.infer<typeof temaSchema>

/** Paleta de la plataforma y valores por defecto: neutra a propósito, sin colores de partidos políticos mexicanos. */
export const TEMA_PLATAFORMA: Tema = {
  colorPrimario: '#125c6a',
  colorSecundario: '#35505e',
  colorAcento: '#5b7a8c',
  tipografia: 'Inter',
}

const FONDO_CLARO = '#ffffff'
const FONDO_OSCURO = '#171717'

export type Tokens = {
  primario: string
  primarioLegible: string
  sobrePrimario: string
  primarioSuave: string
  secundario: string
  secundarioLegible: string
  sobreSecundario: string
  acento: string
  acentoLegible: string
  sobreAcento: string
}

export function tokensDeTema(tema: Tema, modo: 'claro' | 'oscuro' = 'claro'): Tokens {
  const fondo = modo === 'claro' ? FONDO_CLARO : FONDO_OSCURO
  const t = (c: string) => {
    const legible = legibleSobre(c, fondo, 4.5)
    return {
      base: normalizarHex(c),
      legible,
      sobre: textoSobre(legible),
      suave: mezclar(legible, fondo, modo === 'claro' ? 0.9 : 0.85),
    }
  }
  const p = t(tema.colorPrimario),
    s = t(tema.colorSecundario),
    a = t(tema.colorAcento)
  return {
    primario: p.base,
    primarioLegible: p.legible,
    sobrePrimario: p.sobre,
    primarioSuave: p.suave,
    secundario: s.base,
    secundarioLegible: s.legible,
    sobreSecundario: s.sobre,
    acento: a.base,
    acentoLegible: a.legible,
    sobreAcento: a.sobre,
  }
}

/** ¿Hubo que ajustar algún color para que fuera legible? (para avisar en el panel) */
export function ajustes(
  tema: Tema,
): { campo: keyof Tema; original: string; ajustado: string; contrasteOriginal: number }[] {
  const r: { campo: keyof Tema; original: string; ajustado: string; contrasteOriginal: number }[] =
    []
  for (const campo of ['colorPrimario', 'colorSecundario', 'colorAcento'] as const) {
    const original = normalizarHex(tema[campo])
    const ajustado = legibleSobre(original, FONDO_CLARO)
    if (ajustado !== original)
      r.push({
        campo,
        original,
        ajustado,
        contrasteOriginal: Math.round(contraste(original, FONDO_CLARO) * 100) / 100,
      })
  }
  return r
}

function variables(t: Tokens): string {
  return [
    `--t-primario:${t.primario}`,
    `--t-primario-legible:${t.primarioLegible}`,
    `--t-sobre-primario:${t.sobrePrimario}`,
    `--t-primario-suave:${t.primarioSuave}`,
    `--t-secundario:${t.secundario}`,
    `--t-secundario-legible:${t.secundarioLegible}`,
    `--t-sobre-secundario:${t.sobreSecundario}`,
    `--t-acento:${t.acento}`,
    `--t-acento-legible:${t.acentoLegible}`,
    `--t-sobre-acento:${t.sobreAcento}`,
    // shadcn toma el acento del municipio
    `--primary:${t.primarioLegible}`,
    `--primary-foreground:${t.sobrePrimario}`,
    `--ring:${t.primarioLegible}`,
    `--sidebar-primary:${t.primarioLegible}`,
    `--sidebar-primary-foreground:${t.sobrePrimario}`,
    `--accent:${t.primarioSuave}`,
    `--accent-foreground:${t.primarioLegible}`,
  ].join(';')
}

/** CSS listo para inyectar en <style>: variables para modo claro y, si se pide, oscuro. */
export function cssDeTema(
  tema: Tema,
  opciones: { oscuro?: boolean; selector?: string } = {},
): string {
  const sel = opciones.selector ?? ':root'
  let css = `${sel}{${variables(tokensDeTema(tema, 'claro'))}}`
  if (opciones.oscuro)
    css += `.dark${sel === ':root' ? '' : ` ${sel}`},${sel}.dark{${variables(tokensDeTema(tema, 'oscuro'))}}`
  return css
}

/** Versión corta para la URL de las imágenes OG: cambia si cambia cualquier color o la tipografía. */
export function huellaDeTema(tema: Tema): string {
  let h = 0
  for (const ch of JSON.stringify(temaSchema.parse(tema))) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h.toString(36)
}
