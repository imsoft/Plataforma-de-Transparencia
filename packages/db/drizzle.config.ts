import './src/env'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  casing: 'snake_case',
  dbCredentials: {
    url:
      process.env.DATABASE_URL_MIGRACIONES ??
      'postgres://migraciones:migraciones@localhost:5432/transparencia',
  },
  strict: true,
  verbose: true,
})
