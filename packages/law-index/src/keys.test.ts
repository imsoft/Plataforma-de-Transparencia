import { describe, expect, it } from 'vitest'
import { nodeFolder, dottedKey, segmentsLabel, buildKey, normalizeKey, romanToArabic } from './keys'

describe('romanos', () => {
  it('convierte', () => {
    expect(romanToArabic('V')).toBe(5)
    expect(romanToArabic('xiv')).toBe(14)
    expect(romanToArabic('XLII')).toBe(42)
    expect(() => romanToArabic('abc')).toThrow()
  })
})

describe('generarClave', () => {
  it('genera 85a, 1511a y variantes', () => {
    expect(buildKey({ article: '8', fraction: 'V', item: 'a' })).toBe('85a')
    expect(buildKey({ article: '15', fraction: '11', item: 'a' })).toBe('1511a')
    expect(buildKey({ article: '8' })).toBe('8')
    expect(buildKey({ article: '8', fraction: 'VI' })).toBe('86')
    expect(buildKey({ article: '08', fraction: 'V', item: 'A', subitem: '3' })).toBe('85a3')
  })
  it('rechaza jerarquías rotas', () => {
    expect(() => buildKey({ article: '8', item: 'a' })).toThrow()
    expect(() => buildKey({ article: 'x' })).toThrow()
  })
})

describe('normalizarClave', () => {
  it.each([
    ['85a', '85a'],
    ['85A', '85a'],
    ['8.5a', '85a'],
    ['8-5-a', '85a'],
    ['8.V.a', '85a'],
    ['8 v a', '85a'],
    ['8.5', '85'],
    ['8', '8'],
    ['08', '8'],
    ['15.XI', '1511'],
    ['directorio', null],
    ['', null],
    ['8.5.ab', null],
    ['8.x.y', '810y'],
    ['8.V.ñ', '85nn'],
    ['85ñ', '85nn'],
    ['85nn', '85nn'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeKey(input)).toBe(expected)
  })
})

describe('carpetas y etiquetas', () => {
  it('carpeta con ceros a la izquierda', () => {
    expect(nodeFolder({ article: '8', fraction: 'V', item: 'a' })).toBe('art-08/fr-05/inc-a')
    expect(nodeFolder({ article: '15', fraction: 'XI' })).toBe('art-15/fr-11/sin-inciso')
    expect(nodeFolder({ article: '8' })).toBe('art-08/sin-fraccion')
  })
  it('etiqueta y puntos', () => {
    expect(segmentsLabel({ article: '8', fraction: '5', item: 'a' })).toBe(
      'Art. 8, fracc. V, inciso a',
    )
    expect(dottedKey({ article: '8', fraction: 'V', item: 'a' })).toBe('8.5.a')
  })
})
