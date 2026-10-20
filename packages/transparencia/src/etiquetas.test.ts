import { describe, expect, it } from 'vitest'
import { etiquetasDeDocumento, etiquetasDeNodo } from './etiquetas'

describe('etiquetas de caché', () => {
  it('incluye ancestros, sujeto obligado y sitemap', () => {
    expect(etiquetasDeNodo({ prefijo: 'dif', rutaClaves: ['8', '85', '85a'] })).toEqual([
      'todo',
      'so:dif',
      'nodo:dif:8',
      'nodo:dif:85',
      'nodo:dif:85a',
      'sitemap',
    ])
    expect(etiquetasDeDocumento('abc', { prefijo: '', rutaClaves: ['8'] })).toEqual([
      'documento:abc',
      'todo',
      'so:raiz',
      'nodo:raiz:8',
      'sitemap',
    ])
  })
})
