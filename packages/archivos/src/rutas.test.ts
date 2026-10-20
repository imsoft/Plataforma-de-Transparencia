import { describe, expect, it } from 'vitest'
import {
  contentDisposition,
  rutaDeArchivo,
  rutaDeMiniatura,
  rutaDeVersionAnterior,
  slug,
} from './rutas'

describe('slug', () => {
  it('quita acentos, espacios y símbolos', () => {
    expect(slug('Estado Financiero Marzo 2026 (versión pública).pdf')).toBe(
      'estado-financiero-marzo-2026-version-publica-pdf',
    )
    expect(slug('   ')).toBe('documento')
    expect(slug('Informaciขn Pฃblica')).toBe('informaci-n-p-blica')
  })
})

describe('rutaDeArchivo', () => {
  const base = {
    municipioSlug: 'tuxcacuesco',
    sujetoObligadoSlug: 'ayuntamiento',
    versionCarpeta: 'ley-2026',
    nodoCarpeta: 'art-08/fr-05/inc-a',
    periodoCarpeta: '2026-03',
    nombreVisible: 'Estado financiero marzo 2026',
    idCorto: 'k7x9q2',
    extension: 'PDF',
  }
  it('arma la ruta ordenada del brief', () => {
    expect(rutaDeArchivo(base)).toBe(
      'tuxcacuesco/ayuntamiento/ley-2026/art-08/fr-05/inc-a/2026-03/estado-financiero-marzo-2026__k7x9q2.pdf',
    )
  })
  it('rechaza segmentos peligrosos', () => {
    expect(() => rutaDeArchivo({ ...base, municipioSlug: '../otro' })).toThrow(/inválido/)
    expect(() => rutaDeArchivo({ ...base, nodoCarpeta: 'art-08//x' })).toThrow(/inválido/)
  })
  it('versiones anteriores y miniaturas van en subcarpetas', () => {
    const r = rutaDeArchivo(base)
    expect(rutaDeVersionAnterior(r, 1)).toBe(
      'tuxcacuesco/ayuntamiento/ley-2026/art-08/fr-05/inc-a/2026-03/_versiones/estado-financiero-marzo-2026__k7x9q2__v1.pdf',
    )
    expect(rutaDeMiniatura(r.replace('.pdf', '.mp4'))).toBe(
      'tuxcacuesco/ayuntamiento/ley-2026/art-08/fr-05/inc-a/2026-03/_miniaturas/estado-financiero-marzo-2026__k7x9q2.jpg',
    )
  })
})

describe('contentDisposition', () => {
  it('nombre legible en ASCII y UTF-8', () => {
    expect(contentDisposition('inline', 'Acta de cabildo nº 12', 'pdf')).toBe(
      `inline; filename="acta-de-cabildo-n-12.pdf"; filename*=UTF-8''Acta%20de%20cabildo%20n%C2%BA%2012.pdf`,
    )
  })
})
