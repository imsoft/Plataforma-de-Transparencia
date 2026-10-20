import { describe, expect, it } from 'vitest'
import { detectarPeriodo, nombreSugerido } from './nombre-sugerido'

describe('nombreSugerido', () => {
  it.each([
    ['ESTADO_FINANCIERO_MARZO_2026.pdf', 'Estado Financiero Marzo 2026'],
    ['acta-de-cabildo-no-12.pdf', 'Acta de Cabildo No 12'],
    ['nomina 1er trimestre 2026 (2).xlsx', 'Nomina 1er Trimestre 2026'],
    ['reglamento interno DIF.docx', 'Reglamento Interno DIF'],
    ['informe_final_v3.pdf', 'Informe'],
    ['.pdf', 'Documento'],
  ])('%s → %s', (archivo, esperado) => {
    expect(nombreSugerido(archivo).nombre).toBe(esperado)
  })
})

describe('detectarPeriodo', () => {
  it('detecta mes, trimestre y año', () => {
    expect(detectarPeriodo('estado financiero marzo 2026')).toEqual({
      tipo: 'mes',
      anio: 2026,
      mes: 3,
    })
    expect(detectarPeriodo('Nómina 1er trimestre 2026')).toEqual({
      tipo: 'trimestre',
      anio: 2026,
      trimestre: 1,
    })
    expect(detectarPeriodo('balance 2026-03')).toEqual({ tipo: 'mes', anio: 2026, mes: 3 })
    expect(detectarPeriodo('presupuesto 2025')).toEqual({ tipo: 'anio', anio: 2025 })
    expect(detectarPeriodo('reglamento interno')).toBeNull()
  })
})
