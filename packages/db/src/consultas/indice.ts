import { and, asc, eq } from 'drizzle-orm'
import type { Tx } from '../cliente'
import * as s from '../schema'

export type NodoIndice = typeof s.indiceNodos.$inferSelect

export async function versionVigente(tx: Tx, estadoId: string) {
  return tx.query.indiceVersiones.findFirst({
    where: and(eq(s.indiceVersiones.estadoId, estadoId), eq(s.indiceVersiones.estatus, 'vigente')),
  })
}

export async function versionPorSlug(tx: Tx, estadoId: string, slug: string) {
  return tx.query.indiceVersiones.findFirst({
    where: and(eq(s.indiceVersiones.estadoId, estadoId), eq(s.indiceVersiones.slug, slug)),
  })
}

/** Todos los nodos activos de una versión × tipo de sujeto, en orden de árbol (padres antes que hijos). */
export async function nodosDe(
  tx: Tx,
  versionId: string,
  tipoSujetoId: string,
): Promise<NodoIndice[]> {
  const filas = await tx.query.indiceNodos.findMany({
    where: and(
      eq(s.indiceNodos.versionId, versionId),
      eq(s.indiceNodos.tipoSujetoId, tipoSujetoId),
      eq(s.indiceNodos.activo, true),
    ),
    orderBy: [asc(s.indiceNodos.orden)],
  })
  return ordenarComoArbol(filas)
}

export async function nodoPorClave(tx: Tx, versionId: string, tipoSujetoId: string, clave: string) {
  return tx.query.indiceNodos.findFirst({
    where: and(
      eq(s.indiceNodos.versionId, versionId),
      eq(s.indiceNodos.tipoSujetoId, tipoSujetoId),
      eq(s.indiceNodos.clave, clave),
      eq(s.indiceNodos.activo, true),
    ),
  })
}

export async function nodoPorRutaSlug(
  tx: Tx,
  versionId: string,
  tipoSujetoId: string,
  rutaSlug: string,
) {
  return tx.query.indiceNodos.findFirst({
    where: and(
      eq(s.indiceNodos.versionId, versionId),
      eq(s.indiceNodos.tipoSujetoId, tipoSujetoId),
      eq(s.indiceNodos.rutaSlug, rutaSlug),
      eq(s.indiceNodos.activo, true),
    ),
  })
}

// ── Helpers puros sobre la lista ─────────────────────────────────────────────

export type NodoArbol<N extends { id: string; padreId: string | null }> = N & {
  hijos: NodoArbol<N>[]
  profundidad: number
}

/** Lista plana → árbol. */
export function construirArbol<N extends { id: string; padreId: string | null; orden: number }>(
  nodos: N[],
): NodoArbol<N>[] {
  const porId = new Map<string, NodoArbol<N>>()
  for (const n of nodos) porId.set(n.id, { ...n, hijos: [], profundidad: 0 })
  const raices: NodoArbol<N>[] = []
  for (const n of porId.values()) {
    const padre = n.padreId ? porId.get(n.padreId) : undefined
    if (padre) {
      n.profundidad = padre.profundidad + 1
      padre.hijos.push(n)
    } else raices.push(n)
  }
  const ordenar = (lista: NodoArbol<N>[]) => {
    lista.sort((a, b) => a.orden - b.orden)
    lista.forEach((x) => ordenar(x.hijos))
  }
  ordenar(raices)
  return raices
}

/** Reordena una lista plana en orden de recorrido del árbol (DFS). */
export function ordenarComoArbol<N extends { id: string; padreId: string | null; orden: number }>(
  nodos: N[],
): N[] {
  const salida: N[] = []
  const visitar = (n: NodoArbol<N>) => {
    const { hijos, profundidad: _p, ...resto } = n
    salida.push(resto as unknown as N)
    hijos.forEach(visitar)
  }
  construirArbol(nodos).forEach(visitar)
  return salida
}

/** Ids del nodo y sus ancestros, de la raíz al nodo. */
export function rutaDeAncestros<N extends { id: string; padreId: string | null }>(
  nodos: N[],
  nodoId: string,
): N[] {
  const porId = new Map(nodos.map((n) => [n.id, n]))
  const ruta: N[] = []
  let actual = porId.get(nodoId)
  while (actual) {
    ruta.unshift(actual)
    actual = actual.padreId ? porId.get(actual.padreId) : undefined
  }
  return ruta
}

/** Ids de un nodo y todos sus descendientes. */
export function idsConDescendientes<N extends { id: string; padreId: string | null }>(
  nodos: N[],
  nodoId: string,
): string[] {
  const hijosDe = new Map<string | null, N[]>()
  for (const n of nodos) hijosDe.set(n.padreId, [...(hijosDe.get(n.padreId) ?? []), n])
  const salida: string[] = []
  const visitar = (id: string) => {
    salida.push(id)
    for (const h of hijosDe.get(id) ?? []) visitar(h.id)
  }
  visitar(nodoId)
  return salida
}
