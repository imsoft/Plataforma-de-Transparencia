/** Carga .env y .env.local de la raíz del monorepo (scripts y pruebas; las apps Next lo hacen solas). */
import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const raiz = resolve(fileURLToPath(import.meta.url), '../../../..')
config({ path: [resolve(raiz, '.env.local'), resolve(raiz, '.env')], quiet: true })

export const RAIZ_MONOREPO = raiz
