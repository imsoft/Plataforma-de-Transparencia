import { describe, expect, it } from 'vitest'
import { esRutaReservada, resolverSegmentos, rutaDeNodo } from './rutas'

const prefijos = ['dif', 'agua']
const secciones = ['armonizacion-contable']

describe('resolverSegmentos', () => {
  it.each([
    [['85a'], { tipo: 'clave', prefijo: '', clave: '85a', version: null }],
    [['dif', '85a'], { tipo: 'clave', prefijo: 'dif', clave: '85a', version: null }],
    [['dif'], { tipo: 'portada', prefijo: 'dif', version: null }],
    [['transparencia'], { tipo: 'portada', prefijo: '', version: null }],
    [['articulo-8'], { tipo: 'articulo', prefijo: '', numero: '8', version: null }],
    [
      ['dif', 'v', 'ley-anterior', '85'],
      { tipo: 'clave', prefijo: 'dif', clave: '85', version: 'ley-anterior' },
    ],
    [
      ['armonizacion-contable'],
      { tipo: 'seccion', prefijo: '', rutaSlug: 'armonizacion-contable', version: null },
    ],
    [['8.5A'], { tipo: 'redirigir', destino: '/85a' }],
    [['dif', '8-5-a'], { tipo: 'redirigir', destino: '/dif/85a' }],
    [['articulo-08'], { tipo: 'redirigir', destino: '/articulo-8' }],
    [['directorio'], { tipo: 'no_encontrado' }],
    [['dif', '85a', 'extra'], { tipo: 'no_encontrado' }],
    [[], { tipo: 'no_encontrado' }],
  ])('%j → %j', (entrada, esperado) => {
    expect(resolverSegmentos(entrada, prefijos, secciones)).toEqual(esperado)
  })
})

describe('rutas y reservadas', () => {
  it('arma rutas', () => {
    expect(rutaDeNodo('', '85a', null)).toBe('/85a')
    expect(rutaDeNodo('dif', '85a', null)).toBe('/dif/85a')
    expect(rutaDeNodo('', null, 'armonizacion-contable')).toBe('/armonizacion-contable')
  })
  it('detecta reservadas', () => {
    expect(esRutaReservada('d')).toBe(true)
    expect(esRutaReservada('85a')).toBe(true)
    expect(esRutaReservada('articulo-8')).toBe(true)
    expect(esRutaReservada('directorio')).toBe(false)
  })
})
