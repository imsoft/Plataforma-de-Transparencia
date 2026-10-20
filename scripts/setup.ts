/**
 * `pnpm iniciar`: levanta Docker, migra, carga el índice de prueba y crea datos semilla.
 * Idempotente: se puede correr las veces que haga falta.
 */
import '@plataforma/db/env'
import { execSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { sembrar } from './semilla/sembrar'

const requerir = createRequire(import.meta.url)
const raiz = new URL('..', import.meta.url).pathname

function paso(titulo: string) {
  console.info(`\n▶ ${titulo}`)
}

paso('Docker: Postgres, RustFS (S3) y Mailpit')
execSync('docker compose up -d --wait postgres rustfs mailpit', { cwd: raiz, stdio: 'inherit' })
execSync('docker compose run --rm bucket-init', { cwd: raiz, stdio: 'inherit' })

paso('Migraciones')
execSync('pnpm --filter @plataforma/db migrate', { cwd: raiz, stdio: 'inherit' })

paso('Índice de prueba y datos semilla')
const rutaIndice = (archivo: string) =>
  requerir.resolve(`@plataforma/indice/datos/prueba/${archivo}`)
const indices = await Promise.all(
  ['ayuntamiento.json', 'dif.json'].map(
    async (a) => JSON.parse(await readFile(rutaIndice(a), 'utf8')) as unknown,
  ),
)
const resumen = await sembrar({ indices })

console.info(`
✔ Listo. Entra al panel con cualquiera de estos usuarios (solo en local):
${resumen.usuarios.map((u) => `   ${u.rol.padEnd(16)} ${u.email}  /  ${u.password}`).join('\n')}

   Municipio demo: ${resumen.municipio}  ·  Mailpit: http://localhost:8025  ·  Consola S3 (RustFS): http://localhost:9001
`)
process.exit(0)
