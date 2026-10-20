/**
 * Lecturas del sitio público. Todas cacheadas con etiquetas (`unstable_cache`) y revalidadas por el panel
 * a través de /api/revalidar. Devuelven objetos planos (serializables) con fechas en ISO.
 */
import 'server-only'
import { and, asc, comoPublicoPorSlug, desc, eq, inArray, isNull, sql } from '@plataforma/db'
import { municipioPorId } from '@plataforma/db/consultas/municipio'
import {
  nodosDe,
  rutaDeAncestros,
  versionVigente,
  versionPorSlug,
} from '@plataforma/db/consultas/indice'
import * as s from '@plataforma/db/schema'
import { unstable_cache } from 'next/cache'
import {
  ETIQUETA_MUNICIPIO,
  ETIQUETA_TODO,
  etiquetaDocumento,
  etiquetaNodo,
  etiquetaSujeto,
} from '../etiquetas'
import { configSitio } from './config'

const UN_DIA = 60 * 60 * 24

export type SujetoPublico = {
  id: string
  prefijo: string
  nombre: string
  tipoSlug: string
  tipoSujetoId: string
}
export type RedPublica = {
  red: string
  nombreOtra: string | null
  url: string
  texto: string | null
  sujetoObligadoId: string | null
}
export type MunicipioPublico = {
  id: string
  slug: string
  nombre: string
  nombreOficial: string
  estadoId: string
  datosContacto: { direccion?: string; telefono?: string; correo?: string; horario?: string }
  tema: {
    colorPrimario: string
    colorSecundario: string
    colorAcento: string
    tipografia: string
    escudoRuta: string | null
    logoAdministracionRuta: string | null
    version: number
  } | null
  sujetos: SujetoPublico[]
  redes: RedPublica[]
  version: { id: string; slug: string; nombre: string; carpetaR2: string } | null
}

export type NodoPublico = {
  id: string
  padreId: string | null
  nivel: 'articulo' | 'fraccion' | 'inciso' | 'subinciso'
  numero: string
  etiqueta: string
  titulo: string
  descripcion: string | null
  clave: string | null
  rutaSlug: string | null
  periodicidad: 'mensual' | 'trimestral' | 'semestral' | 'anual' | 'permanente'
  orden: number
  /** Documentos publicados en el nodo (sin descendientes). */
  documentos: number
}

export type DocumentoPublico = {
  id: string
  nombre: string
  estado: 'publicado' | 'oculto' | 'historico' | 'papelera'
  tipo: 'archivo' | 'video_externo'
  urlExterna: string | null
  periodoEtiqueta: string | null
  periodoInicio: string | null
  publicadoEn: string | null
  actualizadoEn: string
  version: {
    rutaR2: string
    tipoArchivo: 'pdf' | 'word' | 'excel' | 'powerpoint' | 'zip' | 'video' | 'imagen'
    tamano: number
    mime: string
    duracionSeg: number | null
    miniaturaRuta: string | null
  } | null
}

export type LeyendaPublica = {
  id: string
  periodoEtiqueta: string | null
  periodoInicio: string | null
  texto: string
}

const slug = () => configSitio().municipioSlug

export const obtenerMunicipio = (): Promise<MunicipioPublico | null> =>
  unstable_cache(
    async () =>
      comoPublicoPorSlug(slug(), async (tx, id) => {
        const m = await municipioPorId(tx, id)
        if (!m) return null
        const redes = await tx.query.redesSociales.findMany({
          where: eq(s.redesSociales.municipioId, id),
          orderBy: [asc(s.redesSociales.orden)],
        })
        const version = await versionVigente(tx, m.estadoId)
        return {
          id: m.id,
          slug: m.slug,
          nombre: m.nombre,
          nombreOficial: m.nombreOficial,
          estadoId: m.estadoId,
          datosContacto: m.datosContacto,
          tema: m.tema
            ? {
                colorPrimario: m.tema.colorPrimario,
                colorSecundario: m.tema.colorSecundario,
                colorAcento: m.tema.colorAcento,
                tipografia: m.tema.tipografia,
                escudoRuta: m.tema.escudoRuta,
                logoAdministracionRuta: m.tema.logoAdministracionRuta,
                version: m.tema.version,
              }
            : null,
          sujetos: m.sujetosObligados
            .filter((so) => so.activo)
            .map((so) => ({
              id: so.id,
              prefijo: so.prefijo,
              nombre: so.nombre,
              tipoSlug: so.tipo.slug,
              tipoSujetoId: so.tipoSujetoId,
            })),
          redes: redes.map((r) => ({
            red: r.red,
            nombreOtra: r.nombreOtra,
            url: r.url,
            texto: r.texto,
            sujetoObligadoId: r.sujetoObligadoId,
          })),
          version: version
            ? {
                id: version.id,
                slug: version.slug,
                nombre: version.nombre,
                carpetaR2: version.carpetaR2,
              }
            : null,
        }
      }),
    ['municipio', slug()],
    { tags: [ETIQUETA_TODO, ETIQUETA_MUNICIPIO], revalidate: UN_DIA },
  )()

