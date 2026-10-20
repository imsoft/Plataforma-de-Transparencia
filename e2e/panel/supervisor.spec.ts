import { expect, test } from '@playwright/test'
import { signIn } from '../fixtures/session'

test.describe('tablero del supervisor y bitácora', () => {
  test('el supervisor ve avance, semáforo y pendientes de sus municipios y descarga el Excel', async ({
    page,
    request,
  }) => {
    await signIn(page, 'supervisor')
    await page.goto('/supervisor')
    await expect(page.getByRole('heading', { name: 'Tablero de municipios' })).toBeVisible()
    const card = page
      .getByRole('listitem')
      .filter({ hasText: 'H. Ayuntamiento de Tuxcacuesco' })
      .first()
    await expect(card).toBeVisible()
    await expect(card.getByText(/%$/)).toBeVisible()
    await expect(card.getByText(/al día/)).toBeVisible()
    const cookies = await page.context().cookies()
    const r = await request.get('/supervisor/reporte', {
      headers: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; ') },
    })
    expect(r.status()).toBe(200)
    expect(r.headers()['content-type']).toContain('spreadsheetml')
    expect((await r.body()).length).toBeGreaterThan(2000)
  })

  test('la bitácora del municipio se filtra por acción', async ({ page }) => {
    await signIn(page, 'admin')
    await page.goto('/m/tuxcacuesco/bitacora')
    await expect(page.getByRole('heading', { name: 'Bitácora' })).toBeVisible()
    await expect(page.getByTestId('audit-log').getByRole('listitem').first()).toBeVisible()
    await page.getByLabel('Acción').selectOption('rename')
    await page.getByRole('button', { name: 'Filtrar' }).click()
    await expect(page).toHaveURL(/action=rename/)
    const rows = page.getByTestId('audit-log').getByRole('listitem')
    await expect(rows.first()).toContainText('Renombró')
  })

  test('la capturista no entra al tablero', async ({ page }) => {
    await signIn(page, 'uploader')
    const r = await page.goto('/supervisor')
    expect(r?.status()).toBe(404)
  })
})
