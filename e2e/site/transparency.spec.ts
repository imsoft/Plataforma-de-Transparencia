import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const SITE = 'http://localhost:3001'
const OG = [
  'og:title',
  'og:description',
  'og:image',
  'og:image:width',
  'og:image:height',
  'og:image:alt',
  'og:url',
  'og:type',
  'og:site_name',
  'og:locale',
]

test.describe('sitio público de transparencia', () => {
  test('inciso /85b: estructura, breadcrumb, canónica y Open Graph completo', async ({ page }) => {
    await page.goto(`${SITE}/85b`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Los estados financieros mensuales',
    )
    await expect(page.getByRole('navigation', { name: 'Ubicación' })).toContainText('Transparencia')
    expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toBe(`${SITE}/85b`)
    // los metadatos se insertan en streaming: esperar a que aparezcan
    for (const p of OG) await expect(page.locator(`meta[property="${p}"]`), p).toHaveCount(1)
    expect(await page.locator('meta[property="og:locale"]').getAttribute('content')).toBe('es_MX')
    expect(await page.locator('meta[name="twitter:card"]').getAttribute('content')).toBe(
      'summary_large_image',
    )
    expect(await page.locator('h1').count()).toBe(1)
    expect(await page.locator('html').getAttribute('lang')).toBe('es-MX')
  })

  test('variantes de clave redirigen 301 a la canónica', async ({ request }) => {
    for (const [de, a] of [
      ['/85B', '/85b'],
      ['/8.5b', '/85b'],
      ['/8-5-b', '/85b'],
      ['/dif/8.V.b', '/dif/85b'],
    ]) {
      const r = await request.get(`${SITE}${de}`, { maxRedirects: 0 })
      expect(r.status(), de).toBe(308)
      expect(r.headers().location, de).toBe(a)
    }
  })

  test('la imagen de la tarjeta responde 200, es PNG y pesa menos de 300 KB', async ({
    page,
    request,
  }) => {
    await page.goto(`${SITE}/85b`)
    const url = await page.locator('meta[property="og:image"]').getAttribute('content')
    const r = await request.get(url!)
    expect(r.status()).toBe(200)
    expect(r.headers()['content-type']).toContain('image/png')
    expect((await r.body()).length).toBeLessThan(300 * 1024)
  })

  test('/d/<id>: redirige a las personas y da HTML con Open Graph a WhatsApp', async ({
    page,
    request,
  }) => {
    await page.goto(`${SITE}/85b`)
    const href = await page.locator('a[href^="/d/"]').first().getAttribute('href')
    test.skip(!href, 'No hay documentos publicados en 8.5.b')
    const person = await request.get(`${SITE}${href}`, { maxRedirects: 0 })
    expect(person.status()).toBe(302)
    expect(person.headers().location).toMatch(/^http.*\.pdf$/)
    const bot = await request.get(`${SITE}${href}`, {
      maxRedirects: 0,
      headers: { 'user-agent': 'WhatsApp/2.23.20.0 A' },
    })
    expect(bot.status()).toBe(200)
    const html = await bot.text()
    for (const p of ['og:title', 'og:description', 'og:image', 'og:url'])
      expect(html, p).toContain(`property="${p}"`)
    // Googlebot NO recibe la página especial (sería cloaking)
    const google = await request.get(`${SITE}${href}`, {
      maxRedirects: 0,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
    })
    expect(google.status()).toBe(302)
  })

  test('404 útil con sugerencia de clave', async ({ page }) => {
    const r = await page.goto(`${SITE}/85x9`)
    expect(r?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: 'No encontramos esa página' })).toBeVisible()
    await expect(page.getByText('¿Buscabas alguna de estas secciones?')).toBeVisible()
  })

  test('portada del DIF y sitemap', async ({ page, request }) => {
    await page.goto(`${SITE}/dif`)
    await expect(page.getByRole('heading', { level: 1, name: 'Transparencia' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Sujetos obligados' })).toContainText('DIF')
    const sm = await request.get(`${SITE}/sitemap.xml`)
    expect(sm.status()).toBe(200)
    expect(await sm.text()).toContain('/dif/85b')
  })

  test('accesibilidad sin problemas graves en inciso y portada', async ({ page }) => {
    for (const path of ['/transparencia', '/85b']) {
      await page.goto(`${SITE}${path}`, { waitUntil: 'networkidle' })
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
      const severe = r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
      expect(severe, `${path}: ${severe.map((v) => `${v.id}: ${v.help}`).join('\n')}`).toEqual([])
    }
  })
})