/** Nodos activos de un sujeto obligado (versión vigente o la indicada) con conteo de documentos publicados. */
export const obtenerNodos = (
  prefijo: string,
  versionSlug: string | null = null,
): Promise<NodoPublico[]> =>
  unstable_cache(
    async () => {
      const r = await comoPublicoPorSlug(slug(), async (tx, id) => {
        const m = await municipioPorId(tx, id)
        const so = m?.sujetosObligados.find((x) => x.prefijo === prefijo && x.activo)
        if (!m || !so) return []
        const version = versionSlug
          ? await versionPorSlug(tx, m.estadoId, versionSlug)
          : await versionVigente(tx, m.estadoId)
        if (!version) return []
        const nodos = await nodosDe(tx, version.id, so.tipoSujetoId)
        const conteos = await tx
          .select({ nodoId: s.documentos.nodoId, n: sql<number>`count(*)::int` })
          .from(s.documentos)
          .where(
            and(
              eq(s.documentos.municipioId, id),
              eq(s.documentos.sujetoObligadoId, so.id),
              eq(s.documentos.estado, 'publicado'),
            ),
          )
          .groupBy(s.documentos.nodoId)
        const porNodo = new Map(conteos.map((c) => [c.nodoId, c.n]))
        return nodos.map((n) => ({
          id: n.id,
          padreId: n.padreId,
          nivel: n.nivel,
          numero: n.numero,
          etiqueta: n.etiqueta,
          titulo: n.titulo,
          descripcion: n.descripcion,
          clave: n.clave,
          rutaSlug: n.rutaSlug,
          periodicidad: n.periodicidad,
          orden: n.orden,
          documentos: porNodo.get(n.id) ?? 0,
        }))
      })
      return r ?? []
    },
    ['nodos', slug(), prefijo, versionSlug ?? 'vigente'],
    { tags: [ETIQUETA_TODO, etiquetaSujeto(prefijo)], revalidate: UN_DIA },
  )()

export type NodoConDocumentos = {
  nodo: NodoPublico
  ruta: NodoPublico[]
  hijos: NodoPublico[]
  documentos: DocumentoPublico[]
  leyendas: LeyendaPublica[]
}

/** Un nodo (por clave o rutaSlug) con sus documentos publicados y leyendas. */
export async function obtenerNodo(
  prefijo: string,
  claveORuta: string,
  versionSlug: string | null = null,
): Promise<NodoConDocumentos | null> {
  const nodos = await obtenerNodos(prefijo, versionSlug)
  const nodo = nodos.find((n) => n.clave === claveORuta || n.rutaSlug === claveORuta)
  if (!nodo) return null
  const ruta = rutaDeAncestros(nodos, nodo.id)
  const hijos = nodos.filter((n) => n.padreId === nodo.id)
  const etiquetas = [
    ETIQUETA_TODO,
    etiquetaSujeto(prefijo),
    ...ruta.map((n) => etiquetaNodo(prefijo, n.clave ?? n.rutaSlug ?? '')),
  ]
  const { documentos, leyendas } = await unstable_cache(
    async () => {
      const r = await comoPublicoPorSlug(slug(), async (tx, id) => {
        const so = (await municipioPorId(tx, id))?.sujetosObligados.find(
          (x) => x.prefijo === prefijo,
        )
        if (!so) return { documentos: [], leyendas: [] }
        const docs = await tx.query.documentos.findMany({
          where: and(
            eq(s.documentos.municipioId, id),
            eq(s.documentos.sujetoObligadoId, so.id),
            eq(s.documentos.nodoId, nodo.id),
            eq(s.documentos.estado, 'publicado'),
          ),
          with: { versionActual: true },
          orderBy: [
            desc(s.documentos.periodoInicio),
            asc(s.documentos.orden),
            desc(s.documentos.publicadoEn),
          ],
        })
        const ley = await tx.query.leyendasSinInformacion.findMany({
          where: and(
            eq(s.leyendasSinInformacion.municipioId, id),
            eq(s.leyendasSinInformacion.sujetoObligadoId, so.id),
            eq(s.leyendasSinInformacion.nodoId, nodo.id),
            isNull(s.leyendasSinInformacion.eliminadoEn),
          ),
          orderBy: [desc(s.leyendasSinInformacion.periodoInicio)],
        })
        return {
          documentos: docs.map(aDocumentoPublico),
          leyendas: ley.map((l) => ({
            id: l.id,
            periodoEtiqueta: l.periodoEtiqueta,
            periodoInicio: l.periodoInicio,
            texto: l.texto,
          })),
        }
      })
      return r ?? { documentos: [], leyendas: [] }
    },
    ['nodo-docs', slug(), prefijo, nodo.id],
    { tags: etiquetas, revalidate: UN_DIA },
  )()
  return { nodo, ruta, hijos, documentos, leyendas }
}

