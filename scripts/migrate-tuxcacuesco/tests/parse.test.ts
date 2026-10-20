import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { flatten, idFromUrl } from '../flatten'
import { classifyTitle, normalizeUrl, parseHtml, hasSuspiciousCharacters } from '../parse'

const html = await readFile(new URL('./fragment.html', import.meta.url), 'utf8')

describe('parsearHtml', () => {
  it('reconstruye el árbol de acordeones con títulos limpios y enlaces', () => {
    const tree = parseHtml(html)
    expect(tree.title).toBe('Artículo 8. Información fundamental – General')
    expect(tree.children).toHaveLength(1)
    const fr = tree.children[0]!
    expect(fr.title).toMatch(/^V\. La información financiera/)
    expect(fr.children.map((h) => h.title)).toEqual([
      'a) Las partidas del Presupuesto de Egresos',
      'i) Los estados financieros mensuales',
    ])
    expect(fr.children[0]!.links).toEqual([
      {
        text: 'PRESUPUESTO DE EGRESOS 2024',
        url: 'https://documentos-transparencia.sfo3.cdn.digitaloceanspaces.com/Tuxcacuesco/art.%208/Fracc.%20V/a)/Presupuesto%202024.pdf',
      },
    ])
    const enero = fr.children[1]!.children[0]!.children[0]!.children[0]!
    expect(enero.title).toBe('Enero')
    expect(enero.links).toHaveLength(2)
  })
})

describe('clasificarTitulo', () => {
  it('fracción, inciso, numeral y agrupador', () => {
    expect(classifyTitle('V. La información')).toEqual({
      level: 'fraction',
      number: 'V',
      title: 'La información',
    })
    expect(classifyTitle('xi. Las actas')).toEqual({
      level: 'fraction',
      number: 'XI',
      title: 'Las actas',
    })
    expect(classifyTitle('a) Las partidas')).toEqual({
      level: 'item',
      number: 'a',
      title: 'Las partidas',
    })
    expect(classifyTitle('14. Estado de variación')).toEqual({
      level: 'numeral',
      number: '14',
      title: 'Estado de variación',
    })
    expect(classifyTitle('Estados Financieros')).toEqual({
      level: 'grouping',
      title: 'Estados Financieros',
    })
  })
})

describe('aplanar', () => {
  it('genera índice v1 y documentos con periodo detectado e id determinista', () => {
    const { lawIndex, documents } = flatten([
      {
        article: '8',
        articleTitle: 'Información fundamental – General',
        tree: parseHtml(html),
      },
    ])
    expect(lawIndex[0]).toMatchObject({
      level: 'article',
      number: '8',
      children: [
        {
          level: 'fraction',
          number: 'V',
          children: [
            { level: 'item', number: 'a' },
            { level: 'item', number: 'i' },
          ],
        },
      ],
    })
    expect(documents).toHaveLength(3)
    expect(documents[0]).toMatchObject({
      nodeKey: '85a',
      name: 'PRESUPUESTO DE EGRESOS 2024',
      periodFolder: 'permanent',
    })
    expect(documents[1]).toMatchObject({
      nodeKey: '85i',
      periodLabel: 'Estados Financieros · 2024 · Enero',
      periodFolder: '2024-01',
      periodStart: '2024-01-01',
    })
    // la misma URL con y sin CDN es el mismo archivo
    expect(documents[2]!.id).toBe(documents[1]!.id)
    expect(documents[2]!.warnings).toContain('URL repetida en otro lugar del sitio')
  })
  it('normaliza URLs y detecta caracteres rotos', () => {
    expect(
      normalizeUrl('https://documentos-transparencia.sfo3.cdn.digitaloceanspaces.com/a/b.pdf'),
    ).toBe('https://documentos-transparencia.sfo3.digitaloceanspaces.com/a/b.pdf')
    expect(idFromUrl('https://x.com/a')).toHaveLength(12)
    expect(hasSuspiciousCharacters('Informaciขn Pฃblica')).toBe(true)
    expect(hasSuspiciousCharacters('Información Pública')).toBe(false)
  })
})
