import { expect, type Page } from '@playwright/test'
import { totpCode, LOCAL_2FA_SECRET } from './totp'
import { USERS } from './users'

/** Inicia sesión y, si el rol exige verificación en dos pasos, la resuelve con el secreto sembrado. */
export async function signIn(page: Page, user: keyof typeof USERS) {
  await page.goto('/iniciar-sesion')
  await page.getByLabel('Correo electrónico').fill(USERS[user].email)
  await page.getByLabel('Contraseña').fill(USERS[user].password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(/\/(m\/|municipios|cuenta|verificar)/)
  if (page.url().includes('/verificar')) {
    await page.getByLabel('Código', { exact: true }).fill(totpCode(LOCAL_2FA_SECRET))
    await page.getByRole('button', { name: 'Verificar' }).click()
    await page.waitForURL(/\/(m\/|municipios|cuenta|admin)/)
  }
  await expect(page).not.toHaveURL(/cuenta\/dos-pasos/)
}
