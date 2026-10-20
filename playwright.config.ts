import { defineConfig, devices } from '@playwright/test'

/** Pruebas punta a punta contra las apps en local (Docker arriba y `pnpm bootstrap` ejecutado). */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // las pruebas comparten la base de datos local
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'tablet',
      use: { ...devices['iPad Mini'], defaultBrowserType: 'chromium' },
      testIgnore: /users|admin|videos|export|supervisor/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' },
      testIgnore: /users|admin|videos|export|supervisor/,
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter panel dev',
      url: 'http://localhost:3000/iniciar-sesion',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter site-tuxcacuesco dev',
      // ruta dinámica: así Turbopack ya la compiló antes de la primera prueba
      url: 'http://localhost:3001/85b',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
