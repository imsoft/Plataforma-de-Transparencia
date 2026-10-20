/**
 * Migración del sitio Angular de Tuxcacuesco → plataforma.
 *
 *   pnpm migrate:tuxcacuesco              → parsea el HTML, genera el índice v1 (JSON) y un reporte. No toca la nube.
 *   pnpm migrate:tuxcacuesco --verify  → además hace HEAD a cada URL y reporta enlaces rotos.
 *   pnpm migrate:tuxcacuesco --migrate     → copia cada archivo de Spaces al bucket (MinIO/R2) y crea los documentos.
 *                                           Idempotente: el id de cada documento sale de la URL original.
 *   --limit=N  procesa solo N documentos (para probar) · --concurrency=N (default 6)
 */
import '@platform/db/env'
import {
  headObject,
  contentDisposition,
  definition,
  detectType,
  filePath,
  uploadFromServer,
  typeByExtension,
} from '@platform/files'
import { asSystem, eq, and } from '@platform/db'
import * as s from '@platform/db/schema'
import { loadLawIndex, publishVersion } from '@platform/law-index/load'
import { validateLawIndex } from '@platform/law-index'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { flatten, type DocumentV1, type Source } from './flatten'
import { parseHtml } from './parse'

const ANGULAR_REPO =
  process.env.TUXCACUESCO_ANGULAR ??
  '/Users/brangarciaramos/Proyectos/imSoft/sitios-web/Municipios/Tuxcacuesco/Tuxcacuesco'
const PAGES = join(ANGULAR_REPO, 'src/app/pages')
const root = new URL('../..', import.meta.url).pathname
const OUTPUT = join(root, 'scripts/migrate-tuxcacuesco/output')
const LAW_INDEX_DATA = join(root, 'packages/law-index/data/jalisco/previous-law')

const args = new Set(process.argv.slice(2))
const option = (n: string, def: number) =>
  Number(process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1] ?? def)
const VERIFY = args.has('--verify')
const MIGRATE = args.has('--migrate')
const LIMIT = option('limit', Infinity)
const CONCURRENCY = option('concurrency', 6)

const read = (rel: string) => readFile(join(PAGES, rel), 'utf8')

async function sources(): Promise<{ cityHall: Source[]; dif: Source[] }> {
  const art8 = parseHtml(await read('transparencia/articulo-ocho/articulo-ocho.component.html'))
  // Subpáginas de estados financieros por año (componentes no enlazados en el sitio; se cuelgan de 8.V.i)
  const years: [string, string][] = [
    ['dos-mil-veinte', '2020'],
    ['dos-mil-veinti-uno', '2021'],
    ['dos-mil-veinti-dos', '2022'],
    ['dos-mil-veinti-tres', '2023'],
    ['dos-mil-veinti-cuatro', '2024'],
  ]
  const fractionV = art8.children.find((h) => /^V\./.test(h.title))
  const itemI = fractionV?.children.find((h) => /^i\)/i.test(h.title))
  for (const [folder, year] of years) {
    try {
      const sub = parseHtml(
        await read(
          `transparencia/articulo-ocho/estados-financieros-${folder}/estados-financieros-${folder}.component.html`,
        ),
        year,
      )
      if (itemI)
        itemI.children.push({
          id: `subpagina-${year}`,
          title: `Estados Financieros ${year}`,
          children: sub.children,
          links: sub.links,
        })
    } catch {
      /* sin subpágina */
    }
  }
  const art15 = parseHtml(
    await read('transparencia/articulo-quince/articulo-quince.component.html'),
  )
  const accounting = parseHtml(
    await read('transparencia/armonizacion-contable/armonizacion-contable.component.html'),
    'Armonización contable',
  )
  const dif8 = parseHtml(
    await read('transparencia-dif/articulo-ocho-dif/articulo-ocho-dif.component.html'),
  )
  return {
    cityHall: [
      { article: '8', articleTitle: cleanArticleTitle(art8.title), tree: art8 },
      { article: '15', articleTitle: cleanArticleTitle(art15.title), tree: art15 },
      {
        article: null,
        routeSlug: 'armonizacion-contable',
        articleTitle: 'Armonización contable',
        tree: accounting,
      },
    ],
    dif: [
      {
        article: '8',
        articleTitle: cleanArticleTitle(dif8.title) || 'Información fundamental – General',
        tree: dif8,
      },
    ],
  }
}
const cleanArticleTitle = (t: string) => t.replace(/^Art[íi]culo\s+\d+\.?\s*/i, '').trim()

