import '@platform/db/env'
import { describe, expect, it } from 'vitest'
import { remove, headObject, signUpload, readHead, move, uploadFromServer } from './operations'
import { filePath, previousVersionPath } from './paths'

const path = filePath({
  municipalitySlug: 'tests',
  obligatedSubjectSlug: 'ayuntamiento',
  versionFolder: 'v',
  nodeFolder: 'art-08/fr-05/inc-a',
  periodFolder: '2026-03',
  displayName: 'Prueba de subida',
  shortId: Math.random().toString(36).slice(2, 8),
  extension: 'pdf',
})
const meta = { contentType: 'application/pdf', contentDisposition: 'inline; filename="prueba.pdf"' }

describe('bucket (RustFS local)', () => {
  it('sube con URL firmada, lee cabecera e inicio, mueve a _versiones y borra', async () => {
    const body = '%PDF-1.4 contenido de prueba'
    const url = await signUpload(path, body.length, meta)
    const r = await fetch(url, {
      method: 'PUT',
      body: body,
      headers: {
        'Content-Type': meta.contentType,
        'Content-Disposition': meta.contentDisposition,
        'Content-Length': String(body.length),
      },
    })
    expect(r.status).toBe(200)

    const head = await headObject(path)
    expect(head).toEqual({ size: body.length, contentType: 'application/pdf' })
    expect(new TextDecoder().decode(await readHead(path, 8))).toBe('%PDF-1.4')

    const previous = previousVersionPath(path, 1)
    await move(path, previous)
    expect(await headObject(path)).toBeNull()
    expect((await headObject(previous))?.size).toBe(body.length)

    await remove(previous)
    expect(await headObject(previous)).toBeNull()
  })

  it('la URL firmada no permite subir un tamaño distinto al declarado', async () => {
    const url = await signUpload(path + '.x', 10, meta)
    const r = await fetch(url, {
      method: 'PUT',
      body: 'mucho más largo que diez bytes',
      headers: { 'Content-Type': meta.contentType, 'Content-Disposition': meta.contentDisposition },
    })
    expect(r.status).toBeGreaterThanOrEqual(400)
  })

  it('subirDesdeServidor', async () => {
    await uploadFromServer(path + '.srv', 'hola', {
      contentType: 'text/plain',
      contentDisposition: 'attachment',
    })
    expect((await headObject(path + '.srv'))?.size).toBe(4)
    await remove(path + '.srv')
  })
})
