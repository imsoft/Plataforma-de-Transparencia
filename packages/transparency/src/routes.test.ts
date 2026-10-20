import { describe, expect, it } from 'vitest'
import { isReservedRoute, resolveSegments, nodeRoute } from './routes'

const prefixes = ['dif', 'agua']
const sections = ['armonizacion-contable']

describe('resolverSegmentos', () => {
  it.each([
    [['85a'], { type: 'key', prefix: '', key: '85a', version: null }],
    [['dif', '85a'], { type: 'key', prefix: 'dif', key: '85a', version: null }],
    [['dif'], { type: 'home', prefix: 'dif', version: null }],
    [['transparencia'], { type: 'home', prefix: '', version: null }],
    [['articulo-8'], { type: 'article', prefix: '', number: '8', version: null }],
    [
      ['dif', 'v', 'ley-anterior', '85'],
      { type: 'key', prefix: 'dif', key: '85', version: 'ley-anterior' },
    ],
    [
      ['armonizacion-contable'],
      { type: 'section', prefix: '', routeSlug: 'armonizacion-contable', version: null },
    ],
    [['8.5A'], { type: 'redirect', target: '/85a' }],
    [['dif', '8-5-a'], { type: 'redirect', target: '/dif/85a' }],
    [['articulo-08'], { type: 'redirect', target: '/articulo-8' }],
    [['directorio'], { type: 'not_found' }],
    [['dif', '85a', 'extra'], { type: 'not_found' }],
    [[], { type: 'not_found' }],
  ])('%j → %j', (input, expected) => {
    expect(resolveSegments(input, prefixes, sections)).toEqual(expected)
  })
})

describe('rutas y reservadas', () => {
  it('arma rutas', () => {
    expect(nodeRoute('', '85a', null)).toBe('/85a')
    expect(nodeRoute('dif', '85a', null)).toBe('/dif/85a')
    expect(nodeRoute('', null, 'armonizacion-contable')).toBe('/armonizacion-contable')
  })
  it('detecta reservadas', () => {
    expect(isReservedRoute('d')).toBe(true)
    expect(isReservedRoute('85a')).toBe(true)
    expect(isReservedRoute('articulo-8')).toBe(true)
    expect(isReservedRoute('directorio')).toBe(false)
  })
})
