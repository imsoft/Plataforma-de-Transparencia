import { describe, expect, it } from 'vitest'
import { contraste, legibleSobre, textoSobre } from './color'
import { ajustes, cssDeTema, huellaDeTema, tokensDeTema } from './tema'

describe('color', () => {
  it('contraste WCAG conocido', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contraste('#777777', '#ffffff')).toBeCloseTo(4.48, 1)
  })
  it('oscurece un amarillo de partido hasta que se lea sobre blanco', () => {
    const r = legibleSobre('#ffd700', '#ffffff')
    expect(contraste(r, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(r).not.toBe('#ffd700')
  })
  it('aclara sobre fondo oscuro y respeta colores que ya cumplen', () => {
    expect(contraste(legibleSobre('#7a1f2b', '#171717'), '#171717')).toBeGreaterThanOrEqual(4.5)
    expect(legibleSobre('#1f3a5f', '#ffffff')).toBe('#1f3a5f')
  })
  it('texto sobre color', () => {
    expect(textoSobre('#1f3a5f')).toBe('#ffffff')
    expect(textoSobre('#ffd700')).toBe('#111111')
  })
})

describe('tema', () => {
  const tema = {
    colorPrimario: '#ffd700',
    colorSecundario: '#7a1f2b',
    colorAcento: '#2e6b3f',
    tipografia: 'Inter' as const,
  }
  it('genera tokens legibles en claro y oscuro', () => {
    const claro = tokensDeTema(tema, 'claro')
    expect(contraste(claro.primarioLegible, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    const oscuro = tokensDeTema(tema, 'oscuro')
    expect(contraste(oscuro.secundarioLegible, '#171717')).toBeGreaterThanOrEqual(4.5)
  })
  it('reporta los ajustes para avisar en el panel', () => {
    const a = ajustes(tema)
    expect(a.map((x) => x.campo)).toEqual(['colorPrimario'])
  })
  it('emite CSS con variables de shadcn', () => {
    const css = cssDeTema(tema, { oscuro: true })
    expect(css).toMatch(/^:root\{--t-primario:#ffd700;/)
    expect(css).toContain('--primary:')
    expect(css).toContain('.dark')
  })
  it('la huella cambia con los colores', () => {
    expect(huellaDeTema(tema)).not.toBe(huellaDeTema({ ...tema, colorAcento: '#000000' }))
  })
})
