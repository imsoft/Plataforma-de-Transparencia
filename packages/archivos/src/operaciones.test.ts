import '@plataforma/db/env'
import { describe, expect, it } from 'vitest'
import {
  borrar,
  cabecera,
  firmarSubida,
  leerInicio,
  mover,
  subirDesdeServidor,
} from './operaciones'
import { rutaDeArchivo, rutaDeVersionAnterior } from './rutas'

const ruta = rutaDeArchivo({
  municipioSlug: 'pruebas',
  sujetoObligadoSlug: 'ayuntamiento',
  versionCarpeta: 'v',
  nodoCarpeta: 'art-08/fr-05/inc-a',
  periodoCarpeta: '2026-03',
  nombreVisible: 'Prueba de subida',
  idCorto: Math.random().toString(36).slice(2, 8),
  extension: 'pdf',
})
const meta = { contentType: 'application/pdf', contentDisposition: 'inline; filename="prueba.pdf"' }

describe('bucket (RustFS local)', () => {
  it('sube con URL firmada, lee cabecera e inicio, mueve a _versiones y borra', async () => {
    const cuerpo = '%PDF-1.4 contenido de prueba'
    const url = await firmarSubida(ruta, cuerpo.length, meta)
    const r = await fetch(url, {
      method: 'PUT',
      body: cuerpo,
      headers: {
        'Content-Type': meta.contentType,
        'Content-Disposition': meta.contentDisposition,
        'Content-Length': String(cuerpo.length),
      },
    })
    expect(r.status).toBe(200)

    const cab = await cabecera(ruta)
    expect(cab).toEqual({ tamano: cuerpo.length, contentType: 'application/pdf' })
    expect(new TextDecoder().decode(await leerInicio(ruta, 8))).toBe('%PDF-1.4')

    const anterior = rutaDeVersionAnterior(ruta, 1)
    await mover(ruta, anterior)
    expect(await cabecera(ruta)).toBeNull()
    expect((await cabecera(anterior))?.tamano).toBe(cuerpo.length)

    await borrar(anterior)
    expect(await cabecera(anterior)).toBeNull()
  })

  it('la URL firmada no permite subir un tamaño distinto al declarado', async () => {
    const url = await firmarSubida(ruta + '.x', 10, meta)
    const r = await fetch(url, {
      method: 'PUT',
      body: 'mucho más largo que diez bytes',
      headers: { 'Content-Type': meta.contentType, 'Content-Disposition': meta.contentDisposition },
    })
    expect(r.status).toBeGreaterThanOrEqual(400)
  })

  it('subirDesdeServidor', async () => {
    await subirDesdeServidor(ruta + '.srv', 'hola', {
      contentType: 'text/plain',
      contentDisposition: 'attachment',
    })
    expect((await cabecera(ruta + '.srv'))?.tamano).toBe(4)
    await borrar(ruta + '.srv')
  })
})
