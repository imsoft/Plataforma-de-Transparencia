import { expect, type Page } from '@playwright/test'
import { codigoTotp, SECRETO_2FA_LOCAL } from './totp'
import { USUARIOS } from './usuarios'

/** Inicia sesión y, si el rol exige verificación en dos pasos, la resuelve con el secreto sembrado. */
export async function iniciarSesion(page: Page, usuario: keyof typeof USUARIOS) {
  await page.goto('/iniciar-sesion')
  await page.getByLabel('Correo electrónico').fill(USUARIOS[usuario].email)
  await page.getByLabel('Contraseña').fill(USUARIOS[usuario].password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(/\/(m\/|municipios|cuenta|verificar)/)
  if (page.url().includes('/verificar')) {
    await page.getByLabel('Código', { exact: true }).fill(codigoTotp(SECRETO_2FA_LOCAL))
    await page.getByRole('button', { name: 'Verificar' }).click()
    await page.waitForURL(/\/(m\/|municipios|cuenta|admin)/)
  }
  await expect(page).not.toHaveURL(/cuenta\/dos-pasos/)
}
