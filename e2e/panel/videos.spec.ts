import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { iniciarSesion } from '../recursos/sesion'

test.describe('videos subidos a R2', () => {
  test('la capturista sube un MP4 por partes, se genera miniatura y el sitio lo reproduce', async ({
    page,
    request,
  }) => {
    await iniciarSesion(page, 'capturista')
    await page.goto('/m/tuxcacuesco/ayuntamiento/1511')
    await page.getByRole('button', { name: 'Subir documento' }).click()
    const video = await readFile(new URL('../recursos/video.mp4', import.meta.url))
    await page.locator('input[type="file"]').setInputFiles({
      name: 'sesion-cabildo-marzo-2026.mp4',
      mimeType: 'video/mp4',
      buffer: video,
    })
    await expect(page.getByText('Video subido')).toBeVisible({ timeout: 30_000 })
    const nombre = `Sesión de cabildo E2E ${Date.now()}`
    await page.getByLabel('Nombre que verán los ciudadanos').fill(nombre)
    await page.getByRole('button', { name: /^Publicar/ }).click()
    await expect(page.getByText('¡Listo! Ya está publicado')).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Cerrar' }).click()
    const fila = page
      .getByTestId('lista-documentos')
      .getByRole('listitem')
      .filter({ hasText: nombre })
    await expect(fila).toBeVisible()
    await expect(fila.getByText(/Video · /)).toBeVisible()

    // En el sitio: /d/<id> lleva a la página con reproductor
    const href = await fila.getByRole('link', { name: nombre }).getAttribute('href')
    const id = href!.split('/').pop()!
    const r = await request.get(`http://localhost:3001/d/${id}`, { maxRedirects: 0 })
    expect(r.status()).toBe(302)
    expect(r.headers().location).toContain(`/d/${id}/ver`)
    const ver = await request.get(`http://localhost:3001/d/${id}/ver`)
    expect(ver.status()).toBe(200)
    const html = await ver.text()
    expect(html).toContain('<video')
    expect(html).toContain('poster=')
  })
})
