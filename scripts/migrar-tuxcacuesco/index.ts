/**
 * Migración del sitio Angular de Tuxcacuesco → plataforma.
 *
 *   pnpm migrar:tuxcacuesco              → parsea el HTML, genera el índice v1 (JSON) y un reporte. No toca la nube.
 *   pnpm migrar:tuxcacuesco --verificar  → además hace HEAD a cada URL y reporta enlaces rotos.
 *   pnpm migrar:tuxcacuesco --migrar     → copia cada archivo de Spaces al bucket (MinIO/R2) y crea los documentos.
 *                                           Idempotente: el id de cada documento sale de la URL original.
 *   --limite=N  procesa solo N documentos (para probar) · --concurrencia=N (default 6)
 */
import '@plataforma/db/env'
import {
  cabecera,
  contentDisposition,
  definicion,
  detectarTipo,
  rutaDeArchivo,
  subirDesdeServidor,
  tipoPorExtension,
} from '@plataforma/archivos'
import { comoSistema, eq, and } from '@plataforma/db'
import * as s from '@plataforma/db/schema'
import { cargarIndice, publicarVersion } from '@plataforma/indice/cargar'
import { validarIndice } from '@plataforma/indice'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { aplanar, type DocumentoV1, type Fuente } from './aplanar'
import { parsearHtml } from './parsear'

const REPO_ANGULAR =
  process.env.TUXCACUESCO_ANGULAR ??
  '/Users/brangarciaramos/Proyectos/imSoft/sitios-web/Municipios/Tuxcacuesco/Tuxcacuesco'
const PAGES = join(REPO_ANGULAR, 'src/app/pages')
const raiz = new URL('../..', import.meta.url).pathname
const SALIDA = join(raiz, 'scripts/migrar-tuxcacuesco/salida')
const DATOS_INDICE = join(raiz, 'packages/indice/datos/jalisco/ley-anterior')

const args = new Set(process.argv.slice(2))
const opcion = (n: string, def: number) =>
  Number(process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1] ?? def)
const VERIFICAR = args.has('--verificar')
const MIGRAR = args.has('--migrar')
const LIMITE = opcion('limite', Infinity)
const CONCURRENCIA = opcion('concurrencia', 6)

const leer = (rel: string) => readFile(join(PAGES, rel), 'utf8')

async function fuentes(): Promise<{ ayuntamiento: Fuente[]; dif: Fuente[] }> {
  const art8 = parsearHtml(await leer('transparencia/articulo-ocho/articulo-ocho.component.html'))
  // Subpáginas de estados financieros por año (componentes no enlazados en el sitio; se cuelgan de 8.V.i)
  const anios: [string, string][] = [
    ['dos-mil-veinte', '2020'],
    ['dos-mil-veinti-uno', '2021'],
    ['dos-mil-veinti-dos', '2022'],
    ['dos-mil-veinti-tres', '2023'],
    ['dos-mil-veinti-cuatro', '2024'],
  ]
  const frV = art8.hijos.find((h) => /^V\./.test(h.titulo))
  const incI = frV?.hijos.find((h) => /^i\)/i.test(h.titulo))
  for (const [carpeta, anio] of anios) {
    try {
      const sub = parsearHtml(
        await leer(
          `transparencia/articulo-ocho/estados-financieros-${carpeta}/estados-financieros-${carpeta}.component.html`,
        ),
        anio,
      )
      if (incI)
        incI.hijos.push({
          id: `subpagina-${anio}`,
          titulo: `Estados Financieros ${anio}`,
          hijos: sub.hijos,
          enlaces: sub.enlaces,
        })
    } catch {
      /* sin subpágina */
    }
  }
  const art15 = parsearHtml(
    await leer('transparencia/articulo-quince/articulo-quince.component.html'),
  )
  const armon = parsearHtml(
    await leer('transparencia/armonizacion-contable/armonizacion-contable.component.html'),
    'Armonización contable',
  )
  const dif8 = parsearHtml(
    await leer('transparencia-dif/articulo-ocho-dif/articulo-ocho-dif.component.html'),
  )
  return {
    ayuntamiento: [
      { articulo: '8', tituloArticulo: limpiarTituloArt(art8.titulo), arbol: art8 },
      { articulo: '15', tituloArticulo: limpiarTituloArt(art15.titulo), arbol: art15 },
      {
        articulo: null,
        rutaSlug: 'armonizacion-contable',
        tituloArticulo: 'Armonización contable',
        arbol: armon,
      },
    ],
    dif: [
      {
        articulo: '8',
        tituloArticulo: limpiarTituloArt(dif8.titulo) || 'Información fundamental – General',
        arbol: dif8,
      },
    ],
  }
}
const limpiarTituloArt = (t: string) => t.replace(/^Art[íi]culo\s+\d+\.?\s*/i, '').trim()

