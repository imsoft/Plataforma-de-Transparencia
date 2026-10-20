import { describe, expect, it } from 'vitest'
import { nodeStatus, periodOf, currentPeriod } from './traffic-light'

describe('periodos', () => {
  it('mensual, trimestral, semestral, anual', () => {
    expect(periodOf('monthly', '2026-03-15')).toEqual({
      start: '2026-03-01',
      end: '2026-03-31',
      label: 'Marzo 2026',
      folder: '2026-03',
    })
    expect(periodOf('quarterly', '2026-05-02')).toMatchObject({
      start: '2026-04-01',
      end: '2026-06-30',
      label: '2do trimestre 2026',
      folder: '2026-t2',
    })
    expect(periodOf('semiannual', '2026-08-02')).toMatchObject({
      start: '2026-07-01',
      end: '2026-12-31',
      folder: '2026-s2',
    })
    expect(periodOf('annual', '2026-08-02')).toMatchObject({
      start: '2026-01-01',
      end: '2026-12-31',
      label: 'Ejercicio 2026',
    })
    expect(periodOf('monthly', '2024-02-10').end).toBe('2024-02-29')
  })
  it('el periodo vigente es el último cerrado', () => {
    expect(currentPeriod('monthly', '2026-04-10').folder).toBe('2026-03')
    expect(currentPeriod('quarterly', '2026-01-05').folder).toBe('2025-t4')
    expect(currentPeriod('annual', '2026-01-05').folder).toBe('2025')
  })
})

describe('estadoNodo', () => {
  const cfg = { graceDays: 30, warningDays: 10, reviewedPeriods: 3 }
  it('permanente: verde con documentos, rojo sin', () => {
    expect(
      nodeStatus({ frequency: 'permanent', coveredPeriods: [], hasDocuments: true }, '2026-04-10')
        .status,
    ).toBe('green')
    expect(
      nodeStatus({ frequency: 'permanent', coveredPeriods: [], hasDocuments: false }, '2026-04-10')
        .status,
    ).toBe('red')
  })
  it('mensual: verde si marzo está cubierto en abril', () => {
    const r = nodeStatus(
      { frequency: 'monthly', coveredPeriods: ['2026-03-01'], hasDocuments: true },
      '2026-04-10',
      cfg,
    )
    expect(r.status).toBe('green')
    expect(r.deadline).toBe('2026-04-30')
  })
  it('mensual: amarillo cerca del plazo, rojo pasado el plazo', () => {
    const base = {
      frequency: 'monthly' as const,
      coveredPeriods: ['2026-02-01'],
      hasDocuments: true,
    }
    expect(nodeStatus(base, '2026-04-10', cfg).status).toBe('green')
    expect(nodeStatus(base, '2026-04-22', cfg).status).toBe('yellow')
    const r = nodeStatus(base, '2026-05-01', cfg)
    expect(r.status).toBe('red')
    expect(r.overdue.map((p) => p.folder)).toEqual(['2026-03'])
  })
  it('un hueco viejo ya fuera de los periodos revisados no cuenta', () => {
    const base = {
      frequency: 'monthly' as const,
      coveredPeriods: ['2026-03-01', '2026-02-01', '2026-01-01'],
      hasDocuments: true,
    }
    expect(nodeStatus(base, '2026-04-10', cfg).status).toBe('green')
  })
  it('nunca ha publicado nada: rojo aunque haya tiempo', () => {
    expect(
      nodeStatus(
        { frequency: 'monthly', coveredPeriods: [], hasDocuments: false },
        '2026-04-02',
        cfg,
      ).status,
    ).toBe('red')
  })
})
