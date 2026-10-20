import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { aplanar, idDeUrl } from '../aplanar'
import {
  clasificarTitulo,
  normalizarUrl,
  parsearHtml,
  tieneCaracteresSospechosos,
} from '../parsear'

const html = await readFile(new URL('./fragmento.html', import.meta.url), 'utf8')

describe('parsearHtml', () => {
  it('reconstruye el árbol de acordeones con títulos limpios y enlaces', () => {
    const arbol = parsearHtml(html)
    expect(arbol.titulo).toBe('Artículo 8. Información fundamental – General')
    expect(arbol.hijos).toHaveLength(1)
    const fr = arbol.hijos[0]!
    expect(fr.titulo).toMatch(/^V\. La información financiera/)
    expect(fr.hijos.map((h) => h.titulo)).toEqual([
      'a) Las partidas del Presupuesto de Egresos',
      'i) Los estados financieros mensuales',
    ])
    expect(fr.hijos[0]!.enlaces).toEqual([
      {
        texto: 'PRESUPUESTO DE EGRESOS 2024',
        url: 'https://documentos-transparencia.sfo3.cdn.digitaloceanspaces.com/Tuxcacuesco/art.%208/Fracc.%20V/a)/Presupuesto%202024.pdf',
      },
    ])
    const enero = fr.hijos[1]!.hijos[0]!.hijos[0]!.hijos[0]!
    expect(enero.titulo).toBe('Enero')
    expect(enero.enlaces).toHaveLength(2)
  })
})

describe('clasificarTitulo', () => {
  it('fracción, inciso, numeral y agrupador', () => {
    expect(clasificarTitulo('V. La información')).toEqual({
      nivel: 'fraccion',
      numero: 'V',
      titulo: 'La información',
    })
    expect(clasificarTitulo('xi. Las actas')).toEqual({
      nivel: 'fraccion',
      numero: 'XI',
      titulo: 'Las actas',
    })
    expect(clasificarTitulo('a) Las partidas')).toEqual({
      nivel: 'inciso',
      numero: 'a',
      titulo: 'Las partidas',
    })
    expect(clasificarTitulo('14. Estado de variación')).toEqual({
      nivel: 'numeral',
      numero: '14',
      titulo: 'Estado de variación',
    })
    expect(clasificarTitulo('Estados Financieros')).toEqual({
      nivel: 'agrupador',
      titulo: 'Estados Financieros',
    })
  })
})

describe('aplanar', () => {
  it('genera índice v1 y documentos con periodo detectado e id determinista', () => {
    const { indice, documentos } = aplanar([
      {
        articulo: '8',
        tituloArticulo: 'Información fundamental – General',
        arbol: parsearHtml(html),
      },
    ])
    expect(indice[0]).toMatchObject({
      nivel: 'articulo',
      numero: '8',
      hijos: [
        {
          nivel: 'fraccion',
          numero: 'V',
          hijos: [
            { nivel: 'inciso', numero: 'a' },
            { nivel: 'inciso', numero: 'i' },
          ],
        },
      ],
    })
    expect(documentos).toHaveLength(3)
    expect(documentos[0]).toMatchObject({
      claveNodo: '85a',
      nombre: 'PRESUPUESTO DE EGRESOS 2024',
      carpetaPeriodo: 'permanente',
    })
    expect(documentos[1]).toMatchObject({
      claveNodo: '85i',
      periodoEtiqueta: 'Estados Financieros · 2024 · Enero',
      carpetaPeriodo: '2024-01',
      periodoInicio: '2024-01-01',
    })
    // la misma URL con y sin CDN es el mismo archivo
    expect(documentos[2]!.id).toBe(documentos[1]!.id)
    expect(documentos[2]!.advertencias).toContain('URL repetida en otro lugar del sitio')
  })
  it('normaliza URLs y detecta caracteres rotos', () => {
    expect(
      normalizarUrl('https://documentos-transparencia.sfo3.cdn.digitaloceanspaces.com/a/b.pdf'),
    ).toBe('https://documentos-transparencia.sfo3.digitaloceanspaces.com/a/b.pdf')
    expect(idDeUrl('https://x.com/a')).toHaveLength(12)
    expect(tieneCaracteresSospechosos('Informaciขn Pฃblica')).toBe(true)
    expect(tieneCaracteresSospechosos('Información Pública')).toBe(false)
  })
})
