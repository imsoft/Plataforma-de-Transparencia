import { expect, test, type Page } from '@playwright/test'
import { iniciarSesion } from '../recursos/sesion'

const MAILPIT = 'http://localhost:8025'

/** Busca en Mailpit el último correo para una dirección y devuelve el primer enlace del cuerpo. */
async function enlaceDelCorreo(para: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const lista = (await (
      await fetch(`${MAILPIT}/api/v1/search?query=to:${encodeURIComponent(para)}`)
    ).json()) as { messages: { ID: string }[] }
    const id = lista.messages?.[0]?.ID
    if (id) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as {
        HTML: string
        Text: string
      }
      const m = /href="(http[^"]+)"/.exec(msg.HTML) ?? /(http\S+)/.exec(msg.Text)
      if (m) return m[1]!
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`No llegó correo para ${para}`)
}

test.describe('usuarios: invitar → aceptar → dar de baja', () => {
  test('el admin municipal invita, la persona crea su cuenta y luego se le da de baja', async ({
    page,
    browser,
  }) => {
    const correo = `nuevo-${Date.now()}@tuxcacuesco.test`
    await iniciarSesion(page, 'admin')
    await page.goto('/m/tuxcacuesco/usuarios')
    await page.getByRole('button', { name: 'Invitar usuario' }).click()
    await page.getByLabel('Correo electrónico').fill(correo)
    await page.getByRole('radio', { name: /Capturista/ }).check()
    await page.getByRole('button', { name: 'Enviar invitación' }).click()
    await expect(page.getByText(`Invitación enviada a ${correo}`)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Invitaciones pendientes' })).toBeVisible()

    // La persona invitada abre el enlace del correo en otra sesión
    const enlace = await enlaceDelCorreo(correo)
    const ctx = await browser.newContext()
    const p2 = await ctx.newPage()
    await p2.goto(enlace)
    await expect(p2.getByText(/Crea tu cuenta para/)).toBeVisible()
    await p2.getByLabel('Tu nombre completo').fill('Nuevo Capturista E2E')
    await p2.getByLabel('Contraseña', { exact: true }).fill('Contrasena-Larga-Segura-2026!')
    await p2.getByLabel('Repite la contraseña').fill('Contrasena-Larga-Segura-2026!')
    await p2.getByRole('button', { name: 'Crear cuenta y entrar' }).click()
    await p2.waitForURL(/\/m\/tuxcacuesco/)
    await expect(p2.getByRole('heading', { name: '¿Qué quieres publicar hoy?' })).toBeVisible()

    // El admin lo ve en la lista y lo da de baja
    await page.reload()
    const fila = page.getByRole('listitem').filter({ hasText: correo })
    await expect(fila).toBeVisible()
    await fila.getByRole('button', { name: /Opciones de/ }).click()
    await page.getByRole('menuitem', { name: 'Dar de baja' }).click()
    await page.getByRole('button', { name: 'Dar de baja' }).last().click()
    await expect(page.getByText('fue dado de baja')).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: correo })).toHaveCount(0)

    // Su sesión quedó revocada: al navegar lo manda a iniciar sesión
    await p2.goto('/m/tuxcacuesco')
    await p2.waitForURL(/iniciar-sesion/)
    await ctx.close()
  })
})
