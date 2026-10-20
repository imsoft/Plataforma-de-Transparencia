import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { signIn } from '../fixtures/session'
import { MINIMAL_PDF } from '../fixtures/users'

const list = (page: Page) => page.getByTestId('document-list')

/** Sube un PDF en la sección 8.5.b y devuelve el nombre con el que quedó publicado. */
async function uploadPdf(page: Page, name: string) {
  await page.getByRole('button', { name: 'Subir documento' }).click()
  await page.locator('input[type="file"]').setInputFiles({
    name: 'ESTADO_FINANCIERO_MARZO_2026.pdf',
    mimeType: 'application/pdf',
    buffer: MINIMAL_PDF,
  })
  await expect(page.getByText('Archivo subido')).toBeVisible()
  const nameField = page.getByLabel('Nombre que verán los ciudadanos')
  await expect(nameField).toHaveValue('Estado Financiero Marzo 2026') // nombre sugerido desde el archivo
  await nameField.fill(name)
  await page.getByRole('button', { name: /^Publicar/ }).click()
  await expect(page.getByText('¡Listo! Ya está publicado')).toBeVisible()
}

test.describe('flujo principal: entrar → encontrar → subir → copiar enlace', () => {
  test('la capturista sube un PDF y obtiene su enlace permanente', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
    await signIn(page, 'uploader')
    await expect(page.getByRole('heading', { name: '¿Qué quieres publicar hoy?' })).toBeVisible()

    // 1. Encontrar el lugar por palabras
    await page.getByPlaceholder(/clave \(85a\)/).fill('estados financieros')
    const option = page
      .getByRole('option')
      .filter({ hasText: 'Los estados financieros mensuales' })
      .first()
    await expect(option).toBeVisible()
    await option.click()
    await expect(page).toHaveURL(/\/m\/tuxcacuesco\/ayuntamiento\/85b$/)

    // 2 y 3. Subir, confirmar nombre y copiar el enlace
    const name = `Estado financiero E2E ${Date.now()}`
    await uploadPdf(page, name)
    await page.getByRole('button', { name: 'Copiar enlace' }).first().click()
    await expect(page.getByText('¡Enlace copiado!')).toBeVisible()
    await page.getByRole('button', { name: 'Cerrar' }).click()

    // Aparece en la lista con su ícono y tamaño
    const row = list(page).getByRole('listitem').filter({ hasText: name })
    await expect(row).toBeVisible()
    await expect(row.getByText(/PDF · \d+ B|PDF · \d+ KB/)).toBeVisible()
  })

  test('renombrar y mandar a la papelera con deshacer', async ({ page }) => {
    await signIn(page, 'admin')
    await page.goto('/m/tuxcacuesco/ayuntamiento/85b')
    const original = `Para renombrar E2E ${Date.now()}`
    await uploadPdf(page, original)
    await page.getByRole('button', { name: 'Cerrar' }).click()
    const row = list(page).getByRole('listitem').filter({ hasText: original })
    await row.getByRole('button', { name: /Más opciones/ }).click()
    await page.getByRole('menuitem', { name: 'Renombrar' }).click()
    const newValue = `Renombrado E2E ${Date.now()}`
    await page.getByLabel('Nombre que verán los ciudadanos').fill(newValue)
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Nombre actualizado')).toBeVisible()
    const renamed = list(page).getByRole('listitem').filter({ hasText: newValue })
    await expect(renamed).toBeVisible()

    await renamed.getByRole('button', { name: /Más opciones/ }).click()
    await page.getByRole('menuitem', { name: 'Mandar a la papelera' }).click()
    await expect(page.getByText('Se mandó a la papelera')).toBeVisible()
    await page.getByRole('button', { name: 'Deshacer' }).click()
    await expect(list(page).getByRole('listitem').filter({ hasText: newValue })).toBeVisible()
  })

  test('inicio sin problemas de accesibilidad graves', async ({ page }) => {
    await signIn(page, 'uploader')
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze()
    const severe = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    )
    expect(severe, severe.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual([])
  })
})

test.describe('permisos', () => {
  test('la capturista no ve la sección de usuarios y no puede entrar a otro municipio', async ({
    page,
  }) => {
    await signIn(page, 'uploader')
    await expect(page.getByRole('link', { name: 'Usuarios' })).toHaveCount(0)
    const r = await page.goto('/m/otro-municipio')
    expect(r?.status()).toBe(404)
  })
})
