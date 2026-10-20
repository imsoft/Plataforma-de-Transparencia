/**
 * `pnpm bootstrap`: levanta Docker, migra, carga el índice de prueba y crea datos semilla.
 * Idempotente: se puede correr las veces que haga falta.
 */
import '@platform/db/env'
import { execSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { seed } from './seed/seed'

const moduleRequire = createRequire(import.meta.url)
const root = new URL('..', import.meta.url).pathname

function step(title: string) {
  console.info(`\n▶ ${title}`)
}

step('Docker: Postgres, RustFS (S3) y Mailpit')
execSync('docker compose up -d --wait postgres rustfs mailpit', { cwd: root, stdio: 'inherit' })
execSync('docker compose run --rm bucket-init', { cwd: root, stdio: 'inherit' })

step('Migraciones')
execSync('pnpm --filter @platform/db migrate', { cwd: root, stdio: 'inherit' })

step('Índice de prueba y datos semilla')
const lawIndexPath = (file: string) =>
  moduleRequire.resolve(`@platform/law-index/data/sample/${file}`)
const lawIndexes = await Promise.all(
  ['city-hall.json', 'dif.json'].map(
    async (a) => JSON.parse(await readFile(lawIndexPath(a), 'utf8')) as unknown,
  ),
)
const summary = await seed({ lawIndexes })

console.info(`
✔ Listo. Entra al panel con cualquiera de estos usuarios (solo en local):
${summary.users.map((u) => `   ${u.role.padEnd(16)} ${u.email}  /  ${u.password}`).join('\n')}

   Municipio demo: ${summary.municipality}  ·  Mailpit: http://localhost:8025  ·  Consola S3 (RustFS): http://localhost:9001
`)
process.exit(0)
