import './src/env'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  casing: 'snake_case',
  dbCredentials: {
    url:
      process.env.DATABASE_URL_MIGRATIONS ??
      'postgres://migrator:migrator@localhost:5432/transparency',
  },
  strict: true,
  verbose: true,
})
