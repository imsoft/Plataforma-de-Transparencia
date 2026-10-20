import { describe, expect, it } from 'vitest'
import {
  carpetaDeNodo,
  claveConPuntos,
  etiquetaDeSegmentos,
  generarClave,
  normalizarClave,
  romanoAArabigo,
} from './claves'

describe('romanos', () => {
  it('convierte', () => {
    expect(romanoAArabigo('V')).toBe(5)
    expect(romanoAArabigo('xiv')).toBe(14)
    expect(romanoAArabigo('XLII')).toBe(42)
    expect(() => romanoAArabigo('abc')).toThrow()
  })
})

describe('generarClave', () => {
  it('genera 85a, 1511a y variantes', () => {
    expect(generarClave({ articulo: '8', fraccion: 'V', inciso: 'a' })).toBe('85a')
    expect(generarClave({ articulo: '15', fraccion: '11', inciso: 'a' })).toBe('1511a')
    expect(generarClave({ articulo: '8' })).toBe('8')
    expect(generarClave({ articulo: '8', fraccion: 'VI' })).toBe('86')
    expect(generarClave({ articulo: '08', fraccion: 'V', inciso: 'A', subinciso: '3' })).toBe(
      '85a3',
    )
  })
  it('rechaza jerarquías rotas', () => {
    expect(() => generarClave({ articulo: '8', inciso: 'a' })).toThrow()
    expect(() => generarClave({ articulo: 'x' })).toThrow()
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
  ])('%s → %s', (entrada, esperado) => {
    expect(normalizarClave(entrada)).toBe(esperado)
  })
})

describe('carpetas y etiquetas', () => {
  it('carpeta con ceros a la izquierda', () => {
    expect(carpetaDeNodo({ articulo: '8', fraccion: 'V', inciso: 'a' })).toBe('art-08/fr-05/inc-a')
    expect(carpetaDeNodo({ articulo: '15', fraccion: 'XI' })).toBe('art-15/fr-11/sin-inciso')
    expect(carpetaDeNodo({ articulo: '8' })).toBe('art-08/sin-fraccion')
  })
  it('etiqueta y puntos', () => {
    expect(etiquetaDeSegmentos({ articulo: '8', fraccion: '5', inciso: 'a' })).toBe(
      'Art. 8, fracc. V, inciso a',
    )
    expect(claveConPuntos({ articulo: '8', fraccion: 'V', inciso: 'a' })).toBe('8.5.a')
  })
})
