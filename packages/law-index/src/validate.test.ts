import { describe, expect, it } from 'vitest'
import { validateLawIndex } from './validate'

const base = {
  state: 'JAL',
  version: { slug: 'prueba', name: 'Prueba' },
  obligatedSubjectType: 'ayuntamiento',
}

describe('validarIndice', () => {
  it('aplana, genera claves, hereda periodicidad y etiqueta', () => {
    const r = validateLawIndex({
      ...base,
      nodes: [
        {
          level: 'article',
          number: '8',
          title: 'General',
          frequency: 'monthly',
          children: [
            {
              level: 'fraction',
              number: 'V',
              title: 'Financiera',
              children: [
                { level: 'item', number: 'a', title: 'Presupuesto', frequency: 'annual' },
                { level: 'item', number: 'b', title: 'Estados financieros' },
              ],
            },
          ],
        },
      ],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(
      r.nodes.map((n) => [n.key, n.label, n.frequency, n.storageFolder, n.parentIndex]),
    ).toEqual([
      ['8', 'Art. 8', 'monthly', 'art-08/sin-fraccion', null],
      ['85', 'Fracc. V', 'monthly', 'art-08/fr-05/sin-inciso', 0],
      ['85a', 'Inciso a', 'annual', 'art-08/fr-05/inc-a', 1],
      ['85b', 'Inciso b', 'monthly', 'art-08/fr-05/inc-b', 1],
    ])
  })

  it('falla con claves duplicadas y lo dice claro', () => {
    const r = validateLawIndex({
      ...base,
      nodes: [
        {
          level: 'article',
          number: '8',
          title: 'a',
          frequency: 'annual',
          children: [{ level: 'fraction', number: 'V', title: 'x' }],
        },
        { level: 'article', number: '8', title: 'b', frequency: 'annual' },
      ],
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors.join('\n')).toMatch(/clave duplicada "8"/)
  })

  it('falla si falta periodicidad o la jerarquía está rota', () => {
    expect(
      validateLawIndex({ ...base, nodes: [{ level: 'article', number: '8', title: 'x' }] }).ok,
    ).toBe(false)
    const broken = validateLawIndex({
      ...base,
      nodes: [
        {
          level: 'article',
          number: '8',
          title: 'x',
          frequency: 'annual',
          children: [{ level: 'item', number: 'a', title: 'y' }],
        },
      ],
    })
    expect(broken.ok).toBe(false)
    if (broken.ok) return
    expect(broken.errors[0]).toMatch(/inciso no puede colgar de un artículo/)
  })

  it('acepta secciones sin artículo (rutaSlug) con hijos numerados', () => {
    const r = validateLawIndex({
      ...base,
      nodes: [
        {
          level: 'article',
          routeSlug: 'armonizacion-contable',
          title: 'Armonización contable',
          frequency: 'quarterly',
          children: [{ level: 'fraction', number: '1', title: 'Estado de situación financiera' }],
        },
      ],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.nodes[0]).toMatchObject({
      key: null,
      routeSlug: 'armonizacion-contable',
      storageFolder: 'armonizacion-contable',
    })
    expect(r.nodes[1]).toMatchObject({
      key: null,
      storageFolder: 'armonizacion-contable/01',
      number: '1',
    })
  })

  it('rechaza JSON mal formado con la ruta del error', () => {
    const r = validateLawIndex({ ...base, nodes: [{ level: 'chapter', title: 'x' }] })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors[0]).toMatch(/nodes\.0\.level/)
  })
})
