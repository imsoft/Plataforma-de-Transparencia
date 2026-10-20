/** Carga .env y .env.local de la raíz del monorepo (scripts y pruebas; las apps Next lo hacen solas). */
import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = resolve(fileURLToPath(import.meta.url), '../../../..')
config({ path: [resolve(root, '.env.local'), resolve(root, '.env')], quiet: true })

export const MONOREPO_ROOT = root
