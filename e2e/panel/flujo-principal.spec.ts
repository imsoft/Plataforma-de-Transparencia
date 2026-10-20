import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { iniciarSesion } from '../recursos/sesion'
import { PDF_MINIMO } from '../recursos/usuarios'

const lista = (page: Page) => page.getByTestId('lista-documentos')

/** Sube un PDF en la sección 8.5.b y devuelve el nombre con el que quedó publicado. */
async function subirPdf(page: Page, nombre: string) {
  await page.getByRole('button', { name: 'Subir documento' }).click()
  await page.locator('input[type="file"]').setInputFiles({
    name: 'ESTADO_FINANCIERO_MARZO_2026.pdf',
    mimeType: 'application/pdf',
    buffer: PDF_MINIMO,
  })
  await expect(page.getByText('Archivo subido')).toBeVisible()
  const campoNombre = page.getByLabel('Nombre que verán los ciudadanos')
  await expect(campoNombre).toHaveValue('Estado Financiero Marzo 2026') // nombre sugerido desde el archivo
  await campoNombre.fill(nombre)
  await page.getByRole('button', { name: /^Publicar/ }).click()
  await expect(page.getByText('¡Listo! Ya está publicado')).toBeVisible()
}

test.describe('flujo principal: entrar → encontrar → subir → copiar enlace', () => {
  test('la capturista sube un PDF y obtiene su enlace permanente', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
    await iniciarSesion(page, 'capturista')
    await expect(page.getByRole('heading', { name: '¿Qué quieres publicar hoy?' })).toBeVisible()

    // 1. Encontrar el lugar por palabras
    await page.getByPlaceholder(/clave \(85a\)/).fill('estados financieros')
    const opcion = page
      .getByRole('option')
      .filter({ hasText: 'Los estados financieros mensuales' })
      .first()
    await expect(opcion).toBeVisible()
    await opcion.click()
    await expect(page).toHaveURL(/\/m\/tuxcacuesco\/ayuntamiento\/85b$/)

    // 2 y 3. Subir, confirmar nombre y copiar el enlace
    const nombre = `Estado financiero E2E ${Date.now()}`
    await subirPdf(page, nombre)
    await page.getByRole('button', { name: 'Copiar enlace' }).first().click()
    await expect(page.getByText('¡Enlace copiado!')).toBeVisible()
    await page.getByRole('button', { name: 'Cerrar' }).click()

    // Aparece en la lista con su ícono y tamaño
    const fila = lista(page).getByRole('listitem').filter({ hasText: nombre })
    await expect(fila).toBeVisible()
    await expect(fila.getByText(/PDF · \d+ B|PDF · \d+ KB/)).toBeVisible()
  })

  test('renombrar y mandar a la papelera con deshacer', async ({ page }) => {
    await iniciarSesion(page, 'admin')
    await page.goto('/m/tuxcacuesco/ayuntamiento/85b')
    const original = `Para renombrar E2E ${Date.now()}`
    await subirPdf(page, original)
    await page.getByRole('button', { name: 'Cerrar' }).click()
    const fila = lista(page).getByRole('listitem').filter({ hasText: original })
    await fila.getByRole('button', { name: /Más opciones/ }).click()
    await page.getByRole('menuitem', { name: 'Renombrar' }).click()
    const nuevo = `Renombrado E2E ${Date.now()}`
    await page.getByLabel('Nombre que verán los ciudadanos').fill(nuevo)
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Nombre actualizado')).toBeVisible()
    const renombrada = lista(page).getByRole('listitem').filter({ hasText: nuevo })
    await expect(renombrada).toBeVisible()

    await renombrada.getByRole('button', { name: /Más opciones/ }).click()
    await page.getByRole('menuitem', { name: 'Mandar a la papelera' }).click()
    await expect(page.getByText('Se mandó a la papelera')).toBeVisible()
    await page.getByRole('button', { name: 'Deshacer' }).click()
    await expect(lista(page).getByRole('listitem').filter({ hasText: nuevo })).toBeVisible()
  })

  test('inicio sin problemas de accesibilidad graves', async ({ page }) => {
    await iniciarSesion(page, 'capturista')
    const resultados = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze()
    const graves = resultados.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    )
    expect(graves, graves.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual([])
  })
})

test.describe('permisos', () => {
  test('la capturista no ve la sección de usuarios y no puede entrar a otro municipio', async ({
    page,
  }) => {
    await iniciarSesion(page, 'capturista')
    await expect(page.getByRole('link', { name: 'Usuarios' })).toHaveCount(0)
    const r = await page.goto('/m/otro-municipio')
    expect(r?.status()).toBe(404)
  })
})
