/**
 * `pnpm nuevo-municipio`: crea apps/sitio-<slug> a partir de una plantilla y registra el municipio en la base.
 * Idempotente: si ya existe la carpeta o el municipio, pregunta antes de tocar nada.
 */
import '@plataforma/db/env'
import {
  cancel,
  confirm,
  intro,
  isCancel,
  multiselect,
  note,
  outro,
  select,
  spinner,
  text,
} from '@clack/prompts'
import { comoSistema, eq } from '@plataforma/db'
import * as s from '@plataforma/db/schema'
import { esRutaReservada } from '@plataforma/transparencia/rutas'
import { randomBytes } from 'node:crypto'
import { cp, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const raiz = new URL('..', import.meta.url).pathname
const PLANTILLAS = ['institucional-clasica'] as const

async function existe(p: string) {
  return stat(p).then(
    () => true,
    () => false,
  )
}

async function reemplazarEnArbol(dir: string, mapa: Record<string, string>) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue
      await reemplazarEnArbol(p, mapa)
    } else if (/\.(ts|tsx|json|mjs|md|example)$/.test(e.name)) {
      let c = await readFile(p, 'utf8')
      for (const [k, v] of Object.entries(mapa)) c = c.replaceAll(k, v)
      await writeFile(p, c)
    }
  }
}

function pedir<T>(v: T | symbol): T {
  if (isCancel(v)) {
    cancel('Cancelado.')
    process.exit(0)
  }
  return v as T
}

intro('Nuevo municipio')
const nombre = pedir<string>(
  await text({
    message: 'Nombre corto del municipio',
    placeholder: 'Mascota',
    validate: (v) => ((v ?? '').trim().length < 2 ? 'Escribe el nombre' : undefined),
  }),
).trim()
const slugSugerido = nombre
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
const slug = pedir<string>(
  await text({
    message: 'Identificador (URL, carpetas)',
    initialValue: slugSugerido,
    validate: (v) =>
      !/^[a-z0-9-]{3,40}$/.test(v ?? '') ? 'Minúsculas, números y guiones' : undefined,
  }),
)
const nombreOficial = pedir<string>(
  await text({ message: 'Nombre oficial', initialValue: `H. Ayuntamiento de ${nombre}` }),
)
const dominio = pedir<string>(
  await text({
    message: 'Dominio del sitio',
    placeholder: `${slug}.gob.mx`,
    validate: (v) =>
      !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(v ?? '') ? 'Sin https://, ej. mascota.gob.mx' : undefined,
  }),
)
const plantilla = pedir<(typeof PLANTILLAS)[number]>(
  await select({
    message: 'Plantilla base',
    options: PLANTILLAS.map((p) => ({ value: p, label: p })),
  }),
)
const extras = pedir<string[]>(
  await multiselect({
    message: 'Sujetos obligados además del Ayuntamiento',
    options: [
      { value: 'dif', label: 'DIF (prefijo /dif)' },
      { value: 'agua', label: 'Organismo de agua (prefijo /agua)' },
    ],
    required: false,
  }),
)
for (const p of extras) if (esRutaReservada(p)) throw new Error(`Prefijo reservado: ${p}`)

const apps = await readdir(join(raiz, 'apps'))
const puerto = 3001 + apps.filter((a) => a.startsWith('sitio-')).length
const destino = join(raiz, 'apps', `sitio-${slug}`)
const secreto = randomBytes(24).toString('base64url')

if (await existe(destino)) {
  const seguir = pedir(
    await confirm({
      message: `Ya existe apps/sitio-${slug}. ¿Sobrescribir su código?`,
      initialValue: false,
    }),
  )
  if (!seguir) {
    cancel('No se tocó la app existente.')
    process.exit(0)
  }
}

const sp = spinner()
sp.start('Creando la app del municipio')
await cp(join(raiz, 'templates', plantilla), destino, {
  recursive: true,
  filter: (src) => !src.includes('node_modules') && !src.endsWith('README.md'),
})
await reemplazarEnArbol(destino, {
  __SLUG__: slug,
  __NOMBRE__: nombre,
  __DOMINIO__: dominio,
  __PUERTO__: String(puerto),
})
await writeFile(
  join(destino, '.env.local'),
  `MUNICIPIO_SLUG=${slug}\nNEXT_PUBLIC_SITIO_URL=http://localhost:${puerto}\nREVALIDACION_SECRETO=${secreto}\n`,
)
sp.stop(`apps/sitio-${slug} creada (puerto ${puerto})`)

sp.start('Registrando el municipio en la base de datos')
await comoSistema(
  'generador',
  async (tx) => {
    const estado = await tx.query.estados.findFirst({ where: eq(s.estados.clave, 'JAL') })
    if (!estado) throw new Error('No existe el estado JAL: corre pnpm iniciar primero')
    const existente = await tx.query.municipios.findFirst({ where: eq(s.municipios.slug, slug) })
    if (existente) return
    const orgId = `org_${slug}`
    await tx
      .insert(s.organization)
      .values({ id: orgId, name: nombre, slug, createdAt: new Date() })
      .onConflictDoNothing()
    const [m] = await tx
      .insert(s.municipios)
      .values({
        estadoId: estado.id,
        organizationId: orgId,
        slug,
        nombre,
        nombreOficial,
        urlRevalidacion: `http://localhost:${puerto}/api/revalidar`,
      })
      .returning()
    await tx.insert(s.municipioDominios).values([
      { municipioId: m!.id, host: dominio, principal: true },
      { municipioId: m!.id, host: `localhost:${puerto}`, principal: false },
    ])
    await tx.insert(s.municipioTema).values({ municipioId: m!.id, plantilla })
    const tipos = await tx.query.tiposSujetoObligado.findMany()
    const tipo = (slugTipo: string) => tipos.find((t) => t.slug === slugTipo)!.id
    await tx.insert(s.sujetosObligados).values([
      {
        municipioId: m!.id,
        tipoSujetoId: tipo('ayuntamiento'),
        nombre: nombreOficial,
        prefijo: '',
        orden: 0,
      },
      ...extras.map((p, i) => ({
        municipioId: m!.id,
        tipoSujetoId: tipo(p),
        nombre: `${p.toUpperCase()} ${nombre}`,
        prefijo: p,
        orden: i + 1,
      })),
    ])
  },
  'generador',
)
sp.stop('Municipio registrado')

note(
  [
    `1. pnpm install`,
    `2. Agrega a .env (panel): REVALIDACION_SECRETOS → "${slug}": "${secreto}"`,
    `3. pnpm --filter sitio-${slug} dev   → http://localhost:${puerto}`,
    `4. En Vercel: proyecto con Root Directory apps/sitio-${slug}, variables de .env.local y dominio ${dominio}`,
    `5. Search Console, sitemap y prueba de tarjeta en WhatsApp (ver docs/checklist-alta-municipio.md)`,
  ].join('\n'),
  'Siguientes pasos',
)
outro(`Listo: ${nombreOficial}`)
process.exit(0)
