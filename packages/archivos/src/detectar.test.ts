import { describe, expect, it } from 'vitest'
import { detectarTipo } from './detectar'

const bytes = (s: string) => new TextEncoder().encode(s)
const PDF = bytes('%PDF-1.7\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog >>\nendobj\n')
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52,
])
const EXE = bytes('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff')
const ZIP = new Uint8Array([
  0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0, 0x08, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0,
])

describe('detectarTipo', () => {
  it('acepta un PDF real', async () => {
    const r = await detectarTipo(PDF, 'estado.pdf')
    expect(r).toMatchObject({ ok: true, mime: 'application/pdf' })
  })
  it('rechaza extensión no permitida con mensaje claro', async () => {
    const r = await detectarTipo(EXE, 'virus.exe')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toMatch(/Solo se pueden subir/)
  })
  it('rechaza un ejecutable disfrazado de PDF', async () => {
    const r = await detectarTipo(EXE, 'engañoso.pdf')
    expect(r.ok).toBe(false)
  })
  it('detecta que un .pdf es en realidad PNG', async () => {
    const r = await detectarTipo(PNG, 'foto.pdf')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toMatch(/su contenido es Imagen/)
  })
  it('acepta CSV de texto plano y rechaza binario con extensión csv', async () => {
    expect((await detectarTipo(bytes('nombre,monto\nAcme,100\n'), 'nomina.csv')).ok).toBe(true)
    expect((await detectarTipo(PNG, 'nomina.csv')).ok).toBe(false)
  })
  it('acepta ZIP y Office moderno con firma ZIP', async () => {
    expect((await detectarTipo(ZIP, 'anexos.zip')).ok).toBe(true)
    expect((await detectarTipo(ZIP, 'informe.docx')).ok).toBe(true)
    expect((await detectarTipo(ZIP, 'informe.pdf')).ok).toBe(false)
  })
})
