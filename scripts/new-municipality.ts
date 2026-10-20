/**
 * `pnpm new-municipality`: crea apps/site-<slug> a partir de una plantilla y registra el municipio en la base.
 * Idempotente: si ya existe la carpeta o el municipio, pregunta antes de tocar nada.
 */
import '@platform/db/env'
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
import { asSystem, eq } from '@platform/db'
import * as s from '@platform/db/schema'
import { isReservedRoute } from '@platform/transparency/routes'
import { randomBytes } from 'node:crypto'
import { cp, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const TEMPLATES = ['classic-institutional'] as const

async function exists(p: string) {
  return stat(p).then(
    () => true,
    () => false,
  )
}

async function replaceInTree(dir: string, map: Record<string, string>) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue
      await replaceInTree(p, map)
    } else if (/\.(ts|tsx|json|mjs|md|example)$/.test(e.name)) {
      let c = await readFile(p, 'utf8')
      for (const [k, v] of Object.entries(map)) c = c.replaceAll(k, v)
      await writeFile(p, c)
    }
  }
}

function ask<T>(v: T | symbol): T {
  if (isCancel(v)) {
    cancel('Cancelado.')
    process.exit(0)
  }
  return v as T
}

intro('Nuevo municipio')
const name = ask<string>(
  await text({
    message: 'Nombre corto del municipio',
    placeholder: 'Mascota',
    validate: (v) => ((v ?? '').trim().length < 2 ? 'Escribe el nombre' : undefined),
  }),
).trim()
const suggestedSlug = name
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
const slug = ask<string>(
  await text({
    message: 'Identificador (URL, carpetas)',
    initialValue: suggestedSlug,
    validate: (v) =>
      !/^[a-z0-9-]{3,40}$/.test(v ?? '') ? 'Minúsculas, números y guiones' : undefined,
  }),
)
const officialName = ask<string>(
  await text({ message: 'Nombre oficial', initialValue: `H. Ayuntamiento de ${name}` }),
)
const domain = ask<string>(
  await text({
    message: 'Dominio del sitio',
    placeholder: `${slug}.gob.mx`,
    validate: (v) =>
      !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(v ?? '') ? 'Sin https://, ej. mascota.gob.mx' : undefined,
  }),
)
const template = ask<(typeof TEMPLATES)[number]>(
  await select({
    message: 'Plantilla base',
    options: TEMPLATES.map((p) => ({ value: p, label: p })),
  }),
)
const extras = ask<string[]>(
  await multiselect({
    message: 'Sujetos obligados además del Ayuntamiento',
    options: [
      { value: 'dif', label: 'DIF (prefijo /dif)' },
      { value: 'agua', label: 'Organismo de agua (prefijo /agua)' },
    ],
    required: false,
  }),
)
for (const p of extras) if (isReservedRoute(p)) throw new Error(`Prefijo reservado: ${p}`)

const apps = await readdir(join(root, 'apps'))
const port = 3001 + apps.filter((a) => a.startsWith('site-')).length
const target = join(root, 'apps', `site-${slug}`)
const secret = randomBytes(24).toString('base64url')

if (await exists(target)) {
  const proceed = ask(
    await confirm({
      message: `Ya existe apps/site-${slug}. ¿Sobrescribir su código?`,
      initialValue: false,
    }),
  )
  if (!proceed) {
    cancel('No se tocó la app existente.')
    process.exit(0)
  }
}

const sp = spinner()
sp.start('Creando la app del municipio')
await cp(join(root, 'templates', template), target, {
  recursive: true,
  filter: (src) => !src.includes('node_modules') && !src.endsWith('README.md'),
})
await replaceInTree(target, {
  __SLUG__: slug,
  __NAME__: name,
  __DOMAIN__: domain,
  __PORT__: String(port),
})
await writeFile(
  join(target, '.env.local'),
  `MUNICIPALITY_SLUG=${slug}\nNEXT_PUBLIC_SITE_URL=http://localhost:${port}\nREVALIDATION_SECRET=${secret}\n`,
)
sp.stop(`apps/site-${slug} creada (puerto ${port})`)

sp.start('Registrando el municipio en la base de datos')
await asSystem(
  'generator',
  async (tx) => {
    const status = await tx.query.states.findFirst({ where: eq(s.states.key, 'JAL') })
    if (!status) throw new Error('No existe el estado JAL: corre pnpm bootstrap primero')
    const existing = await tx.query.municipalities.findFirst({
      where: eq(s.municipalities.slug, slug),
    })
    if (existing) return
    const orgId = `org_${slug}`
    await tx
      .insert(s.organization)
      .values({ id: orgId, name: name, slug, createdAt: new Date() })
      .onConflictDoNothing()
    const [m] = await tx
      .insert(s.municipalities)
      .values({
        stateId: status.id,
        organizationId: orgId,
        slug,
        name,
        officialName,
        revalidationUrl: `http://localhost:${port}/api/revalidate`,
      })
      .returning()
    await tx.insert(s.municipalityDomains).values([
      { municipalityId: m!.id, host: domain, isPrimary: true },
      { municipalityId: m!.id, host: `localhost:${port}`, isPrimary: false },
    ])
    await tx.insert(s.municipalityTheme).values({ municipalityId: m!.id, template })
    const types = await tx.query.obligatedSubjectTypes.findMany()
    const type = (typeSlug: string) => types.find((t) => t.slug === typeSlug)!.id
    await tx.insert(s.obligatedSubjects).values([
      {
        municipalityId: m!.id,
        subjectTypeId: type('ayuntamiento'),
        name: officialName,
        prefix: '',
        order: 0,
      },
      ...extras.map((p, i) => ({
        municipalityId: m!.id,
        subjectTypeId: type(p),
        name: `${p.toUpperCase()} ${name}`,
        prefix: p,
        order: i + 1,
      })),
    ])
  },
  'generator',
)
sp.stop('Municipio registrado')

note(
  [
    `1. pnpm install`,
    `2. Agrega a .env (panel): REVALIDATION_SECRETS → "${slug}": "${secret}"`,
    `3. pnpm --filter site-${slug} dev   → http://localhost:${port}`,
    `4. En Vercel: proyecto con Root Directory apps/site-${slug}, variables de .env.local y dominio ${domain}`,
    `5. Search Console, sitemap y prueba de tarjeta en WhatsApp (ver docs/checklist-alta-municipio.md)`,
  ].join('\n'),
  'Siguientes pasos',
)
outro(`Listo: ${officialName}`)
process.exit(0)
