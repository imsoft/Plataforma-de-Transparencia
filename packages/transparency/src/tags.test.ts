import { describe, expect, it } from 'vitest'
import { documentTags, nodeTags } from './tags'

describe('etiquetas de caché', () => {
  it('incluye ancestros, sujeto obligado y sitemap', () => {
    expect(nodeTags({ prefix: 'dif', keyPath: ['8', '85', '85a'] })).toEqual([
      'all',
      'so:dif',
      'node:dif:8',
      'node:dif:85',
      'node:dif:85a',
      'sitemap',
    ])
    expect(documentTags('abc', { prefix: '', keyPath: ['8'] })).toEqual([
      'document:abc',
      'all',
      'so:root',
      'node:root:8',
      'sitemap',
    ])
  })
})
