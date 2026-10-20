import { expect, test } from '@playwright/test'
import { signIn } from '../fixtures/session'

const MAILPIT = 'http://localhost:8025'

test.describe('exportación completa', () => {
  test('el admin solicita el ZIP, se genera en segundo plano, llega el correo y se puede descargar', async ({
    page,
    request,
  }) => {
    await signIn(page, 'admin')
    await page.goto('/m/tuxcacuesco/exportaciones')
    await page.getByRole('button', { name: 'Generar exportación' }).click()
    await expect(page.getByText('Exportación en marcha')).toBeVisible()
    await expect
      .poll(
        async () => {
          await page.reload()
          return page.locator('a:has-text("Descargar ZIP")').count()
        },
        { timeout: 60_000, intervals: [2000] },
      )
      .toBeGreaterThan(0)
    const link = await page.locator('a:has-text("Descargar ZIP")').first().getAttribute('href')
    const zip = await request.get(link!)
    expect(zip.status()).toBe(200)
    const body = await zip.body()
    expect(body.length).toBeGreaterThan(500)
    expect(body.subarray(0, 2).toString()).toBe('PK')
    // el correo de aviso llegó a Mailpit
    const list = (await (
      await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent('Exportación completa')}`)
    ).json()) as { messages: unknown[] }
    expect(list.messages.length).toBeGreaterThan(0)
  })
})
