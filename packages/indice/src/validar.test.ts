import { describe, expect, it } from 'vitest'
import { validarIndice } from './validar'

const base = {
  estado: 'JAL',
  version: { slug: 'prueba', nombre: 'Prueba' },
  tipoSujetoObligado: 'ayuntamiento',
}

describe('validarIndice', () => {
  it('aplana, genera claves, hereda periodicidad y etiqueta', () => {
    const r = validarIndice({
      ...base,
      nodos: [
        {
          nivel: 'articulo',
          numero: '8',
          titulo: 'General',
          periodicidad: 'mensual',
          hijos: [
            {
              nivel: 'fraccion',
              numero: 'V',
              titulo: 'Financiera',
              hijos: [
                { nivel: 'inciso', numero: 'a', titulo: 'Presupuesto', periodicidad: 'anual' },
                { nivel: 'inciso', numero: 'b', titulo: 'Estados financieros' },
              ],
            },
          ],
        },
      ],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(
      r.nodos.map((n) => [n.clave, n.etiqueta, n.periodicidad, n.carpetaR2, n.padreIndice]),
    ).toEqual([
      ['8', 'Art. 8', 'mensual', 'art-08/sin-fraccion', null],
      ['85', 'Fracc. V', 'mensual', 'art-08/fr-05/sin-inciso', 0],
      ['85a', 'Inciso a', 'anual', 'art-08/fr-05/inc-a', 1],
      ['85b', 'Inciso b', 'mensual', 'art-08/fr-05/inc-b', 1],
    ])
  })

  it('falla con claves duplicadas y lo dice claro', () => {
    const r = validarIndice({
      ...base,
      nodos: [
        {
          nivel: 'articulo',
          numero: '8',
          titulo: 'a',
          periodicidad: 'anual',
          hijos: [{ nivel: 'fraccion', numero: 'V', titulo: 'x' }],
        },
        { nivel: 'articulo', numero: '8', titulo: 'b', periodicidad: 'anual' },
      ],
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errores.join('\n')).toMatch(/clave duplicada "8"/)
  })

  it('falla si falta periodicidad o la jerarquía está rota', () => {
    expect(
      validarIndice({ ...base, nodos: [{ nivel: 'articulo', numero: '8', titulo: 'x' }] }).ok,
    ).toBe(false)
    const rota = validarIndice({
      ...base,
      nodos: [
        {
          nivel: 'articulo',
          numero: '8',
          titulo: 'x',
          periodicidad: 'anual',
          hijos: [{ nivel: 'inciso', numero: 'a', titulo: 'y' }],
        },
      ],
    })
    expect(rota.ok).toBe(false)
    if (rota.ok) return
    expect(rota.errores[0]).toMatch(/inciso no puede colgar de un articulo/)
  })

  it('acepta secciones sin artículo (rutaSlug) con hijos numerados', () => {
    const r = validarIndice({
      ...base,
      nodos: [
        {
          nivel: 'articulo',
          rutaSlug: 'armonizacion-contable',
          titulo: 'Armonización contable',
          periodicidad: 'trimestral',
          hijos: [{ nivel: 'fraccion', numero: '1', titulo: 'Estado de situación financiera' }],
        },
      ],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.nodos[0]).toMatchObject({
      clave: null,
      rutaSlug: 'armonizacion-contable',
      carpetaR2: 'armonizacion-contable',
    })
    expect(r.nodos[1]).toMatchObject({
      clave: null,
      carpetaR2: 'armonizacion-contable/01',
      numero: '1',
    })
  })

  it('rechaza JSON mal formado con la ruta del error', () => {
    const r = validarIndice({ ...base, nodos: [{ nivel: 'capitulo', titulo: 'x' }] })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errores[0]).toMatch(/nodos\.0\.nivel/)
  })
})