export type DocumentoDetalle = DocumentoPublico & {
  nodo: NodoPublico
  prefijo: string
  sujetoNombre: string
  ruta: NodoPublico[]
}

/** Documento por id, en cualquier estado (para /d/<id>: redirigir, mostrar "retirado", etc.). */
export const obtenerDocumento = (id: string): Promise<DocumentoDetalle | null> =>
  unstable_cache(
    async () =>
      comoPublicoPorSlug(slug(), async (tx, municipioId) => {
        const d = await tx.query.documentos.findFirst({
          where: and(eq(s.documentos.id, id), eq(s.documentos.municipioId, municipioId)),
          with: { versionActual: true, nodo: true, sujetoObligado: true },
        })
        if (!d) return null
        const nodos = await obtenerNodos(d.sujetoObligado.prefijo)
        const nodo = nodos.find((n) => n.id === d.nodoId)
        const ruta = nodo ? rutaDeAncestros(nodos, nodo.id) : []
        return {
          ...aDocumentoPublico(d),
          prefijo: d.sujetoObligado.prefijo,
          sujetoNombre: d.sujetoObligado.nombre,
          nodo: nodo ?? {
            id: d.nodo.id,
            padreId: d.nodo.padreId,
            nivel: d.nodo.nivel,
            numero: d.nodo.numero,
            etiqueta: d.nodo.etiqueta,
            titulo: d.nodo.titulo,
            descripcion: d.nodo.descripcion,
            clave: d.nodo.clave,
            rutaSlug: d.nodo.rutaSlug,
            periodicidad: d.nodo.periodicidad,
            orden: d.nodo.orden,
            documentos: 0,
          },
          ruta,
        }
      }),
    ['documento', slug(), id],
    { tags: [ETIQUETA_TODO, etiquetaDocumento(id)], revalidate: UN_DIA },
  )()

/** Para el sitemap: todas las claves públicas con su última actualización. */
export const obtenerRutasSitemap = (): Promise<{ ruta: string; actualizado: string }[]> =>
  unstable_cache(
    async () => {
      const r = await comoPublicoPorSlug(slug(), async (tx, id) => {
        const m = await municipioPorId(tx, id)
        if (!m) return []
        const version = await versionVigente(tx, m.estadoId)
        if (!version) return []
        const salida: { ruta: string; actualizado: string }[] = []
        for (const so of m.sujetosObligados.filter((x) => x.activo)) {
          const nodos = await nodosDe(tx, version.id, so.tipoSujetoId)
          const ultimos = await tx
            .select({
              nodoId: s.documentos.nodoId,
              fecha: sql<string>`max(${s.documentos.actualizadoEn})`,
            })
            .from(s.documentos)
            .where(
              and(
                eq(s.documentos.municipioId, id),
                eq(s.documentos.sujetoObligadoId, so.id),
                eq(s.documentos.estado, 'publicado'),
              ),
            )
            .groupBy(s.documentos.nodoId)
          const porNodo = new Map(ultimos.map((u) => [u.nodoId, u.fecha]))
          const base = so.prefijo ? `/${so.prefijo}` : ''
          salida.push({ ruta: base || '/transparencia', actualizado: new Date().toISOString() })
          for (const n of nodos) {
            const seg = n.clave ?? n.rutaSlug
            if (!seg) continue
            salida.push({
              ruta: `${base}/${seg}`,
              actualizado: porNodo.get(n.id)
                ? new Date(porNodo.get(n.id)!).toISOString()
                : (version.publicadaEn?.toISOString() ?? new Date().toISOString()),
            })
          }
        }
        return salida
      })
      return r ?? []
    },
    ['sitemap', slug()],
    { tags: [ETIQUETA_TODO, 'sitemap'], revalidate: UN_DIA },
  )()

