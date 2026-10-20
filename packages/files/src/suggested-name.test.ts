import { describe, expect, it } from 'vitest'
import { detectPeriod, suggestedName } from './suggested-name'

describe('nombreSugerido', () => {
  it.each([
    ['ESTADO_FINANCIERO_MARZO_2026.pdf', 'Estado Financiero Marzo 2026'],
    ['acta-de-cabildo-no-12.pdf', 'Acta de Cabildo No 12'],
    ['nomina 1er trimestre 2026 (2).xlsx', 'Nomina 1er Trimestre 2026'],
    ['reglamento interno DIF.docx', 'Reglamento Interno DIF'],
    ['informe_final_v3.pdf', 'Informe'],
    ['.pdf', 'Documento'],
  ])('%s → %s', (file, expected) => {
    expect(suggestedName(file).name).toBe(expected)
  })
})

describe('detectarPeriodo', () => {
  it('detecta mes, trimestre y año', () => {
    expect(detectPeriod('estado financiero marzo 2026')).toEqual({
      type: 'month',
      year: 2026,
      month: 3,
    })
    expect(detectPeriod('Nómina 1er trimestre 2026')).toEqual({
      type: 'quarter',
      year: 2026,
      quarter: 1,
    })
    expect(detectPeriod('balance 2026-03')).toEqual({ type: 'month', year: 2026, month: 3 })
    expect(detectPeriod('presupuesto 2025')).toEqual({ type: 'year', year: 2025 })
    expect(detectPeriod('reglamento interno')).toBeNull()
  })
})
