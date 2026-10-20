import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    fileParallelism: false, // todas las pruebas comparten la base de Docker
    testTimeout: 20_000,
  },
})