async function main() {
  await mkdir(OUTPUT, { recursive: true })
  await mkdir(LAW_INDEX_DATA, { recursive: true })
  const f = await sources()
  const cityHallFlat = flatten(f.cityHall)
  const dif = flatten(f.dif)

  // 1. Índice v1 (JSON versionado en el repo)
  const version = {
    slug: 'ley-anterior',
    name: 'Ley de Transparencia de Jalisco (anterior a 2026)',
    validFrom: '2013-08-08',
  }
  const cityHallFile = {
    state: 'JAL',
    version,
    obligatedSubjectType: 'ayuntamiento',
    nodes: cityHallFlat.lawIndex,
  }
  const difFile = { state: 'JAL', version, obligatedSubjectType: 'dif', nodes: dif.lawIndex }
  for (const [name, file] of [
    ['ayuntamiento', cityHallFile],
    ['dif', difFile],
  ] as const) {
    const v = validateLawIndex(file)
    if (!v.ok) throw new Error(`Índice ${name} inválido:\n- ${v.errors.join('\n- ')}`)
    await writeFile(join(LAW_INDEX_DATA, `${name}.json`), JSON.stringify(file, null, 2) + '\n')
    console.info(
      `índice v1 ${name}: ${v.nodes.length} nodos → packages/law-index/data/jalisco/previous-law/${name}.json`,
    )
  }

  // 2. Documentos y reporte
  const docs = [
    ...cityHallFlat.documents.map((d) => ({ ...d, subject: 'ayuntamiento' as const })),
    ...dif.documents.map((d) => ({ ...d, subject: 'dif' as const })),
  ]
  const externals = docs.filter((d) => !/digitaloceanspaces\.com/.test(d.url))
  const notAllowed = docs.filter(
    (d) => /digitaloceanspaces\.com/.test(d.url) && !typeByExtension(decodeURIComponent(d.url)),
  )
  const withWarnings = docs.filter((d) => d.warnings.length > 0)
  let brokenLinks: typeof docs = []
  if (VERIFY) {
    console.info(`verificando ${docs.length} URLs (HEAD)…`)
    brokenLinks = await inBatches(docs, CONCURRENCY, async (d) => {
      if (externals.includes(d)) return null
      try {
        const r = await fetch(d.url, { method: 'HEAD', signal: AbortSignal.timeout(15000) })
        return r.ok ? null : d
      } catch {
        return d
      }
    })
  }
  await writeFile(join(OUTPUT, 'documentos.json'), JSON.stringify(docs, null, 2))
  const report = [
    `# Reporte de migración de Tuxcacuesco`,
    ``,
    `- Documentos encontrados: ${docs.length} (Ayuntamiento ${cityHallFlat.documents.length}, DIF ${dif.documents.length})`,
    `- Enlaces externos (no son archivos de Spaces, ej. mega.nz): ${externals.length}`,
    `- Tipos no permitidos (.xlsm, .rar…): ${notAllowed.length}`,
    `- Con advertencias (nombres/URLs con caracteres rotos, repetidos): ${withWarnings.length}`,
    VERIFY
      ? `- Enlaces rotos (HEAD ≠ 200): ${brokenLinks.length}`
      : `- Enlaces rotos: (corre con --verify)`,
    ``,
    `## Enlaces externos`,
    ...externals.map((d) => `- ${d.nodeKey} · ${d.name} · ${d.url}`),
    ``,
    `## Tipos no permitidos`,
    ...notAllowed.map((d) => `- ${d.nodeKey} · ${d.name} · ${d.url}`),
    ``,
    `## Advertencias`,
    ...withWarnings.map((d) => `- ${d.nodeKey} · ${d.name} · ${d.warnings.join('; ')} · ${d.url}`),
    ``,
    `## Enlaces rotos`,
    ...brokenLinks.map((d) => `- ${d.nodeKey} · ${d.name} · ${d.url}`),
    ``,
  ].join('\n')
  await writeFile(join(OUTPUT, 'reporte.md'), report)
  console.info(report.split('\n').slice(0, 8).join('\n'))
  console.info(`reporte completo: scripts/migrate-tuxcacuesco/output/reporte.md`)

  if (!MIGRATE) return

  // 3. Migrar: cargar índice, copiar archivos y crear documentos (idempotente)
  await asSystem('migracion:tuxcacuesco', async (tx) => {
    for (const file of [cityHallFile, difFile]) {
      const r = await loadLawIndex(tx, file, {
        typeName: file.obligatedSubjectType === 'dif' ? 'DIF' : 'Ayuntamiento',
      })
      console.info(
        `índice ${file.obligatedSubjectType}: +${r.created} ~${r.updated} -${r.deactivated}`,
      )
      const v = await tx.query.lawIndexVersions.findFirst({
        where: eq(s.lawIndexVersions.id, r.versionId),
      })
      if (v?.status === 'draft') await publishVersion(tx, r.versionId)
    }
  })

  const migratable = docs
    .filter((d) => !externals.includes(d) && !notAllowed.includes(d))
    .slice(0, LIMIT)
  const equivalences: string[] = ['url_original,enlace_nuevo']
  let doneCount = 0
  let skipped = 0
  let failed = 0
  await inBatches(migratable, CONCURRENCY, async (d) => {
    try {
      const r = await migrateOne(d)
      equivalences.push(`${d.url},/d/${d.id}`)
      if (r === 'existing') skipped++
      else doneCount++
      if ((doneCount + skipped) % 50 === 0)
        console.info(`  ${doneCount + skipped}/${migratable.length}`)
    } catch (e) {
      failed++
      console.error(`  ✖ ${d.nodeKey} ${d.name}: ${(e as Error).message}`)
    }
    return null
  })
  await writeFile(join(OUTPUT, 'equivalencias.csv'), equivalences.join('\n'))
  console.info(
    `migrados ${doneCount}, ya existían ${skipped}, fallidos ${failed}. CSV: scripts/migrate-tuxcacuesco/output/equivalencias.csv`,
  )
}

