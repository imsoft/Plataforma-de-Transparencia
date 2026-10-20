import './env'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { drizzle } from 'drizzle-orm/postgres-js'

const url = process.env.DATABASE_URL_MIGRACIONES
if (!url) throw new Error('Falta DATABASE_URL_MIGRACIONES')

const db = drizzle({ connection: { url, max: 1, onnotice: () => {} }, casing: 'snake_case' })
await migrate(db, { migrationsFolder: new URL('../migrations', import.meta.url).pathname })
console.info('Migraciones aplicadas')
await db.$client.end()