/** Documentos publicados de todos los nodos de un sujeto (para la portada en acordeón). */
export const obtenerDocumentosDeSujeto = (
  prefijo: string,
): Promise<Record<string, DocumentoPublico[]>> =>
  unstable_cache(
    async () => {
      const r = await comoPublicoPorSlug(slug(), async (tx, id) => {
        const so = (await municipioPorId(tx, id))?.sujetosObligados.find(
          (x) => x.prefijo === prefijo,
        )
        if (!so) return {}
        const docs = await tx.query.documentos.findMany({
          where: and(
            eq(s.documentos.municipioId, id),
            eq(s.documentos.sujetoObligadoId, so.id),
            inArray(s.documentos.estado, ['publicado']),
          ),
          with: { versionActual: true },
          orderBy: [desc(s.documentos.periodoInicio), asc(s.documentos.orden)],
        })
        const porNodo: Record<string, DocumentoPublico[]> = {}
        for (const d of docs) (porNodo[d.nodoId] ??= []).push(aDocumentoPublico(d))
        return porNodo
      })
      return r ?? {}
    },
    ['docs-sujeto', slug(), prefijo],
    { tags: [ETIQUETA_TODO, etiquetaSujeto(prefijo)], revalidate: UN_DIA },
  )()

function aDocumentoPublico(
  d: typeof s.documentos.$inferSelect & {
    versionActual: typeof s.documentoVersiones.$inferSelect | null
  },
): DocumentoPublico {
  return {
    id: d.id,
    nombre: d.nombre,
    estado: d.estado,
    tipo: d.tipo,
    urlExterna: d.urlExterna,
    periodoEtiqueta: d.periodoEtiqueta,
    periodoInicio: d.periodoInicio,
    publicadoEn: d.publicadoEn?.toISOString() ?? null,
    actualizadoEn: d.actualizadoEn.toISOString(),
    version: d.versionActual
      ? {
          rutaR2: d.versionActual.rutaR2,
          tipoArchivo: d.versionActual.tipoArchivo,
          tamano: d.versionActual.tamano,
          mime: d.versionActual.mime,
          duracionSeg: d.versionActual.duracionSeg,
          miniaturaRuta: d.versionActual.miniaturaRuta,
        }
      : null,
  }
}

export type ResumenPublico = {
  totalDocumentos: number
  ultimaActualizacion: string | null
  /** Secciones (hojas) con más documentos, para destacar en la portada. */
  destacadas: {
    prefijo: string
    clave: string | null
    rutaSlug: string | null
    titulo: string
    etiqueta: string
    documentos: number
  }[]
}

/** Cifras para la portada del sitio: total publicado, última actualización y secciones más nutridas. */
export const obtenerResumen = (): Promise<ResumenPublico> =>
  unstable_cache(
    async () => {
      const r = await comoPublicoPorSlug(slug(), async (tx, id) => {
        const m = await municipioPorId(tx, id)
        if (!m) return null
        const [tot] = await tx
          .select({
            n: sql<number>`count(*)::int`,
            ultima: sql<string | null>`max(${s.documentos.publicadoEn})`,
          })
          .from(s.documentos)
          .where(and(eq(s.documentos.municipioId, id), eq(s.documentos.estado, 'publicado')))
        const version = await versionVigente(tx, m.estadoId)
        const destacadas: ResumenPublico['destacadas'] = []
        if (version) {
          const porNodo = await tx
            .select({
              nodoId: s.documentos.nodoId,
              soId: s.documentos.sujetoObligadoId,
              n: sql<number>`count(*)::int`,
            })
            .from(s.documentos)
            .where(and(eq(s.documentos.municipioId, id), eq(s.documentos.estado, 'publicado')))
            .groupBy(s.documentos.nodoId, s.documentos.sujetoObligadoId)
          const top = porNodo.sort((a, b) => b.n - a.n).slice(0, 6)
          if (top.length > 0) {
            const nodos = await tx.query.indiceNodos.findMany({
              where: inArray(
                s.indiceNodos.id,
                top.map((t) => t.nodoId),
              ),
            })
            for (const t of top) {
              const n = nodos.find((x) => x.id === t.nodoId)
              const so = m.sujetosObligados.find((x) => x.id === t.soId)
              if (n && so)
                destacadas.push({
                  prefijo: so.prefijo,
                  clave: n.clave,
                  rutaSlug: n.rutaSlug,
                  titulo: n.titulo,
                  etiqueta: n.etiqueta,
                  documentos: t.n,
                })
            }
          }
        }
        return {
          totalDocumentos: tot?.n ?? 0,
          ultimaActualizacion: tot?.ultima ? new Date(tot.ultima).toISOString() : null,
          destacadas,
        }
      })
      return r ?? { totalDocumentos: 0, ultimaActualizacion: null, destacadas: [] }
    },
    ['resumen', slug()],
    { tags: [ETIQUETA_TODO, 'sitemap'], revalidate: UN_DIA },
  )()