async function main() {
  await mkdir(SALIDA, { recursive: true })
  await mkdir(DATOS_INDICE, { recursive: true })
  const f = await fuentes()
  const ayto = aplanar(f.ayuntamiento)
  const dif = aplanar(f.dif)

  // 1. Índice v1 (JSON versionado en el repo)
  const version = {
    slug: 'ley-anterior',
    nombre: 'Ley de Transparencia de Jalisco (anterior a 2026)',
    vigenciaDesde: '2013-08-08',
  }
  const archivoAyto = {
    estado: 'JAL',
    version,
    tipoSujetoObligado: 'ayuntamiento',
    nodos: ayto.indice,
  }
  const archivoDif = { estado: 'JAL', version, tipoSujetoObligado: 'dif', nodos: dif.indice }
  for (const [nombre, archivo] of [
    ['ayuntamiento', archivoAyto],
    ['dif', archivoDif],
  ] as const) {
    const v = validarIndice(archivo)
    if (!v.ok) throw new Error(`Índice ${nombre} inválido:\n- ${v.errores.join('\n- ')}`)
    await writeFile(join(DATOS_INDICE, `${nombre}.json`), JSON.stringify(archivo, null, 2) + '\n')
    console.info(
      `índice v1 ${nombre}: ${v.nodos.length} nodos → packages/indice/datos/jalisco/ley-anterior/${nombre}.json`,
    )
  }

  // 2. Documentos y reporte
  const docs = [
    ...ayto.documentos.map((d) => ({ ...d, sujeto: 'ayuntamiento' as const })),
    ...dif.documentos.map((d) => ({ ...d, sujeto: 'dif' as const })),
  ]
  const externos = docs.filter((d) => !/digitaloceanspaces\.com/.test(d.url))
  const noPermitidos = docs.filter(
    (d) => /digitaloceanspaces\.com/.test(d.url) && !tipoPorExtension(decodeURIComponent(d.url)),
  )
  const conAdvertencias = docs.filter((d) => d.advertencias.length > 0)
  let rotos: typeof docs = []
  if (VERIFICAR) {
    console.info(`verificando ${docs.length} URLs (HEAD)…`)
    rotos = await enLotes(docs, CONCURRENCIA, async (d) => {
      if (externos.includes(d)) return null
      try {
        const r = await fetch(d.url, { method: 'HEAD', signal: AbortSignal.timeout(15000) })
        return r.ok ? null : d
      } catch {
        return d
      }
    })
  }
  await writeFile(join(SALIDA, 'documentos.json'), JSON.stringify(docs, null, 2))
  const reporte = [
    `# Reporte de migración de Tuxcacuesco`,
    ``,
    `- Documentos encontrados: ${docs.length} (Ayuntamiento ${ayto.documentos.length}, DIF ${dif.documentos.length})`,
    `- Enlaces externos (no son archivos de Spaces, ej. mega.nz): ${externos.length}`,
    `- Tipos no permitidos (.xlsm, .rar…): ${noPermitidos.length}`,
    `- Con advertencias (nombres/URLs con caracteres rotos, repetidos): ${conAdvertencias.length}`,
    VERIFICAR
      ? `- Enlaces rotos (HEAD ≠ 200): ${rotos.length}`
      : `- Enlaces rotos: (corre con --verificar)`,
    ``,
    `## Enlaces externos`,
    ...externos.map((d) => `- ${d.claveNodo} · ${d.nombre} · ${d.url}`),
    ``,
    `## Tipos no permitidos`,
    ...noPermitidos.map((d) => `- ${d.claveNodo} · ${d.nombre} · ${d.url}`),
    ``,
    `## Advertencias`,
    ...conAdvertencias.map(
      (d) => `- ${d.claveNodo} · ${d.nombre} · ${d.advertencias.join('; ')} · ${d.url}`,
    ),
    ``,
    `## Enlaces rotos`,
    ...rotos.map((d) => `- ${d.claveNodo} · ${d.nombre} · ${d.url}`),
    ``,
  ].join('\n')
  await writeFile(join(SALIDA, 'reporte.md'), reporte)
  console.info(reporte.split('\n').slice(0, 8).join('\n'))
  console.info(`reporte completo: scripts/migrar-tuxcacuesco/salida/reporte.md`)

  if (!MIGRAR) return

  // 3. Migrar: cargar índice, copiar archivos y crear documentos (idempotente)
  await comoSistema('migracion:tuxcacuesco', async (tx) => {
    for (const archivo of [archivoAyto, archivoDif]) {
      const r = await cargarIndice(tx, archivo, {
        nombreTipo: archivo.tipoSujetoObligado === 'dif' ? 'DIF' : 'Ayuntamiento',
      })
      console.info(
        `índice ${archivo.tipoSujetoObligado}: +${r.creados} ~${r.actualizados} -${r.desactivados}`,
      )
      const v = await tx.query.indiceVersiones.findFirst({
        where: eq(s.indiceVersiones.id, r.versionId),
      })
      if (v?.estatus === 'borrador') await publicarVersion(tx, r.versionId)
    }
  })

  const migrables = docs
    .filter((d) => !externos.includes(d) && !noPermitidos.includes(d))
    .slice(0, LIMITE)
  const equivalencias: string[] = ['url_original,enlace_nuevo']
  let hechos = 0
  let saltados = 0
  let fallidos = 0
  await enLotes(migrables, CONCURRENCIA, async (d) => {
    try {
      const r = await migrarUno(d)
      equivalencias.push(`${d.url},/d/${d.id}`)
      if (r === 'existente') saltados++
      else hechos++
      if ((hechos + saltados) % 50 === 0) console.info(`  ${hechos + saltados}/${migrables.length}`)
    } catch (e) {
      fallidos++
      console.error(`  ✖ ${d.claveNodo} ${d.nombre}: ${(e as Error).message}`)
    }
    return null
  })
  await writeFile(join(SALIDA, 'equivalencias.csv'), equivalencias.join('\n'))
  console.info(
    `migrados ${hechos}, ya existían ${saltados}, fallidos ${fallidos}. CSV: scripts/migrar-tuxcacuesco/salida/equivalencias.csv`,
  )
}

