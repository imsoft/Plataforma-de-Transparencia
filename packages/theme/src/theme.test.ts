import { describe, expect, it } from 'vitest'
import { contrastRatio, readableOn, textOn } from './color'
import { adjustments, themeCss, themeFingerprint, themeTokens } from './theme'

describe('color', () => {
  it('contraste WCAG conocido', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1)
  })
  it('oscurece un amarillo de partido hasta que se lea sobre blanco', () => {
    const r = readableOn('#ffd700', '#ffffff')
    expect(contrastRatio(r, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(r).not.toBe('#ffd700')
  })
  it('aclara sobre fondo oscuro y respeta colores que ya cumplen', () => {
    expect(contrastRatio(readableOn('#7a1f2b', '#171717'), '#171717')).toBeGreaterThanOrEqual(4.5)
    expect(readableOn('#1f3a5f', '#ffffff')).toBe('#1f3a5f')
  })
  it('texto sobre color', () => {
    expect(textOn('#1f3a5f')).toBe('#ffffff')
    expect(textOn('#ffd700')).toBe('#111111')
  })
})

describe('theme', () => {
  const theme = {
    primaryColor: '#ffd700',
    secondaryColor: '#7a1f2b',
    accentColor: '#2e6b3f',
    typeface: 'Inter' as const,
  }
  it('genera tokens legibles en claro y oscuro', () => {
    const light = themeTokens(theme, 'light')
    expect(contrastRatio(light.primaryReadable, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    const dark = themeTokens(theme, 'dark')
    expect(contrastRatio(dark.secondaryReadable, '#171717')).toBeGreaterThanOrEqual(4.5)
  })
  it('reporta los ajustes para avisar en el panel', () => {
    const a = adjustments(theme)
    expect(a.map((x) => x.field)).toEqual(['primaryColor'])
  })
  it('emite CSS con variables de shadcn', () => {
    const css = themeCss(theme, { dark: true })
    expect(css).toMatch(/^:root\{--t-primario:#ffd700;/)
    expect(css).toContain('--primary:')
    expect(css).toContain('.dark')
  })
  it('la huella cambia con los colores', () => {
    expect(themeFingerprint(theme)).not.toBe(themeFingerprint({ ...theme, accentColor: '#000000' }))
  })
})