async function migrateOne(
  d: DocumentV1 & { subject: 'ayuntamiento' | 'dif' },
): Promise<'created' | 'existing'> {
  return asSystem('migracion:tuxcacuesco', async (tx) => {
    const existing = await tx.query.documents.findFirst({ where: eq(s.documents.id, d.id) })
    if (existing) return 'existing'
    const municipality = await tx.query.municipalities.findFirst({
      where: eq(s.municipalities.slug, 'tuxcacuesco'),
      with: { obligatedSubjects: { with: { type: true } } },
    })
    if (!municipality) throw new Error('No existe el municipio tuxcacuesco (corre pnpm bootstrap)')
    const so = municipality.obligatedSubjects.find((x) => x.type.slug === d.subject)
    if (!so) throw new Error(`Sin sujeto obligado ${d.subject}`)
    const version = await tx.query.lawIndexVersions.findFirst({
      where: and(
        eq(s.lawIndexVersions.stateId, municipality.stateId),
        eq(s.lawIndexVersions.slug, 'ley-anterior'),
      ),
    })
    if (!version) throw new Error('Sin versión ley-anterior')
    const [section, sub] = d.nodeKey.includes('/') ? d.nodeKey.split('/') : [null, null]
    const node = section
      ? await tx.query.lawIndexNodes.findFirst({
          where: and(
            eq(s.lawIndexNodes.versionId, version.id),
            eq(s.lawIndexNodes.subjectTypeId, so.subjectTypeId),
            eq(s.lawIndexNodes.storageFolder, `${section}/${sub}`),
          ),
        })
      : await tx.query.lawIndexNodes.findFirst({
          where: and(
            eq(s.lawIndexNodes.versionId, version.id),
            eq(s.lawIndexNodes.subjectTypeId, so.subjectTypeId),
            eq(s.lawIndexNodes.key, d.nodeKey),
          ),
        })
    if (!node) throw new Error(`Nodo ${d.nodeKey} no existe en el índice`)

    // descargar de Spaces
    const r = await fetch(d.url, { signal: AbortSignal.timeout(120000) })
    if (!r.ok) throw new Error(`HTTP ${r.status} al descargar`)
    const bytes = new Uint8Array(await r.arrayBuffer())
    const originalName = decodeURIComponent(d.url.split('/').pop() ?? 'archivo')
    const detection = await detectType(bytes.slice(0, 4100), originalName)
    if (!detection.ok) throw new Error(detection.reason)
    const def = definition(detection.type.type)
    const ext = originalName.split('.').pop()!.toLowerCase()
    const path = filePath({
      municipalitySlug: 'tuxcacuesco',
      obligatedSubjectSlug: so.prefix || so.type.slug,
      versionFolder: version.storageFolder,
      nodeFolder: node.storageFolder,
      periodFolder: d.periodFolder,
      displayName: d.name,
      shortId: d.id.slice(0, 6),
      extension: ext,
    })
    if (!(await headObject(path)))
      await uploadFromServer(path, bytes, {
        contentType: detection.mime,
        contentDisposition: contentDisposition(def.disposition, d.name, ext),
      })

    await tx.insert(s.documents).values({
      id: d.id,
      municipalityId: municipality.id,
      obligatedSubjectId: so.id,
      nodeId: node.id,
      name: d.name,
      periodLabel: d.periodLabel,
      periodStart: d.periodStart,
      periodEnd: null,
      periodFolder: d.periodFolder,
      status: 'published',
      type: 'file',
      publishedAt: new Date(),
    })
    const [v] = await tx
      .insert(s.documentVersions)
      .values({
        documentId: d.id,
        number: 1,
        storagePath: path,
        originalName,
        mime: detection.mime,
        fileType: def.type,
        size: bytes.byteLength,
        hashSha256: createHash('sha256').update(bytes).digest('hex'),
      })
      .returning()
    await tx.update(s.documents).set({ currentVersionId: v!.id }).where(eq(s.documents.id, d.id))
    return 'created'
  })
}

async function inBatches<T, R>(
  items: T[],
  n: number,
  fn: (t: T) => Promise<R | null>,
): Promise<NonNullable<R>[]> {
  const output: NonNullable<R>[] = []
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const item = items[i++]!
        const r = await fn(item)
        if (r != null) output.push(r as NonNullable<R>)
      }
    }),
  )
  return output
}

await main()
process.exit(0)
