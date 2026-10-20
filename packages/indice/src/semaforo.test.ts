import { describe, expect, it } from 'vitest'
import { estadoNodo, periodoDe, periodoVigente } from './semaforo'

describe('periodos', () => {
  it('mensual, trimestral, semestral, anual', () => {
    expect(periodoDe('mensual', '2026-03-15')).toEqual({
      inicio: '2026-03-01',
      fin: '2026-03-31',
      etiqueta: 'Marzo 2026',
      carpeta: '2026-03',
    })
    expect(periodoDe('trimestral', '2026-05-02')).toMatchObject({
      inicio: '2026-04-01',
      fin: '2026-06-30',
      etiqueta: '2do trimestre 2026',
      carpeta: '2026-t2',
    })
    expect(periodoDe('semestral', '2026-08-02')).toMatchObject({
      inicio: '2026-07-01',
      fin: '2026-12-31',
      carpeta: '2026-s2',
    })
    expect(periodoDe('anual', '2026-08-02')).toMatchObject({
      inicio: '2026-01-01',
      fin: '2026-12-31',
      etiqueta: 'Ejercicio 2026',
    })
    expect(periodoDe('mensual', '2024-02-10').fin).toBe('2024-02-29')
  })
  it('el periodo vigente es el último cerrado', () => {
    expect(periodoVigente('mensual', '2026-04-10').carpeta).toBe('2026-03')
    expect(periodoVigente('trimestral', '2026-01-05').carpeta).toBe('2025-t4')
    expect(periodoVigente('anual', '2026-01-05').carpeta).toBe('2025')
  })
})

describe('estadoNodo', () => {
  const cfg = { diasGracia: 30, diasAviso: 10, periodosRevisados: 3 }
  it('permanente: verde con documentos, rojo sin', () => {
    expect(
      estadoNodo(
        { periodicidad: 'permanente', periodosCubiertos: [], tieneDocumentos: true },
        '2026-04-10',
      ).estado,
    ).toBe('verde')
    expect(
      estadoNodo(
        { periodicidad: 'permanente', periodosCubiertos: [], tieneDocumentos: false },
        '2026-04-10',
      ).estado,
    ).toBe('rojo')
  })
  it('mensual: verde si marzo está cubierto en abril', () => {
    const r = estadoNodo(
      { periodicidad: 'mensual', periodosCubiertos: ['2026-03-01'], tieneDocumentos: true },
      '2026-04-10',
      cfg,
    )
    expect(r.estado).toBe('verde')
    expect(r.plazo).toBe('2026-04-30')
  })
  it('mensual: amarillo cerca del plazo, rojo pasado el plazo', () => {
    const base = {
      periodicidad: 'mensual' as const,
      periodosCubiertos: ['2026-02-01'],
      tieneDocumentos: true,
    }
    expect(estadoNodo(base, '2026-04-10', cfg).estado).toBe('verde')
    expect(estadoNodo(base, '2026-04-22', cfg).estado).toBe('amarillo')
    const r = estadoNodo(base, '2026-05-01', cfg)
    expect(r.estado).toBe('rojo')
    expect(r.vencidos.map((p) => p.carpeta)).toEqual(['2026-03'])
  })
  it('un hueco viejo ya fuera de los periodos revisados no cuenta', () => {
    const base = {
      periodicidad: 'mensual' as const,
      periodosCubiertos: ['2026-03-01', '2026-02-01', '2026-01-01'],
      tieneDocumentos: true,
    }
    expect(estadoNodo(base, '2026-04-10', cfg).estado).toBe('verde')
  })
  it('nunca ha publicado nada: rojo aunque haya tiempo', () => {
    expect(
      estadoNodo(
        { periodicidad: 'mensual', periodosCubiertos: [], tieneDocumentos: false },
        '2026-04-02',
        cfg,
      ).estado,
    ).toBe('rojo')
  })
})