async function migrarUno(
  d: DocumentoV1 & { sujeto: 'ayuntamiento' | 'dif' },
): Promise<'creado' | 'existente'> {
  return comoSistema('migracion:tuxcacuesco', async (tx) => {
    const existente = await tx.query.documentos.findFirst({ where: eq(s.documentos.id, d.id) })
    if (existente) return 'existente'
    const municipio = await tx.query.municipios.findFirst({
      where: eq(s.municipios.slug, 'tuxcacuesco'),
      with: { sujetosObligados: { with: { tipo: true } } },
    })
    if (!municipio) throw new Error('No existe el municipio tuxcacuesco (corre pnpm iniciar)')
    const so = municipio.sujetosObligados.find((x) => x.tipo.slug === d.sujeto)
    if (!so) throw new Error(`Sin sujeto obligado ${d.sujeto}`)
    const version = await tx.query.indiceVersiones.findFirst({
      where: and(
        eq(s.indiceVersiones.estadoId, municipio.estadoId),
        eq(s.indiceVersiones.slug, 'ley-anterior'),
      ),
    })
    if (!version) throw new Error('Sin versión ley-anterior')
    const [seccion, sub] = d.claveNodo.includes('/') ? d.claveNodo.split('/') : [null, null]
    const nodo = seccion
      ? await tx.query.indiceNodos.findFirst({
          where: and(
            eq(s.indiceNodos.versionId, version.id),
            eq(s.indiceNodos.tipoSujetoId, so.tipoSujetoId),
            eq(s.indiceNodos.carpetaR2, `${seccion}/${sub}`),
          ),
        })
      : await tx.query.indiceNodos.findFirst({
          where: and(
            eq(s.indiceNodos.versionId, version.id),
            eq(s.indiceNodos.tipoSujetoId, so.tipoSujetoId),
            eq(s.indiceNodos.clave, d.claveNodo),
          ),
        })
    if (!nodo) throw new Error(`Nodo ${d.claveNodo} no existe en el índice`)

    // descargar de Spaces
    const r = await fetch(d.url, { signal: AbortSignal.timeout(120000) })
    if (!r.ok) throw new Error(`HTTP ${r.status} al descargar`)
    const bytes = new Uint8Array(await r.arrayBuffer())
    const nombreOriginal = decodeURIComponent(d.url.split('/').pop() ?? 'archivo')
    const det = await detectarTipo(bytes.slice(0, 4100), nombreOriginal)
    if (!det.ok) throw new Error(det.motivo)
    const def = definicion(det.tipo.tipo)
    const ext = nombreOriginal.split('.').pop()!.toLowerCase()
    const ruta = rutaDeArchivo({
      municipioSlug: 'tuxcacuesco',
      sujetoObligadoSlug: so.prefijo || so.tipo.slug,
      versionCarpeta: version.carpetaR2,
      nodoCarpeta: nodo.carpetaR2,
      periodoCarpeta: d.carpetaPeriodo,
      nombreVisible: d.nombre,
      idCorto: d.id.slice(0, 6),
      extension: ext,
    })
    if (!(await cabecera(ruta)))
      await subirDesdeServidor(ruta, bytes, {
        contentType: det.mime,
        contentDisposition: contentDisposition(def.disposicion, d.nombre, ext),
      })

    await tx.insert(s.documentos).values({
      id: d.id,
      municipioId: municipio.id,
      sujetoObligadoId: so.id,
      nodoId: nodo.id,
      nombre: d.nombre,
      periodoEtiqueta: d.periodoEtiqueta,
      periodoInicio: d.periodoInicio,
      periodoFin: null,
      carpetaPeriodo: d.carpetaPeriodo,
      estado: 'publicado',
      tipo: 'archivo',
      publicadoEn: new Date(),
    })
    const [v] = await tx
      .insert(s.documentoVersiones)
      .values({
        documentoId: d.id,
        numero: 1,
        rutaR2: ruta,
        nombreOriginal,
        mime: det.mime,
        tipoArchivo: def.tipo,
        tamano: bytes.byteLength,
        hashSha256: createHash('sha256').update(bytes).digest('hex'),
      })
      .returning()
    await tx.update(s.documentos).set({ versionActualId: v!.id }).where(eq(s.documentos.id, d.id))
    return 'creado'
  })
}

async function enLotes<T, R>(
  items: T[],
  n: number,
  fn: (t: T) => Promise<R | null>,
): Promise<NonNullable<R>[]> {
  const salida: NonNullable<R>[] = []
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const item = items[i++]!
        const r = await fn(item)
        if (r != null) salida.push(r as NonNullable<R>)
      }
    }),
  )
  return salida
}

await main()
process.exit(0)
