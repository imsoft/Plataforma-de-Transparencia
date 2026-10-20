import { expect, test } from '@playwright/test'
import { iniciarSesion } from '../recursos/sesion'

test.describe('tablero del supervisor y bitácora', () => {
  test('el supervisor ve avance, semáforo y pendientes de sus municipios y descarga el Excel', async ({
    page,
    request,
  }) => {
    await iniciarSesion(page, 'supervisor')
    await page.goto('/supervisor')
    await expect(page.getByRole('heading', { name: 'Tablero de municipios' })).toBeVisible()
    const tarjeta = page
      .getByRole('listitem')
      .filter({ hasText: 'H. Ayuntamiento de Tuxcacuesco' })
      .first()
    await expect(tarjeta).toBeVisible()
    await expect(tarjeta.getByText(/%$/)).toBeVisible()
    await expect(tarjeta.getByText(/al día/)).toBeVisible()
    const cookies = await page.context().cookies()
    const r = await request.get('/supervisor/reporte', {
      headers: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; ') },
    })
    expect(r.status()).toBe(200)
    expect(r.headers()['content-type']).toContain('spreadsheetml')
    expect((await r.body()).length).toBeGreaterThan(2000)
  })

  test('la bitácora del municipio se filtra por acción', async ({ page }) => {
    await iniciarSesion(page, 'admin')
    await page.goto('/m/tuxcacuesco/bitacora')
    await expect(page.getByRole('heading', { name: 'Bitácora' })).toBeVisible()
    await expect(page.getByTestId('bitacora').getByRole('listitem').first()).toBeVisible()
    await page.getByLabel('Acción').selectOption('renombrar')
    await page.getByRole('button', { name: 'Filtrar' }).click()
    await expect(page).toHaveURL(/accion=renombrar/)
    const filas = page.getByTestId('bitacora').getByRole('listitem')
    await expect(filas.first()).toContainText('Renombró')
  })

  test('la capturista no entra al tablero', async ({ page }) => {
    await iniciarSesion(page, 'capturista')
    const r = await page.goto('/supervisor')
    expect(r?.status()).toBe(404)
  })
})
