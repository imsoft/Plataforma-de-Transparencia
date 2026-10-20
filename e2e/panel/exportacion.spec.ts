import { expect, test } from '@playwright/test'
import { iniciarSesion } from '../recursos/sesion'

const MAILPIT = 'http://localhost:8025'

test.describe('exportación completa', () => {
  test('el admin solicita el ZIP, se genera en segundo plano, llega el correo y se puede descargar', async ({
    page,
    request,
  }) => {
    await iniciarSesion(page, 'admin')
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
    const enlace = await page.locator('a:has-text("Descargar ZIP")').first().getAttribute('href')
    const zip = await request.get(enlace!)
    expect(zip.status()).toBe(200)
    const cuerpo = await zip.body()
    expect(cuerpo.length).toBeGreaterThan(500)
    expect(cuerpo.subarray(0, 2).toString()).toBe('PK')
    // el correo de aviso llegó a Mailpit
    const lista = (await (
      await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent('Exportación completa')}`)
    ).json()) as { messages: unknown[] }
    expect(lista.messages.length).toBeGreaterThan(0)
  })
})
